/** Shared deterministic “random” picks for demo replies (same input → same variant per turn). */

export function hash32(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h >>> 0
}

export function pick<T>(items: readonly T[], seed: number): T {
  return items[seed % items.length]!
}

export function seedFrom(turnIndex: number, userText: string): number {
  return (hash32(userText) + turnIndex * 10007) >>> 0
}

export function subSeed(seed: number, salt: number): number {
  return (seed + salt * 2654435761) >>> 0
}
