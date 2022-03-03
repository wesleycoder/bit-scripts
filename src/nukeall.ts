import DB, { type DBOptions } from '/jsondb';
import { executables } from '/nuke';
import { type NS } from '/types/bitburner';
import { type Server } from '/types/local';
import { sequence } from '/utils';

type Logger = {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  info: (...args: any[]) => void;
};

let $ns: NS;
let $db: DB<Server>;
let $logger: Logger;

let $nukeRam = 0;
let $nukeAllRam = 0;

type ScriptOptions = {
  parent: string;
};

const getLogger = (ns: NS) => ({
  log: ns.print,
  error: (...args: any[]) => ns.print('ERROR ', ...args),
  warn: (...args: any[]) => ns.print('WARN ', ...args),
  info: (...args: any[]) => ns.print('INFO ', ...args),
});

const blacklist = ['home'];

const scriptFilenames = [
  'nuke.js',
  'nukeall.js',
  'jsondb.js',
  'utils.js',
  'servers.db.txt',
  'hack.js',
];

const flagConfig: [string, string | number | boolean | string[]][] = [
  ['resetOnInit', false],
  ['parent', ''],
];

async function bootstrap(ns: NS) {
  $ns = ns;
  $logger = getLogger($ns);
  $ns.disableLog('ALL');
  $ns.clearLog();
  const formatter = Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
  $logger.info(`⏱ ${formatter.format(new Date())}`);

  $nukeRam = $ns.getScriptRam('nuke.js', 'home');
  $nukeAllRam = $ns.getScriptRam('nukeall.js', 'home');

  const flags: DBOptions = $ns.flags(flagConfig);

  $db = new DB($ns, 'servers.db.txt', flags);
  await $db.ready;
}

export async function main(ns: NS) {
  ns.tail();
  await bootstrap(ns);
  const flags: ScriptOptions & DBOptions = $ns.flags(flagConfig);

  const { hostname: currentServer } = await $ns.getServer();
  await updateServerDetails(currentServer);

  await tryNuke(currentServer);

  const peers = await $ns.scan(currentServer);
  const targets = peers.filter(
    (p) => ![...blacklist, currentServer, flags.parent].includes(p)
  );

  await sequence(targets, mapServers, currentServer);
  await sequence(
    $db.getAll().map((s) => s.hostname),
    (t) => $ns.scp(scriptFilenames, 'home', t),
    currentServer
  );

  await $db.sync();
  const peersToNuke = targets.map((t) => $db.pick(t));

  peersToNuke.forEach((p) => $ns.exec('nuke.js', currentServer, 1, p.hostname));

  $logger.info(`# Nuking ${peersToNuke.length} servers:`);
  peersToNuke.map(({ hostname }) => $logger.log(`💻 ${hostname}`));

  $logger.log('_________________________________________');

  await sequence(peersToNuke, async ({ hostname, ramAvail }) => {
    const updated = await tryNuke(hostname);
    $logger.warn(
      `${hostname} has ${ramAvail} available RAM and ${$nukeAllRam} required`
    );

    if (updated.hasAdminRights && updated.ramAvail >= $nukeAllRam) {
      const started = await $ns.exec(
        'nukeall.js',
        hostname,
        1,
        '--parent',
        currentServer
      );
      if (!started) {
        $logger.error(`Failed to start nukeall on ${hostname}: ${started}`);
      }
    } else {
      const manualPeers = await $ns
        .scan(hostname)
        .map((p) => $db.pick(p))
        .filter(({ hostname: p, hasAdminRights }) => {
          return !hasAdminRights && ![...blacklist, currentServer].includes(p);
        });
      if (manualPeers.length) {
        $ns.tail();
        $logger.warn(
          `${hostname} ${
            updated.hasAdminRights ? 'has' : 'does not have'
          } admin rights and ${
            ramAvail >= $nukeAllRam ? 'has' : 'does not have'
          } enough ram to nuke.`
        );
        $logger.info(`👉🏽 Manually hack 💻 [${manualPeers.join(', ')}]`);
      }
    }
  });
}

async function tryNuke(hostname: string) {
  const server = $db.pick(hostname);
  const commands = executables
    .filter(({ file }) => $ns.fileExists(file, 'home'))
    .map(({ cmdName }) => $ns[cmdName]);
  try {
    await sequence(commands, (cmd) => cmd(hostname));

    const { hasAdminRights: alreadyNuked, openPortCount } = await $ns.getServer(
      hostname
    );

    if (!alreadyNuked && openPortCount >= server.numOpenPortsRequired) {
      $ns.nuke(hostname);
    }

    const { hasAdminRights } = await $ns.getServer(hostname);

    if (!hasAdminRights) {
      $ns.tail();
      $logger.warn(
        `${hostname} has ${openPortCount} open ports and don't have admin rights.`
      );
    }
  } catch (error) {
    $ns.tail();
    $logger.error(
      `Failed to nuke ${hostname}: ${JSON.stringify(server)}: `,
      error
    );
  }

  const updated = await updateServerDetails(server.hostname);
  await $db.set(server.hostname, updated);

  return updated;
}

async function mapServers(current: string, parent = '', path = []) {
  const server = await updateServerDetails(current, { parent, path });

  const peersNotMapped = server.peers.filter(
    (s) => ![...blacklist, ...path].includes(s)
  );
  await sequence(peersNotMapped, mapServers, current, [...path, current]);
}

export async function updateServerDetails(
  hostname: string,
  { parent = '', path = [], ns = $ns, db = $db } = {}
): Promise<Server> {
  const oldData = db.pick(hostname) ?? { parent, path };
  const peers = await ns.scan(hostname);
  const details = await ns.getServer(hostname);
  const server: Server = {
    ...oldData,
    ...details,
    ramAvail: Number.parseFloat((details.maxRam - details.ramUsed).toFixed(2)),
    peers: peers,
  };

  await db.set(hostname, server);

  return server;
}
