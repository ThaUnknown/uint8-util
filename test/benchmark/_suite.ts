export const SIZES: number[] = []
for (let s = 32; s <= 65536; s *= 2) SIZES.push(s)

export function measure (fn: () => void, samples = 10, minDuration = 30): number {
  for (let i = 0; i < 2; i++) fn()

  let batch = 1
  let elapsed = 0
  do {
    batch *= 2
    const start = performance.now()
    for (let i = 0; i < batch; i++) fn()
    elapsed = performance.now() - start
  } while (elapsed < minDuration)

  const total = batch * samples
  const start = performance.now()
  for (let i = 0; i < total; i++) fn()
  const elapsedMs = performance.now() - start
  return (total / elapsedMs) * 1000
}

export async function measureAsync (fn: () => Promise<void>, samples = 3, minDuration = 10): Promise<number> {
  for (let i = 0; i < 2; i++) await fn()

  let batch = 1
  let elapsed = 0
  do {
    batch *= 2
    const start = performance.now()
    for (let i = 0; i < batch; i++) await fn()
    elapsed = performance.now() - start
  } while (elapsed < minDuration)

  const total = batch * samples
  const start = performance.now()
  for (let i = 0; i < total; i++) await fn()
  const elapsedMs = performance.now() - start
  return (total / elapsedMs) * 1000
}

export function run (label: string, results: Array<{ name: string, ops: number }>) {
  console.log(`\n# ${label}`)
  results.sort((a, b) => b.ops - a.ops)
  const best = results[0].ops
  for (const { name, ops } of results) {
    const pct = ((ops / best) * 100).toFixed(1)
    console.log(`  ${name.padEnd(52)} ${String(Math.round(ops)).padStart(12)} ops/sec  ${pct}%`)
  }
}

const cache = new Map<number, Uint8Array>()

export function getData (size: number): Uint8Array {
  if (!cache.has(size)) {
    const arr = new Uint8Array(size)
    for (let i = 0; i < size; i++) arr[i] = (Math.random() * 256) | 0
    cache.set(size, arr)
  }
  return cache.get(size)!
}

export function getText (size: number): string {
  let s = ''
  for (let i = 0; i < size; i++) s += String.fromCharCode(0x20 + (i % 0x5f))
  return s
}

export function getBinaryString (size: number): string {
  let s = ''
  for (let i = 0; i < size; i++) s += String.fromCharCode((Math.random() * 256) | 0)
  return s
}
