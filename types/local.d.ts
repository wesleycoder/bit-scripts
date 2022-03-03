import { type NS, type Server as NSServer } from './bitburner';

export type Server = {
  parent: string;
  path: string[];
  peers: string[];
  ramAvail: number;
} & NSServer;

type FunctionPropertyNames<T> = {
  // deno-lint-ignore no-explicit-any
  [K in keyof T]: T[K] extends (h: string) => any ? K : never;
}[keyof T];

type NSFn = FunctionPropertyNames<NS>;
