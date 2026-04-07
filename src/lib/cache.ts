import { unstable_cache } from 'next/cache'

/**
 * Wrap a database function with Next.js unstable_cache.
 * The cached result is shared across all requests for the same inputs.
 * Cache is invalidated by calling revalidatePath() or revalidateTag().
 *
 * Usage:
 *   const getCachedProfile = cacheWithProfile(getProfile, ['profile'], ['profile'])
 *   const profile = await getCachedProfile(userId)
 */

// ─── Helpers typed cache factories ────────────────────────────────────────────

/**
 * Cache a function that takes a single argument.
 */
export function cache1<T, R>(
  fn: (arg: T) => Promise<R>,
  keyParts: string[],
  tags: string[] = [],
): (arg: T) => Promise<R> {
  return unstable_cache(fn, keyParts, { tags, revalidate: 3600 })
}

/**
 * Cache a function that takes no arguments.
 */
export function cache0<R>(
  fn: () => Promise<R>,
  keyParts: string[],
  tags: string[] = [],
  revalidateSeconds?: number,
): () => Promise<R> {
  return unstable_cache(fn, keyParts, { tags, revalidate: revalidateSeconds ?? 3600 })
}

/**
 * Cache a function that takes two arguments.
 */
export function cache2<T1, T2, R>(
  fn: (a: T1, b: T2) => Promise<R>,
  keyParts: string[],
  tags: string[] = [],
  revalidateSeconds?: number,
): (a: T1, b: T2) => Promise<R> {
  return unstable_cache(fn, keyParts, { tags, revalidate: revalidateSeconds ?? 3600 })
}

/**
 * Cache a function that takes three arguments.
 */
export function cache3<T1, T2, T3, R>(
  fn: (a: T1, b: T2, c: T3) => Promise<R>,
  keyParts: string[],
  tags: string[] = [],
  revalidateSeconds?: number,
): (a: T1, b: T2, c: T3) => Promise<R> {
  return unstable_cache(fn, keyParts, { tags, revalidate: revalidateSeconds ?? 3600 })
}
