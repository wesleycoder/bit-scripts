export const executables = [
  'BruteSSH.exe',
  'FTPCrack.exe',
  'relaySMTP.exe',
  'HTTPWorm.exe',
  'SQLInject.exe',
];

export const getExecutable: (
  ns: NS,
  file: string
) => ((host: string) => void) | undefined = (ns, file) =>
  ({
    'BruteSSH.exe': ns.brutessh,
    'FTPCrack.exe': ns.ftpcrack,
    'relaySMTP.exe': ns.relaysmtp,
    'HTTPWorm.exe': ns.httpworm,
    'SQLInject.exe': ns.sqlinject,
  }[file]);

export async function main(ns: NS) {
  if (typeof ns.args[0] !== 'string') {
    throw new Error('Invalid target');
  }

  let target = ns.args[0];

  if (!target) {
    target = (await ns.getServer()).hostname;
  }

  try {
    ns.brutessh(target);
    ns.ftpcrack(target);
    ns.relaysmtp(target);
    ns.httpworm(target);
    ns.sqlinject(target);
  } catch (e) {
    // ns.tprint(e as Error);
  }

  executables
    .filter((file) => ns.fileExists(file, 'home'))
    .map((cmd) => getExecutable(ns, cmd))
    .forEach((cmd) => cmd?.(target));
}
