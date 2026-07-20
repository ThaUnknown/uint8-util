import { xor, or, and } from '../../_node.ts'

import { SIZES, measure, run } from './_suite.ts'

function bitwise64Old (a: ArrayBufferView, b: ArrayBufferView, type: 'xor' | 'or' | 'and') {
  const byteLen = a.byteLength
  const aOff = a.byteOffset
  const bOff = b.byteOffset

  const prefix = Math.min((8 - (aOff & 7)) & 7, byteLen)

  if (prefix) {
    const aPre = new Uint8Array(a.buffer, aOff, prefix)
    const bPre = new Uint8Array(b.buffer, bOff, prefix)
    if (type === 'xor') for (let j = 0; j < prefix; j++) aPre[j]! ^= bPre[j]!
    else if (type === 'or') for (let j = 0; j < prefix; j++) aPre[j]! |= bPre[j]!
    else for (let j = 0; j < prefix; j++) aPre[j]! &= bPre[j]!
  }

  let i = prefix
  const bulk = byteLen - i
  const words = bulk >> 3
  if (words) {
    const a64 = new BigInt64Array(a.buffer, aOff + i, words)
    const b64 = new BigInt64Array(b.buffer, bOff + i, words)
    if (type === 'xor') for (let j = 0; j < words; j++) a64[j]! ^= b64[j]!
    else if (type === 'or') for (let j = 0; j < words; j++) a64[j]! |= b64[j]!
    else for (let j = 0; j < words; j++) a64[j]! &= b64[j]!
    i += words << 3
  }

  const rem = byteLen - i
  if (rem) {
    const aRem = new Uint8Array(a.buffer, aOff + i, rem)
    const bRem = new Uint8Array(b.buffer, bOff + i, rem)
    if (type === 'xor') for (let j = 0; j < rem; j++) aRem[j]! ^= bRem[j]!
    else if (type === 'or') for (let j = 0; j < rem; j++) aRem[j]! |= bRem[j]!
    else for (let j = 0; j < rem; j++) aRem[j]! &= bRem[j]!
  }

  return a
}

function xorOld<T extends Uint8Array | Int8Array | Int16Array | Uint16Array | Int32Array | Uint32Array> (a: T, b: T) {
  const length = a.length
  if (length >= 64 && ArrayBuffer.isView(a) && ArrayBuffer.isView(b) && ((a.byteOffset - b.byteOffset) & 7) === 0) {
    return bitwise64Old(a, b, 'xor') as T
  }
  for (let i = 0; i < length; i++) a[i]! ^= b[i]!
  return a
}

function orOld<T extends Uint8Array | Int8Array | Int16Array | Uint16Array | Int32Array | Uint32Array> (a: T, b: T) {
  const length = a.length
  if (length >= 64 && ArrayBuffer.isView(a) && ArrayBuffer.isView(b) && ((a.byteOffset - b.byteOffset) & 7) === 0) {
    return bitwise64Old(a, b, 'or') as T
  }
  for (let i = 0; i < length; i++) a[i]! |= b[i]!
  return a
}

function andOld<T extends Uint8Array | Int8Array | Int16Array | Uint16Array | Int32Array | Uint32Array> (a: T, b: T) {
  const length = a.length
  if (length >= 64 && ArrayBuffer.isView(a) && ArrayBuffer.isView(b) && ((a.byteOffset - b.byteOffset) & 7) === 0) {
    return bitwise64Old(a, b, 'and') as T
  }
  for (let i = 0; i < length; i++) a[i]! &= b[i]!
  return a
}

const pairs = new Map<number, [Uint8Array, Uint8Array]>()
function getPair (size: number): [Uint8Array, Uint8Array] {
  let p = pairs.get(size)
  if (!p) {
    const a = new Uint8Array(size)
    const b = new Uint8Array(size)
    for (let i = 0; i < size; i++) { a[i] = i & 0xff; b[i] = (~i) & 0xff }
    p = [a, b]
    pairs.set(size, p)
  }
  return [new Uint8Array(p[0]), new Uint8Array(p[1])]
}

function getUnalignedPair (size: number, offA = 1, offB = 2): [Uint8Array, Uint8Array] {
  const [a, b] = getPair(size)
  const maxOff = Math.max(offA, offB)
  const buf = new ArrayBuffer(size + maxOff + 8)
  const aU = new Uint8Array(buf, offA, size); aU.set(a)
  const bU = new Uint8Array(buf, offB, size); bU.set(b)
  return [aU, bU]
}

function xorByteBack (a: Uint8Array, b: Uint8Array): void {
  for (let len = a.length; len--;) a[len]! ^= b[len]!
}

function xor32 (a: Uint8Array, b: Uint8Array): void {
  if (a.byteOffset % 4 === 0 && b.byteOffset % 4 === 0) {
    const a32 = new Uint32Array(a.buffer, a.byteOffset, a.byteLength >> 2)
    const b32 = new Uint32Array(b.buffer, b.byteOffset, b.byteLength >> 2)
    for (let i = 0; i < a32.length; i++) a32[i]! ^= b32[i]!
    const off = a32.length << 2
    for (let i = off; i < a.length; i++) a[i]! ^= b[i]!
  } else {
    for (let i = 0; i < a.length; i++) a[i]! ^= b[i]!
  }
}

function xorByteForward (a: Uint8Array, b: Uint8Array): void {
  for (let i = 0; i < a.length; i++) a[i]! ^= b[i]!
}

function xorBigOp (a: Uint8Array, b: Uint8Array): void {
  const byteLen = a.byteLength
  let i = 0
  while (i < byteLen && (((a.byteOffset + i) & 7) | ((b.byteOffset + i) & 7))) {
    a[i]! ^= b[i]!; i++
  }
  const bulk = byteLen - i
  const words = bulk >> 3
  if (words) {
    const a64 = new BigInt64Array(a.buffer, a.byteOffset + i, words)
    const b64 = new BigInt64Array(b.buffer, b.byteOffset + i, words)
    for (let j = 0; j < words; j++) a64[j]! ^= b64[j]!
    i += words << 3
  }
  for (let j = i; j < byteLen; j++) a[j]! ^= b[j]!
}

function applyU8 (a: Uint8Array, b: Uint8Array, off: number, len: number, type: 'xor'): void {
  const av = new Uint8Array(a.buffer, a.byteOffset + off, len)
  const bv = new Uint8Array(b.buffer, b.byteOffset + off, len)
  if (type === 'xor') for (let j = 0; j < len; j++) av[j]! ^= bv[j]!
}
function applyI64 (a: Uint8Array, b: Uint8Array, off: number, count: number, type: 'xor'): void {
  const av = new BigInt64Array(a.buffer, a.byteOffset + off, count)
  const bv = new BigInt64Array(b.buffer, b.byteOffset + off, count)
  if (type === 'xor') for (let j = 0; j < count; j++) av[j]! ^= bv[j]!
}
function xorBoth (a: Uint8Array, b: Uint8Array): void {
  if (a.length >= 64 && ((a.byteOffset - b.byteOffset) & 7) === 0) {
    const byteLen = a.byteLength; const aOff = a.byteOffset; const bOff = b.byteOffset
    const prefix = Math.min((8 - (aOff & 7)) & 7, byteLen)
    if (prefix) applyU8(a, b, 0, prefix, 'xor')
    let i = prefix; const bulk = byteLen - i; const words = bulk >> 3
    if (words) { applyI64(a, b, i, words, 'xor'); i += words << 3 }
    const rem = byteLen - i
    if (rem) applyU8(a, b, i, rem, 'xor')
    return
  }
  for (let i = 0; i < a.length; i++) a[i]! ^= b[i]!
}
function applyGenOp (Arr: any, a: Uint8Array, b: Uint8Array, off: number, count: number, type: 'xor'): void {
  const av = new Arr(a.buffer, a.byteOffset + off, count)
  const bv = new Arr(b.buffer, b.byteOffset + off, count)
  if (type === 'xor') for (let j = 0; j < count; j++) av[j]! ^= bv[j]!
}
function xorGenOp (a: Uint8Array, b: Uint8Array): void {
  if (a.length >= 64 && ((a.byteOffset - b.byteOffset) & 7) === 0) {
    const byteLen = a.byteLength; const aOff = a.byteOffset; const bOff = b.byteOffset
    const prefix = Math.min((8 - (aOff & 7)) & 7, byteLen)
    if (prefix) applyGenOp(Uint8Array, a, b, 0, prefix, 'xor')
    let i = prefix; const bulk = byteLen - i; const words = bulk >> 3
    if (words) { applyGenOp(BigInt64Array, a, b, i, words, 'xor'); i += words << 3 }
    const rem = byteLen - i
    if (rem) applyGenOp(Uint8Array, a, b, i, rem, 'xor')
    return
  }
  for (let i = 0; i < a.length; i++) a[i]! ^= b[i]!
}

function measureAligned (label: string, size: number, fn: (a: Uint8Array, b: Uint8Array) => void) {
  return { name: label, ops: measure(() => { const [a, b] = getPair(size); fn(a, b) }) }
}

function measureUnaligned (label: string, size: number, fn: (a: Uint8Array, b: Uint8Array) => void, offA = 1, offB = 2) {
  return { name: label, ops: measure(() => { const [a, b] = getUnalignedPair(size, offA, offB); fn(a, b) }) }
}

const xorAlignedStrategies: Array<{ label: string, fn: (a: Uint8Array, b: Uint8Array) => void }> = [
  { label: 'lib', fn: (a, b) => { xor(a, b) } },
  { label: 'inlineAll', fn: (a, b) => { xorOld(a, b) } },
  { label: 'helpersSeparate', fn: (a, b) => { xorBoth(a, b) } },
  { label: 'applyGeneric', fn: (a, b) => { xorGenOp(a, b) } },
  { label: 'byteBack', fn: xorByteBack },
  { label: 'byteFwd', fn: xorByteForward },
  { label: 'bigOp', fn: xorBigOp }
]

const xorUnalignedVariants: Array<{ label: string, offA: number, offB: number }> = [
  { label: 'align4 (off 0,4)', offA: 0, offB: 4 },
  { label: 'align2 (off 0,2)', offA: 0, offB: 2 },
  { label: 'unalign1 (off 1,1)', offA: 1, offB: 1 },
  { label: 'unalign2 (off 1,2)', offA: 1, offB: 2 },
  { label: 'unalign3 (off 3,7)', offA: 3, offB: 7 }
]

export async function benchBitwise () {
  for (const size of SIZES) {
    const xorAligned: Array<{ name: string, ops: number }> = []

    for (const s of xorAlignedStrategies) {
      xorAligned.push(measureAligned(`xor ${s.label}`, size, s.fn))
    }

    if (size >= 4) {
      xorAligned.push(measureAligned('xor 32bit', size, xor32))
    }

    run(`xor aligned ${size}B`, xorAligned)

    if (size >= 8) {
      for (const v of xorUnalignedVariants) {
        const xorUnaligned: Array<{ name: string, ops: number }> = []
        xorUnaligned.push(measureUnaligned(`xor lib ${v.label}`, size, (a, b) => { xor(a, b) }, v.offA, v.offB))
        xorUnaligned.push(measureUnaligned(`xor bigOp ${v.label}`, size, xorBigOp, v.offA, v.offB))
        xorUnaligned.push(measureUnaligned(`xor applyGeneric ${v.label}`, size, xorGenOp, v.offA, v.offB))
        xorUnaligned.push(measureUnaligned(`xor helpersSeparate ${v.label}`, size, xorBoth, v.offA, v.offB))
        xorUnaligned.push(measureUnaligned(`xor inlineAll ${v.label}`, size, xorOld, v.offA, v.offB))
        xorUnaligned.push(measureUnaligned(`xor byteFwd ${v.label}`, size, xorByteForward, v.offA, v.offB))
        xorUnaligned.push(measureUnaligned(`xor byteBack ${v.label}`, size, xorByteBack, v.offA, v.offB))
        xorUnaligned.push(measureUnaligned(`xor 32bit ${v.label}`, size, xor32, v.offA, v.offB))
        run(`xor unaligned ${v.label} ${size}B`, xorUnaligned)
      }
    }

    run(`or aligned ${size}B`, [
      measureAligned('or lib', size, (a, b) => { or(a, b) }),
      measureAligned('or old', size, (a, b) => { orOld(a, b) })
    ])

    run(`and aligned ${size}B`, [
      measureAligned('and lib', size, (a, b) => { and(a, b) }),
      measureAligned('and old', size, (a, b) => { andOld(a, b) })
    ])
  }
}
