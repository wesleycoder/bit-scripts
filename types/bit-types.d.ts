import { type NS, type Server as NSServer } from '../types/bitburner';

export type Server = {
  parent: string;
  path: string;
  peers: string[];
  ramAvail: number;
} & NSServer;
