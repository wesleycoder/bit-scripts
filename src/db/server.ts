import { open } from 'lmdb';
import { type NS } from '/types/bitburner';

let $ns: NS;
let $db: any;

export class DBServer {
  #ns: NS;
  #availablePorts = 19;
  #collections = new Map<string, any>();

  constructor(ns: NS = $ns) {
    this.#ns = ns;
    // this.#collections.set('test', {});
  }
}

async function bootstrap(ns: NS) {
  $ns = ns;

  $ns.disableLog('ALL');
  $ns.clearLog();
  $ns.tail();

  // $db = new JsonDB($ns);
  $db = open({
    path: 'db.txt',
  });
  await $db.ready;
  $ns.tail();
}

export async function main(ns: NS) {
  await bootstrap(ns);

  const port = $ns.getPortHandle(1);

  $ns.print('Server running!');
  while (true) {
    while (port.empty()) {
      await $ns.sleep(500);
    }
    const data = port.read();

    $ns.print(data);

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
