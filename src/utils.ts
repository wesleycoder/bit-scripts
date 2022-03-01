export async function sequence(
  items: any[],
  fn: (...args: any[]) => any,
  ...args: any[]
) {
  let results = [];
  for (const item of items) {
    results.push(await fn(item, ...args));
  }
  return results;
}
