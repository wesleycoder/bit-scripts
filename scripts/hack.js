/** @typedef {import("../types/bitburner").NS} NS */
/** @typedef {import("../types/bitburner").Server} Server */

/**
 * @param {NS} ns
 * @param {Server} host
 **/
export const main = async (ns) => {
  const flags = await ns.flags([['target', '']]);

  if (!flags.target) ns.exit();

  const securityThresh = ns.getServerMinSecurityLevel(flags.target) + 5;
  const moneyThresh = ns.getServerMoneyAvailable(flags.target) * 0.8;

  while (true) {
    if (ns.getServerSecurityLevel(flags.target) > securityThresh) {
      await ns.weaken(flags.target);
    } else if (ns.getServerMoneyAvailable(flags.target) < moneyThresh) {
      await ns.grow(flags.target);
    } else {
      await ns.hack(flags.target);
    }
  }
};
