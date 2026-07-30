// src/lock.ts — serialize critical sections so concurrent tool calls can't
// interleave reads/writes of the same file (read-modify-write safety).
let tail: Promise<unknown> = Promise.resolve();
export function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn); // run after whatever is queued, regardless of its outcome
  tail = run.catch(() => {});    // keep the chain alive even if one section throws
  return run;
}
