/* eslint-disable @typescript-eslint/no-non-null-assertion */
export type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  // | BigInt64Array
  // | BigUint64Array

type ByteArray = Uint8Array | number[]

export type Encoding = 'utf-8' | 'utf-16le' | 'latin1' | 'ascii'
export type HashType = 'hex' | 'base64'
export type HashAlgo = 'sha-1' | 'sha-256' | 'sha-384' | 'sha-512'

export const alphabet = '0123456789abcdef'
export const encodeLookup: string[] = []
const decodeLookup: number[] = []

for (let i = 0; i < 256; i++) {
  encodeLookup[i] = alphabet[i >> 4 & 0xf]! + alphabet[i & 0xf]!
  if (i < 16) {
    if (i < 10) {
      decodeLookup[0x30 + i] = i
    } else {
      decodeLookup[0x61 - 10 + i] = i
    }
  }
}

export const arr2hex = (data: ByteArray) => {
  const length = data.length
  let string = ''
  let i = 0
  while (i + 2 <= length) {
    string += encodeLookup[data[i++]!]! + encodeLookup[data[i++]!]!
  }
  while (i < length) {
    string += encodeLookup[data[i++]!]!
  }
  return string
}

export const hex2arr = (str: string) => {
  const len = str.length
  const out = new Uint8Array(len >> 1)
  let j = 0
  let i = 0
  while (i + 8 <= len) {
    out[j++] = (decodeLookup[str.charCodeAt(i++)]! << 4) | decodeLookup[str.charCodeAt(i++)]!
    out[j++] = (decodeLookup[str.charCodeAt(i++)]! << 4) | decodeLookup[str.charCodeAt(i++)]!
    out[j++] = (decodeLookup[str.charCodeAt(i++)]! << 4) | decodeLookup[str.charCodeAt(i++)]!
    out[j++] = (decodeLookup[str.charCodeAt(i++)]! << 4) | decodeLookup[str.charCodeAt(i++)]!
  }
  while (i < len) {
    out[j++] = (decodeLookup[str.charCodeAt(i++)]! << 4) | decodeLookup[str.charCodeAt(i++)]!
  }
  return out
}

export function concat <T extends Array<ArrayLike<number>>> (chunks: T, size = 0) {
  const length = chunks.length
  if (!size) for (let i = 0; i < length; i++) size += chunks[i]!.length
  const b = new Uint8Array(size)
  let offset = 0
  for (let i = 0; i < length; i++) {
    b.set(chunks[i]!, offset)
    offset += chunks[i]!.length
  }
  return b
}

export function equal (a: ByteArray, b: ByteArray) {
  if (a.length !== b.length) return false
  if (a.length <= 128 || !ArrayBuffer.isView(a) || !ArrayBuffer.isView(b)) {
    for (let i = a.length - 1; i > -1; --i) if (a[i] !== b[i]) return false
    return true
  }
  const aOff = a.byteOffset
  const bOff = b.byteOffset

  let i = 0
  if (((aOff) & 7) | ((bOff) & 7)) {
    const a8 = new Uint8Array(a.buffer, aOff, a.length)
    const b8 = new Uint8Array(b.buffer, bOff, b.length)
    while (i < a.length && (((aOff + i) & 7) | ((bOff + i) & 7))) {
      if (a8[i] !== b8[i]) return false; i++
    }
  }

  const words = (a.length - i) >> 3
  if (words) {
    const a64 = new BigInt64Array(a.buffer, aOff + i, words)
    const b64 = new BigInt64Array(b.buffer, bOff + i, words)
    for (let j = 0; j < words; j++) if (a64[j] !== b64[j]) return false
    i += words << 3
  }

  const rem = a.length - i
  if (rem) {
    const a8 = new Uint8Array(a.buffer, aOff + i, rem)
    const b8 = new Uint8Array(b.buffer, bOff + i, rem)
    for (let k = 0; k < rem; k++) if (a8[k] !== b8[k]) return false
  }
  return true
}

export function compare (a: ByteArray, b: ByteArray) {
  const len = Math.min(a.length, b.length)
  if (len <= 128 || !ArrayBuffer.isView(a) || !ArrayBuffer.isView(b)) {
    for (let i = 0; i < len; i++) if (a[i] !== b[i]) return a[i]! - b[i]!
    return a.length - b.length
  }
  const aOff = a.byteOffset
  const bOff = b.byteOffset

  let i = 0
  if (((aOff) & 7) | ((bOff) & 7)) {
    const a8 = new Uint8Array(a.buffer, aOff, len)
    const b8 = new Uint8Array(b.buffer, bOff, len)
    while (i < len && (((aOff + i) & 7) | ((bOff + i) & 7))) {
      if (a8[i] !== b8[i]) return a8[i]! - b8[i]!; i++
    }
  }

  const words = (len - i) >> 3
  if (words) {
    const a64 = new BigInt64Array(a.buffer, aOff + i, words)
    const b64 = new BigInt64Array(b.buffer, bOff + i, words)
    for (let j = 0; j < words; j++) {
      if (a64[j] !== b64[j]) {
        const o = i + (j << 3)
        const av = new Uint8Array(a.buffer, aOff + o, 8)
        const bv = new Uint8Array(b.buffer, bOff + o, 8)
        for (let k = 0; k < 8; k++) if (av[k] !== bv[k]) return av[k]! - bv[k]!
      }
    }
    i += words << 3
  }

  const rem = len - i
  if (rem) {
    const a8 = new Uint8Array(a.buffer, aOff + i, rem)
    const b8 = new Uint8Array(b.buffer, bOff + i, rem)
    for (let k = 0; k < rem; k++) if (a8[k] !== b8[k]) return a8[k]! - b8[k]!
  }
  return a.length - b.length
}

function bitwise64 (a: ArrayBufferView, b: ArrayBufferView, type: 'xor' | 'or' | 'and') {
  const byteLen = a.byteLength
  const aOff = a.byteOffset
  const bOff = b.byteOffset

  let i = 0
  if (aOff & 7) {
    const a8 = new Uint8Array(a.buffer, aOff, byteLen)
    const b8 = new Uint8Array(b.buffer, bOff, byteLen)
    const prefix = Math.min((8 - (aOff & 7)) & 7, byteLen)
    if (type === 'xor') for (let j = 0; j < prefix; j++) a8[j]! ^= b8[j]!
    else if (type === 'or') for (let j = 0; j < prefix; j++) a8[j]! |= b8[j]!
    else for (let j = 0; j < prefix; j++) a8[j]! &= b8[j]!
    i += prefix
  }

  const words = (byteLen - i) >> 3
  const a64 = new BigInt64Array(a.buffer, aOff + i, words)
  const b64 = new BigInt64Array(b.buffer, bOff + i, words)
  let j = 0
  if (type === 'xor') {
    while (j + 4 <= words) { a64[j]! ^= b64[j]!; a64[j + 1]! ^= b64[j + 1]!; a64[j + 2]! ^= b64[j + 2]!; a64[j + 3]! ^= b64[j + 3]!; j += 4 }
    while (j < words) a64[j]! ^= b64[j++]!
  } else if (type === 'or') {
    while (j + 4 <= words) { a64[j]! |= b64[j]!; a64[j + 1]! |= b64[j + 1]!; a64[j + 2]! |= b64[j + 2]!; a64[j + 3]! |= b64[j + 3]!; j += 4 }
    while (j < words) a64[j]! |= b64[j++]!
  } else {
    while (j + 4 <= words) { a64[j]! &= b64[j]!; a64[j + 1]! &= b64[j + 1]!; a64[j + 2]! &= b64[j + 2]!; a64[j + 3]! &= b64[j + 3]!; j += 4 }
    while (j < words) a64[j]! &= b64[j++]!
  }
  i += words << 3

  const rem = byteLen - i
  if (rem) {
    const a8 = new Uint8Array(a.buffer, aOff + i, rem)
    const b8 = new Uint8Array(b.buffer, bOff + i, rem)
    if (type === 'xor') for (let k = 0; k < rem; k++) a8[k]! ^= b8[k]!
    else if (type === 'or') for (let k = 0; k < rem; k++) a8[k]! |= b8[k]!
    else for (let k = 0; k < rem; k++) a8[k]! &= b8[k]!
  }
  return a
}

export function xor (a: ByteArray, b: ByteArray) {
  const length = a.length
  if (length >= 128 && ArrayBuffer.isView(a) && ArrayBuffer.isView(b) && ((a.byteOffset - b.byteOffset) & 7) === 0) {
    return bitwise64(a, b, 'xor')
  }

  for (let i = 0; i < length; i++) a[i]! ^= b[i]!
  return a
}

export function or (a: ByteArray, b: ByteArray) {
  const length = a.length
  if (length >= 128 && ArrayBuffer.isView(a) && ArrayBuffer.isView(b) && ((a.byteOffset - b.byteOffset) & 7) === 0) {
    return bitwise64(a, b, 'or')
  }

  for (let i = 0; i < length; i++) a[i]! |= b[i]!
  return a
}

export function and (a: ByteArray, b: ByteArray) {
  const length = a.length
  if (length >= 128 && ArrayBuffer.isView(a) && ArrayBuffer.isView(b) && ((a.byteOffset - b.byteOffset) & 7) === 0) {
    return bitwise64(a, b, 'and')
  }

  for (let i = 0; i < length; i++) a[i]! &= b[i]!
  return a
}
