import { NS } from '../types/bitburner';

declare global {
  interface Document {
    achievements: string[];
  }
}

export async function main(ns: NS) {
  document.achievements.push('UNACHIEVABLE');
  ns.tprint(document.achievements);
}
