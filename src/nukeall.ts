import DB, { type DBOptions } from '/jsondb';
import { executables } from '/nuke';
import { type NS } from '/types/bitburner';
import { type Server } from '/types/local';
import { sequence } from '/utils';

let $ns: NS;
let $db: DB<Server>;
let $nukeRam = 0;
let $nukeAllRam = 0;

type ScriptOptions = {
  parent: string;
};

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
  $ns.disableLog('ALL');
  $ns.clearLog();

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
  const peersToNuke = targets.map((t) => $db.JSON()[t] as Server);

  peersToNuke.forEach((p) => $ns.exec('nuke.js', currentServer, 1, p.hostname));

  $ns.print(`Nuking ${peersToNuke.length} servers:`);
  peersToNuke.map(({ hostname }) => $ns.print(`💻 ${hostname}`));

  $ns.print('_________________________________________');

  await sequence(peersToNuke, async ({ hostname, ramAvail }) => {
    $ns.print(
      `${hostname} has ${ramAvail} available RAM and ${$nukeAllRam} required`
    );
    const updated = await tryNuke(hostname);

    if (updated.hasAdminRights && ramAvail >= $nukeAllRam) {
      const started = await $ns.exec(
        'nukeall.js',
        hostname,
        1,
        '--parent',
        currentServer
      );
      if (!started) {
        $ns.print(`ERROR Failed to start nukeall on ${hostname}: ${started}`);
      }
    } else {
      const manualPeers = await $ns
        .scan(hostname)
        .map((p) => $db.JSON()[p] as Server)
        .filter(({ hostname: p, hasAdminRights }) => {
          return !hasAdminRights && ![...blacklist, currentServer].includes(p);
        });
      if (manualPeers.length) {
        $ns.tail();
        $ns.print(
          `WARNING ${hostname} ${
            updated.hasAdminRights ? 'has' : 'does not have'
          } admin rights and ${
            ramAvail >= $nukeAllRam ? 'has' : 'does not have'
          } enough ram to nuke.`
        );
        $ns.print(`INFO 👉🏽 Manually hack 💻 [${manualPeers.join(', ')}]`);
      }
    }
  });
}

async function tryNuke(hostname: string) {
  const server = $db.JSON()[hostname];
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
      $ns.print(
        `WARNING ${hostname} has ${openPortCount} open ports and don't have admin rights.`
      );
    }
  } catch (error) {
    $ns.tail();
    $ns.print(`Failed to nuke ${hostname}: ${JSON.stringify(server)}: `, error);
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
  const oldData = db.JSON()[hostname] ?? { parent, path };
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
