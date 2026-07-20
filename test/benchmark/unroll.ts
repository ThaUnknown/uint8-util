import { arr2hex, compare, xor } from '../../_node.ts'

import { SIZES, measure, run, getData } from './_suite.ts'

const encodeLookup: string[] = []
const alphabet = '0123456789abcdef'
for (let i = 0; i < 256; i++) encodeLookup[i] = alphabet[i >> 4 & 0xf] + alphabet[i & 0xf]



function cp (size: number): Uint8Array { return Uint8Array.from(getData(size)) }
function cp2 (size: number): [Uint8Array, Uint8Array] { return [cp(size), cp(size)] }

function compareInline (a: Uint8Array, b: Uint8Array): number {
  const minLen = Math.min(a.length, b.length)
  if (minLen > 512 && (a.byteOffset & 7) === 0 && (b.byteOffset & 7) === 0) {
    const byteLen = Math.min(a.byteLength, b.byteLength)
    const words = byteLen >> 3
    if (words) {
      const a64 = new BigInt64Array(a.buffer, a.byteOffset, words)
      const b64 = new BigInt64Array(b.buffer, b.byteOffset, words)
      for (let i = 0; i < words; i++) {
        if (a64[i] !== b64[i]) {
          const o = i << 3
          const a8 = new Uint8Array(a.buffer, a.byteOffset + o, 8)
          const b8 = new Uint8Array(b.buffer, b.byteOffset + o, 8)
          for (let j = 0; j < 8; j++) { if (a8[j] !== b8[j]) return a8[j] - b8[j] }
        }
      }
    }
    const tailOff = words << 3
    const rem = byteLen - tailOff
    if (rem) {
      const a8 = new Uint8Array(a.buffer, a.byteOffset + tailOff, rem)
      const b8 = new Uint8Array(b.buffer, b.byteOffset + tailOff, rem)
      for (let i = 0; i < rem; i++) { if (a8[i] !== b8[i]) return a8[i] - b8[i] }
    }
    return a.length - b.length
  }
  for (let i = 0; i < minLen; i++) { if (a[i] !== b[i]) return a[i] - b[i] }
  return a.length - b.length
}

function xorUnroll4 (a: Uint8Array, b: Uint8Array): Uint8Array {
  const byteLen = a.byteLength
  const words = byteLen >> 3
  if (words) {
    const a64 = new BigInt64Array(a.buffer, a.byteOffset, words)
    const b64 = new BigInt64Array(b.buffer, b.byteOffset, words)
    let i = 0
    while (i + 4 <= words) {
      a64[i] ^= b64[i]; a64[i + 1] ^= b64[i + 1]
      a64[i + 2] ^= b64[i + 2]; a64[i + 3] ^= b64[i + 3]
      i += 4
    }
    while (i < words) a64[i] ^= b64[i++]
  }
  const rem = byteLen - (words << 3)
  if (rem) {
    const a8 = new Uint8Array(a.buffer, a.byteOffset + (words << 3), rem)
    const b8 = new Uint8Array(b.buffer, b.byteOffset + (words << 3), rem)
    let j = 0; while (j < rem) a8[j] ^= b8[j++]
  }
  return a
}

export async function benchUnroll () {
  for (const size of SIZES) {
    const results: Array<{ name: string, ops: number }> = []

    results.push({ name: `arr2hex original   ${size}B`, ops: measure(() => arr2hex(cp(size))) })
    results.push({
      name: `arr2hex simple     ${size}B`,
      ops: measure(() => {
        const d = cp(size); const len = d.length; let s = ''
        for (let i = 0; i < len; ++i) s += encodeLookup[d[i]!]!
        return s
      })
    })
    results.push({
      name: `arr2hex unroll2    ${size}B`,
      ops: measure(() => {
        const d = cp(size); const len = d.length; let s = ''; let i = 0
        while (i + 2 <= len) {
          s += encodeLookup[d[i++]] + encodeLookup[d[i++]]
        }
        while (i < len) s += encodeLookup[d[i++]]
        return s
      })
    })
    results.push({
      name: `arr2hex unroll4    ${size}B`,
      ops: measure(() => {
        const d = cp(size); const len = d.length; let s = ''; let i = 0
        while (i + 4 <= len) {
          s += encodeLookup[d[i++]] + encodeLookup[d[i++]] + encodeLookup[d[i++]] + encodeLookup[d[i++]]
        }
        while (i < len) s += encodeLookup[d[i++]]
        return s
      })
    })

    const [a1, b1] = cp2(size)
    results.push({ name: `compare library    ${size}B`, ops: measure(() => compare(a1, b1)) })
    const [a2, b2] = cp2(size)
    results.push({ name: `compare inlined    ${size}B`, ops: measure(() => compareInline(a2, b2)) })

    if (size >= 128) {
      const [a3, b3] = cp2(size)
      results.push({ name: `xor library       ${size}B`, ops: measure(() => { xor(a3, b3); return a3 }) })
      const [a4, b4] = cp2(size)
      results.push({ name: `xor unroll4       ${size}B`, ops: measure(() => { xorUnroll4(a4, b4); return a4 }) })
    }

    if (size >= 256) {
      const [a5, b5] = cp2(size)
      const maxOff = 8
      const buf = new ArrayBuffer(size + maxOff + 8)
      const aU = new Uint8Array(buf, 1, size); aU.set(a5)
      const bU = new Uint8Array(buf, 2, size); bU.set(b5)
      results.push({ name: `xor library unal  ${size}B`, ops: measure(() => { xor(aU, bU); return aU }) })
      const buf2 = new ArrayBuffer(size + maxOff + 8)
      const aU2 = new Uint8Array(buf2, 1, size); aU2.set(cp(size))
      const bU2 = new Uint8Array(buf2, 2, size); bU2.set(cp(size))
      let threw = false
      try { xorUnroll4(aU2, bU2) } catch { threw = true }
      if (!threw) {
        results.push({ name: `xor unroll4 unal  ${size}B`, ops: measure(() => { xorUnroll4(aU2, bU2); return aU2 }) })
      }
    }

    run(`unroll ${size}B`, results)
  }
}
