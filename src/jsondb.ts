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

export class JsonDB extends EventTarget {
  #ns: NS;

  #initilized = new Promise((resolve, reject) => {
    this.addEventListener('JsonDb#initialized', resolve);
    this.addEventListener('JsonDb#failed', reject);
  });

  #storage: { [s: string]: any } = {};
  #filePath: string;

  options: DBOptions = {};

  constructor(ns: NS, filePath: string, options: DBOptions = {}) {
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
      this.#ns.toast(`Creating file "${this.#filePath}"`);
      this.#ns
        .write(this.#filePath, '{}', 'w')
        .then(() => this.dispatchEvent(new Event('JsonDb#initialized')))
        .catch(() => this.dispatchEvent(new Event('JsonDb#failed')));
    } else if (this.options.resetOnInit) {
      this.#ns.toast(`Resetting db "${this.#filePath}"`);
      this.sync();
    } else {
      const value = this.#ns.read(this.#filePath);
      this.#storage = JSON.parse(value);
    }
    this.dispatchEvent(new Event('JsonDb#initialized'));
  }

  init() {
    return this.#initilized;
  }

  async set(key: string, value: any) {
    this.#storage[key] = value;
    if (this.options?.syncOnWrite) await this.sync();
  }

  get(key: string) {
    return this.#storage.hasOwnProperty(key) ? this.#storage[key] : undefined;
  }

  has(key: string) {
    return this.#storage.hasOwnProperty(key);
  }

  async delete(key: string) {
    const retVal = this.#storage.hasOwnProperty(key)
      ? delete this.#storage[key]
      : undefined;
    if (this.options && this.options.syncOnWrite) await this.sync();
    return retVal;
  }

  async deleteAll() {
    await Promise.all(Object.keys(this.#storage).map(this.delete));
    return this.JSON();
  }

  async sync() {
    try {
      // this.#ns.tprint(this.#storage);
      await this.#ns.write(
        this.#filePath,
        JSON.stringify(this.#storage, null, this.options.jsonSpaces),
        'w'
      );
    } catch (err) {
      throw new Error(
        `Error while writing to path "${this.#filePath}": ${JSON.stringify(
          err
        )}`
      );
    }
  }

  JSON<T = any>(storage = null): { [s: string]: T } {
    if (storage) {
      try {
        JSON.parse(JSON.stringify(storage));
        this.#storage = storage;
      } catch {
        throw new Error('Given storage is not valid JSON.');
      }
    }
    return JSON.parse(JSON.stringify(this.#storage));
  }
}

export default JsonDB;

export async function main(ns: NS) {
  const file = <string>ns.args[0] || './db.txt';
  const db = new JsonDB(ns, file);
  await db.init();
}
