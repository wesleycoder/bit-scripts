import { type NSFn } from '../types/local';
import { type NS } from '../types/bitburner';

type Executable = {
  file: string;
  cmdName: NSFn;
};

export const executables: Executable[] = [
  { file: 'BruteSSH.exe', cmdName: 'brutessh' },
  { file: 'FTPCrack.exe', cmdName: 'ftpcrack' },
  { file: 'relaySMTP.exe', cmdName: 'relaysmtp' },
  { file: 'HTTPWorm.exe', cmdName: 'httpworm' },
  { file: 'SQLInject.exe', cmdName: 'sqlinject' },
];

export async function main(ns: NS) {
  let target = <string>ns.args[0];

  if (!target) {
    target = (await ns.getServer()).hostname;
  }

  await executables
    .filter(({ file }) => ns.fileExists(file, 'home'))
    .map(({ cmdName }: Executable) => cmdName)
    .forEach((cmd) => ns[cmd](target));
}
