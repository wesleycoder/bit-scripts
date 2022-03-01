import { type NS } from '../types/bitburner';

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
  const securityThresh = $ns.getServerMinSecurityLevel(flags.target) + 5;
  const moneyThresh = $ns.getServerMaxMoney(flags.target) * 0.8;
  let totalEarned = 0;
  let weakenCount = 0;
  let growCount = 0;

  while (true) {
    const securityLvl = Math.round($ns.getServerSecurityLevel(flags.target));
    const moneyAvail = Math.round($ns.getServerMoneyAvailable(flags.target));

    $ns.clearLog();
    $ns.print(`💻 Target: ${flags.target}`);
    $ns.print(`🤑 Total earned: ${$ns.nFormat(totalEarned, moneyFmt)}`);
    $ns.print(`💰 Expected: ${$ns.nFormat(moneyThresh, moneyFmt)}`);
    $ns.print(`#️⃣ Weaken since last hack: ${weakenCount}`);
    $ns.print(`#️⃣ Grow since last hack: ${growCount}`);
    $ns.print('--------------------------------');

    if (securityLvl >= securityThresh) {
      $ns.print(`🛡 Weakening: 🎚${securityLvl}`);
      await $ns.weaken(flags.target, { threads: flags.threads });
      weakenCount++;
    } else if (moneyAvail <= moneyThresh) {
      $ns.print(`📈 Growing: ${$ns.nFormat(moneyAvail, moneyFmt)}`);
      await $ns.grow(flags.target, { threads: flags.threads });
      growCount++;
    } else {
      $ns.print(`👨🏽‍💻 Hacking`);
      const earned = await $ns.hack(flags.target, { threads: flags.threads });
      totalEarned += earned;
      weakenCount = 0;
      growCount = 0;
    }
  }
};
