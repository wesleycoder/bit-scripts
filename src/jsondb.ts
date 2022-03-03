import deepEqual from 'fast-deep-equal';
import { type NS } from '../types/bitburner';

export type DBOptions = {
  target?: string;
  syncOnWrite?: boolean;
  jsonSpaces?: number;
  resetOnInit?: boolean;
};

const defaultOptions: DBOptions = {
  target: 'home',
  syncOnWrite: true,
  jsonSpaces: 2,
  resetOnInit: false,
};

export class Initializable extends EventTarget {
  #initialized = new Promise((resolve, reject) => {
    this.addEventListener('initialized', resolve);
    this.addEventListener('failed', reject);
  });

  get ready() {
    return this.#initialized;
  }
}

export class JsonDB<T = null> extends Initializable {
  #ns: NS;

  #initialized = new Promise((resolve, reject) => {
    this.addEventListener('initialized', resolve);
    this.addEventListener('failed', reject);
  });

  // deno-lint-ignore no-explicit-any
  #store: Map<string, T> = new Map();
  #filePath: string;

  options: DBOptions = {};

  constructor(ns: NS, filePath: string = 'db.txt', options: DBOptions = {}) {
    super();
    // Mandatory arguments check
    if (!ns) throw new Error('No NS instance provided.');
    this.#ns = ns;

    if (!filePath) {
      throw new Error('Missing file path argument.');
    }

    this.#filePath = filePath;

    this.options = { ...defaultOptions, ...options };

    // Create file if it doesn't exist
    if (!this.#ns.fileExists(this.#filePath)) {
      this.#ns
        .write(this.#filePath, '{}', 'w')
        .then(() => this.dispatchEvent(new Event('initialized')))
        .catch(() => this.dispatchEvent(new Event('failed')));
    } else if (this.options.resetOnInit) {
      this.sync();
      this.dispatchEvent(new Event('initialized'));
    } else {
      const value = this.#ns.read(this.#filePath);
      Object.entries<T>(value).forEach(([key, val]) => {
        this.#store.set(key, val);
      });
      this.dispatchEvent(new Event('initialized'));
    }
  }

  init() {
    return this.#initialized;
  }

  async set(key: string, value: T) {
    this.#store.set(key, value);
    if (this.options?.syncOnWrite) await this.sync();
  }

  // pick(key: string) {
  //   return this.#store.get(key) as T;
  // }

  has(key: string) {
    return this.#store.delete(key);
  }

  async delete(key: string) {
    if (this.#store.has(key)) this.#store.delete(key);
    if (this.options && this.options.syncOnWrite) await this.sync();
  }

  async deleteAll() {
    for (const [key] of this.#store) {
      this.#store.delete(key);
    }
    await this.sync();
    return this.#store;
  }

  async sync() {
    await this.#ns.write(
      this.#filePath,
      JSON.stringify(this.#store, null, this.options.jsonSpaces),
      'w'
    );
  }

  get store() {
    return this.#store;
  }

  getAll() {
    return Array.from(this.#store.values());
  }

  JSON<T = any>(storage?: Map<string, T>): { [k: string]: T } {
    if (storage) {
      try {
        JSON.parse(JSON.stringify(storage));
      } catch {
        throw new Error('Storage is not valid JSON.');
      }
    }
    return Array.from(this.#store.entries()).reduce(
      (all, [k, v]) => ({ ...all, [k]: v }),
      {}
    );
  }
}

export default JsonDB;

let $ns: NS;

function bootstrap(ns: NS) {
  $ns = ns;
  $ns.disableLog('ALL');
  ns.tail();
}

export async function main(ns: NS) {
  await bootstrap(ns);
  const file = <string>$ns.args[0] || 'db.txt';
  const db = new JsonDB($ns, file);

  await db.ready;
  const data = db.JSON();
  assert(deepEqual(data, {}), 'database initialized empty');
}

function assert(outcome: boolean, description: string) {
  const result = outcome ? 'INFO pass' : 'ERROR fail';
  $ns.print(`${result}: ${description}`);
  return outcome;
}
