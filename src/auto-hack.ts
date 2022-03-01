import { Server } from '../types/bit-types';
import { NS } from '../types/bitburner';
import DB, { type DBOptions } from './jsondb.js';
import { updateServerDetails } from './nukeall.js';
import { sequence } from './utils.js';

let $ns: NS;
let $db: DB;
let $hackRam: number = 0;

const defaultOptions = {
  target: 'n00dles',
  sleepTime: 60000,
};

const flagConfig: [string, string | number | boolean | string[]][] = [
  ['resetOnInit', false],
  ['target', 'n00dles'],
];

async function bootstrap(ns: NS) {
  $ns = ns;
  $ns.clearLog();
  $ns.disableLog('disableLog');
  $ns.disableLog('sleep');
  $ns.disableLog('scan');
  $ns.disableLog('getServer');
  $ns.disableLog('exec');
  $ns.tail();

  $hackRam = $ns.getScriptRam('hack.js', 'home');

  const flags = $ns.flags(flagConfig);

  $db = new DB($ns, 'servers.db.txt', flags);
  await $db.init();
  const oldServers = Object.values(await $db.JSON()).map((s) => s.hostname);
  await sequence(oldServers, updateServerDetails, { ns: $ns, db: $db });
}

export const main = async (ns: NS) => {
  await bootstrap(ns);

  const options = {
    ...defaultOptions,
    ...(await $ns.flags(flagConfig)),
  };

  while (true) {
    const allServers = await $db.JSON();
    const serversToHack = Object.values(allServers)
      .filter(canHack)
      .filter(({ hostname }) => $ns.fileExists('hack.js', hostname));

    const hackableServers = serversToHack
      .map((s) => {
        const isHome = s.hostname === 'home';
        const avail = isHome
          ? s.ramAvail - Math.min(s.maxRam / 10, 12)
          : s.ramAvail;

        const t = Math.floor(avail / $hackRam);

        return [
          s,
          {
            threads: isHome ? t - 10 : t,
          },
        ];
      })
      .filter(([, { threads }]) => threads > 0);

    if (hackableServers.length) {
      $ns.print(`${hackableServers.length} servers to run hack.js`);

      const results = await sequence(
        hackableServers,
        async ([server, { threads }]) => {
          let started = 0;
          if (threads > 0) {
            started = await $ns.exec(
              'hack.js',
              server.hostname,
              threads,
              '--threads',
              threads,
              '--target',
              options.target
            );
          }

          await updateServerDetails(server.hostname, { ns: $ns, db: $db });
          return [started, threads, await $db.get(server.hostname)];
        }
      );

      results.forEach(([started, threads, server]) => {
        $ns.print(`${started ? '✅' : '❌'} ${threads}𝒙 ${server.hostname}`);
      });
    }

    await $ns.sleep(options.sleepTime);
  }
};

const canHack = ({ hasAdminRights, ramAvail }: Server) =>
  hasAdminRights && ramAvail >= $hackRam;
