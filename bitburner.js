/** @typedef {import("./types/bitburner").NS} NS */
/** @typedef {import("./types/bitburner").Server} Server */
/** @typedef {Server & { earned: number; root: boolean; }} Target */

const hackingBlacklist = ["csec"];

/** @param {NS} ns **/
export async function main(ns) {
  const availHosts = await getServers(ns);
  await Promise.allSettled(
    availHosts.map(async (target) => {
      hackHost(ns, target);
    })
  );
}

/**
 * @param {NS} ns
 * @returns Promise<Target[]> hosts available to hacking
 **/
const getServers = async (ns) => {
  const allHosts = await ns.scan();
  const allServers = await Promise.all(
    allHosts.map((target) => ({
      ...ns.getServer(target),
      root: ns.hasRootAccess(target),
      earned: 0,
    }))
  );
  await Promise.all(
    allServers.map(async (target) => {
      if (
        !target.root &&
        target.secLvl <= ns.getHackingLevel() &&
        target.portsReq <= 1
      ) {
        let openPorts = 0;
        if (ns.fileExists("ftpcrack.exe")) {
          openPorts++;
          ns.ftpcrack(target.hostname);
        }
        if (ns.fileExists("brutessh.exe")) {
          openPorts++;
          ns.brutessh(target.hostname);
        }
        if (ns.fileExists("httpworm.exe")) {
          openPorts++;
          ns.httpworm(target.hostname);
        }
        if (ns.fileExists("relaysmtp.exe")) {
          openPorts++;
          ns.relaysmtp(target.hostname);
        }
        if (ns.fileExists("sqlinject.exe")) {
          openPorts++;
          ns.sqlinject(target.hostname);
        }

        if (ns.getServerNumPortsRequired(target.hostname) > openPorts) {
          target.root = ns.hasRootAccess(target.hostname);
          return;
        }

        if (target.hostname === "CSEC") {
          // This does not seem to be automatable for now?
          await ns.installBackdoor(target.hostname);
        }

        ns.nuke(target.hostname);
        target.root = ns.hasRootAccess(target.hostname);
      }
    })
  );
  return allServers.filter((s) => s.root);
};

/**
 * @param {NS} ns
 * @param {Server} host
 **/
const hackHost = async (ns, target) => {
  const securityThresh = ns.getServerMinSecurityLevel(target.hostname) + 5;
  const moneyThresh = ns.getServerMoneyAvailable(target.hostname) * 0.8;
  if (ns.getServerSecurityLevel(target.hostname) > securityThresh) {
    await ns.weaken(target.hostname);
  } else if (ns.getServerMoneyAvailable(target.hostname) < moneyThresh) {
    await ns.grow(target.hostname);
  } else {
    const earned = ns.hack(target.hostname);
    ns.toast(`Earned: ${earned} from ${target.hostname}`);
    target.earned += earned;
  }
};
