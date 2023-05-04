declare global {
  var React: any;
}

import JsonDB from '~/jsondb';
import { type NS } from '~/types/bitburner';

let db: JsonDB;

async function bootstrap(ns: NS) {
  ns.disableLog('ALL');
  ns.clearLog();
  ns.tail();

  db = new JsonDB(ns, 'server.db.txt');
  await db.ready;
}

export async function main(ns: NS) {
  await bootstrap(ns);

  ns.printRaw(<h1 className="bg-red">hello world!@#@!</h1>);

  const port = ns.getPortHandle(1);

  while (true) {
    while (port.empty()) {
      await ns.sleep(500);
    }
    const data = port.read();

    ns.print(`INFO [data]: ${data}`);

    port.clear();
  }
}

export type ActionMessage<T> = {
  data?: T;
  port: number;
  type: string;
};

export type ActionResponse<T> = {
  data?: T;
  error?: string;
};
