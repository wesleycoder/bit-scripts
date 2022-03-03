// deno-lint-ignore-file no-explicit-any
export async function sequence<T>(
  items: T[],
  fn: (i: T, ...args: any[]) => any,
  ...args: any[]
) {
  const results = [];

  for (const item of items) {
    results.push(await fn(item, ...args));
  }

  return results;
}
