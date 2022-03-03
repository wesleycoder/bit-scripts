import { type NS } from '../../types/bitburner';

export class DBClient {
  #port = 1;
}

export async function main(ns: NS) {
  ns.tail();
  ns.print('Client running!');
  await ns.writePort(1, `writing`);
}
