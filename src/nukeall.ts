import { Server } from '../types/bit-types';
import { type NS } from '../types/bitburner';
import DB, { type DBOptions } from './jsondb';
import { sequence } from './utils';

let $ns: NS;
let $db: DB;
let $nukeRam = 0;

type ScriptOptions = {
  parent: string;
};

const executables: {
  file: string;
  cmdName: 'brutessh' | 'ftpcrack' | 'relaysmtp' | 'httpworm' | 'sqlinject';
}[] = [
  { file: 'BruteSSH.exe', cmdName: 'brutessh' },
  { file: 'FTPCrack.exe', cmdName: 'ftpcrack' },
  { file: 'relaySMTP.exe', cmdName: 'relaysmtp' },
  { file: 'HTTPWorm.exe', cmdName: 'httpworm' },
  { file: 'SQLInject.exe', cmdName: 'sqlinject' },
];

const blacklist = ['home'];

const scriptFilenames = [
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
  $ns.disableLog('disableLog');
  $ns.disableLog('sleep');
  $ns.disableLog('scan');
  $ns.disableLog('brutessh');
  $ns.disableLog('ftpcrack');
  $ns.disableLog('relaysmtp');
  $ns.disableLog('httpworm');
  $ns.disableLog('sqlinject');
  $ns.disableLog('getScriptRam');
  $ns.disableLog('scp');
  $ns.disableLog('nuke');
  $ns.disableLog('exec');

  $nukeRam = $ns.getScriptRam('nukeall.js', 'home');

  const flags: DBOptions = $ns.flags(flagConfig);

  $db = new DB($ns, 'servers.db.txt', flags);
  await $db.init();
}

export async function main(ns: any) {
  await bootstrap(ns);
  const flags: ScriptOptions & DBOptions = $ns.flags(flagConfig);

  const { hostname: currentServer, hasAdminRights } = await $ns.getServer();

  if (!hasAdminRights) {
    await tryNuke(currentServer);
  }

  await mapServers(currentServer);

  const peers = await $ns.scan(currentServer);
  const targets = peers.filter(
    (p) => ![...blacklist, currentServer, flags.parent].includes(p)
  );

  await sequence(targets, mapServers, currentServer);
  const allServers = Object.values(await $db.JSON<Server>());
  await sequence(
    allServers.map((s) => s.hostname),
    (t) => $ns.scp(scriptFilenames, 'home', t),
    currentServer
  );

  const db = await $db.JSON();

  const peersToNuke = targets.map((t) => db[t]);

  $ns.print(`Nuking ${peersToNuke.length} servers:`);
  peersToNuke.map(({ hostname }) => $ns.print(`💻 ${hostname}`));
  $ns.print('_________________________________________');

  await sequence(peersToNuke, async ({ hostname, ramAvail }) => {
    const updated = await tryNuke(hostname);

    if (updated.hasAdminRights && ramAvail >= $nukeRam) {
      const started = await $ns.exec(
        'nukeall.js',
        hostname,
        1,
        '--parent',
        currentServer
      );
      if (!started) {
        $ns.print(`Failed to start nukeall on ${hostname}: ${started}`);
      }
    } else {
      const manualPeers = await $ns.scan(hostname).filter((p) => {
        const { hasAdminRights } = db[p];
        return !hasAdminRights && ![...blacklist, currentServer].includes(p);
      });
      if (manualPeers.length) {
        $ns.tail();
        $ns.print(
          `${hostname} ${
            updated.hasAdminRights ? 'has' : 'does not have'
          } admin rights and ${
            ramAvail >= $nukeRam ? 'has' : 'does not have'
          } enough ram to nuke.`
        );
        const additionalCmd = ['run NUKE.exe;', 'run nukeall.js;', 'backdoor;'];
        $ns.print(
          manualPeers
            .map(
              (p) =>
                `\n\n👉🏽 Manually connect to 💻 ${p} and run:\n` +
                executables
                  .filter(({ file }) => $ns.fileExists(file, 'home'))
                  .map(({ file }) => `run ${file};`)
                  .join('\n') +
                '\n' +
                additionalCmd.join('\n')
            )
            .join('\n\n')
        );
      }
    }
  });
}

async function tryNuke(hostname: string) {
  const server = await $db.get(hostname);
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
        `${hostname} has ${openPortCount} open ports and don't have admin rights.`
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
  const oldData = (await db.get(hostname)) ?? { parent, path };
  const peers = await ns.scan(hostname);
  const details = await ns.getServer(hostname);
  const server = {
    ...oldData,
    ...details,
    ramAvail: Number.parseFloat((details.maxRam - details.ramUsed).toFixed(2)),
    peers: peers,
  };

  await db.set(hostname, server);

  return server;
}
