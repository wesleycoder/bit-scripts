import * as Bit from './bitburner';

declare global {
  interface Server extends Bit.Server {
    parent: string;
    path: string[];
    peers: string[];
    ramAvail: number;
  }

  interface NS extends Bit.NS {}
  interface TIX extends Bit.TIX {}
}

type FunctionPropertyNames<T> = {
  // deno-lint-ignore no-explicit-any
  [K in keyof T]: T[K] extends (h: string) => any ? K : never;
}[keyof T];

type NSFn = FunctionPropertyNames<NS>;
