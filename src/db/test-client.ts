import { type NS } from '~/types/bitburner';

export async function main(ns: NS) {
  ns.tail();

  const isSuccess = ns.tryWritePort(1, `writing`);

  if (!isSuccess) {
    ns.print('ERROR Failed to write to port');
  }
}
