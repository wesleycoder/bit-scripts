/** @param {NS} ns **/
export async function main(ns) {
  const flags = ns.flags([['target', '']]);
  if (!flags.target) ns.exit();

  while (true) {
    const target = {
      hostname: flags.target,
      minDifficulty: ns.getServerSecurityLevel(flags.target),
      hackDifficulty: ns.getServerMinSecurityLevel(flags.target),
    };

    if (target.hackDifficulty > target.minDifficulty)
      await ns.weaken(flags.target);
  }
}
