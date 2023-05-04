import { type NS } from '~/types/bitburner';

let $ns: NS;

const bootstrap = async (ns: NS) => {
  $ns = ns;
  $ns.disableLog('ALL');
};

export const main = async (ns: NS) => {
  await bootstrap(ns);

  const flags = await $ns.flags([
    ['threads', 1],
    ['target', ''],
    ['tail', false],
  ]);

  if (!flags.target) $ns.exit();

  const moneyFmt = '$0,0[.]000a';
  const securityThresh =
    $ns.getServerMinSecurityLevel(flags.target as string) + 5;
  const moneyThresh = $ns.getServerMaxMoney(flags.target as string) * 0.8;
  let totalEarned = 0;
  let weakenCount = 0;
  let growCount = 0;

  while (true) {
    const securityLvl = Math.round(
      $ns.getServerSecurityLevel(flags.target as string)
    );
    const moneyAvail = Math.round(
      $ns.getServerMoneyAvailable(flags.target as string)
    );

    $ns.clearLog();
    $ns.print(`💻 Target: ${flags.target}`);
    $ns.print(`🤑 Total earned: ${$ns.nFormat(totalEarned, moneyFmt)}`);
    $ns.print(`💰 Expected: ${$ns.nFormat(moneyThresh, moneyFmt)}`);
    $ns.print(`#️⃣ Weaken since last hack: ${weakenCount}`);
    $ns.print(`#️⃣ Grow since last hack: ${growCount}`);
    $ns.print('--------------------------------');

    if (securityLvl >= securityThresh) {
      $ns.print(`🛡 Weakening: 🎚${securityLvl}`);
      await $ns.weaken(flags.target as string, {
        threads: flags.threads as number,
      });
      weakenCount++;
    } else if (moneyAvail <= moneyThresh) {
      $ns.print(`📈 Growing: ${$ns.nFormat(moneyAvail, moneyFmt)}`);
      await $ns.grow(flags.target as string, {
        threads: flags.threads as number,
      });
      growCount++;
    } else {
      $ns.print(`👨🏽‍💻 Hacking`);
      const earned = await $ns.hack(flags.target as string, {
        threads: flags.threads as number,
      });
      totalEarned += earned;
      weakenCount = 0;
      growCount = 0;
    }
  }
};
