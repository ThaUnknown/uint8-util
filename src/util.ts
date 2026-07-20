/* eslint-disable @typescript-eslint/no-non-null-assertion */
export type ByteArray = Buffer | Uint8Array

type Encoding = 'utf-8' | 'utf-16le' | 'ascii'
export type HashType = 'hex' | 'base64'
export type HashAlgo = 'sha-1' | 'sha-256' | 'sha-384' | 'sha-512'

const decoder = new TextDecoder()
export const arr2text = (data: AllowSharedBufferSource, enc?: Encoding): string => {
  if (!enc) return decoder.decode(data)
  const dec = new TextDecoder(enc)
  return dec.decode(data)
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

function bitwise64 (a: ByteArray, b: ByteArray, type: 'xor' | 'or' | 'and') {
  const byteLen = a.byteLength
  const aOff = a.byteOffset
  const bOff = b.byteOffset

  let i = 0
  if (aOff & 7) {
    const prefix = Math.min((8 - (aOff & 7)) & 7, byteLen)
    if (type === 'xor') for (let j = 0; j < prefix; j++) a[j]! ^= b[j]!
    else if (type === 'or') for (let j = 0; j < prefix; j++) a[j]! |= b[j]!
    else for (let j = 0; j < prefix; j++) a[j]! &= b[j]!
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
    if (type === 'xor') for (let k = 0; k < rem; k++) a[i + k]! ^= b[i + k]!
    else if (type === 'or') for (let k = 0; k < rem; k++) a[i + k]! |= b[i + k]!
    else for (let k = 0; k < rem; k++) a[i + k]! &= b[i + k]!
  }
  return a
}

export function xor (a: ByteArray, b: ByteArray) {
  const length = a.length
  if (length >= 128 && ((a.byteOffset - b.byteOffset) & 7) === 0) {
    return bitwise64(a, b, 'xor')
  }

  for (let i = 0; i < length; i++) a[i]! ^= b[i]!
  return a
}

export function or (a: ByteArray, b: ByteArray) {
  const length = a.length
  if (length >= 128 && ((a.byteOffset - b.byteOffset) & 7) === 0) {
    return bitwise64(a, b, 'or')
  }

  for (let i = 0; i < length; i++) a[i]! |= b[i]!
  return a
}

export function and (a: ByteArray, b: ByteArray) {
  const length = a.length
  if (length >= 128 && ((a.byteOffset - b.byteOffset) & 7) === 0) {
    return bitwise64(a, b, 'and')
  }

  for (let i = 0; i < length; i++) a[i]! &= b[i]!
  return a
}
