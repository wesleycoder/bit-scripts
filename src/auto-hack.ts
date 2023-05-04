import DB, { type DBOptions } from '~/jsondb';
import { updateServerDetails } from '~/nukeall';
import { NS } from '~/types/bitburner';
import { Server } from '~/types/local';
import { sequence } from '~/utils';

let $ns: NS;
let $db: DB<Server>;
let $hackRam = 0;

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
  $ns.disableLog('ALL');
  $ns.tail();

  $hackRam = $ns.getScriptRam('hack.js', 'home');

  const flags: DBOptions = $ns.flags(flagConfig);

  $db = new DB($ns, 'servers.db.txt', flags);
  await $db.ready;
  const oldServers = $db.getAll().map((s) => s.hostname);
  await sequence(oldServers, updateServerDetails, { ns: $ns, db: $db });
}

export const main = async (ns: NS) => {
  await bootstrap(ns);

  const options = {
    ...defaultOptions,
    ...(await $ns.flags(flagConfig)),
  };

  while (true) {
    const serversToHack = $db
      .getAll()
      .filter(canHack)
      .filter(({ hostname }) => $ns.fileExists('hack.js', hostname));

    const hackableServers = serversToHack
      .map<[Server, { threads: number }]>((s) => {
        const isHome = s.hostname === 'home';
        const avail = isHome
          ? s.ramAvail - Math.min(s.maxRam / 4, 12)
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

    $ns.tprint(`Found ${hackableServers.length} servers to run hack.js`);
    $ns.tprint(hackableServers.map(([s]) => s.hostname).join(', ') || 'none');

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
          return [started, threads, $db.pick(server.hostname)];
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
