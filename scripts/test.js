import JSONdb from '/jsondb.js';

export async function main(ns) {
  const db = new JSONdb(ns, 'db.txt', { target: 'home' });

  await db.set('test', { x: 1 });

  ns.tprint(db.get('test'));
}
