import type { HashType, HashAlgo, ByteArray } from './util.ts'

const alphabet = '0123456789abcdef'
const encodeLookup: string[] = []
const decodeLookup = new Uint8Array(128) // so that it's 0 initiated, so non hex characters map to 0

for (let i = 0; i < 16; ++i) {
  const i16 = i * 16
  for (let j = 0; j < 16; ++j) {
    encodeLookup[i16 + j] = alphabet[i]! + alphabet[j]!
  }
  if (i < 10) {
    decodeLookup[0x30 + i] = i // '0'-'9'
  } else {
    decodeLookup[0x61 - 10 + i] = i // 'a'-'f'
    decodeLookup[0x41 - 10 + i] = i // 'A'-'F'
  }
}

export const arr2hex = (data: ByteArray) => data.toHex()

export const hex2arr = (str: string) => {
  const len = str.length
  if (len > 64) return Uint8Array.fromHex(str)
  const out = new Uint8Array(len >> 1)
  let j = 0
  let i = 0
  while (i < len) {
    out[j++] = (decodeLookup[str.charCodeAt(i++)]! << 4) | decodeLookup[str.charCodeAt(i++)]!
  }
  return out
}

const encoder = new TextEncoder()
export const text2arr = (str: string) => encoder.encode(str)

export const arr2base = (bytes: ByteArray) => bytes.toBase64()

export const base2arr = (str: string) => Uint8Array.fromBase64(str)

export const bin2hex = (str: string) => {
  let res = ''
  let i = 0
  const len = str.length
  while (i < len) {
    res += encodeLookup[str.charCodeAt(i++)]!
  }
  return res
}

const MAX_ARGUMENTS_LENGTH = 0x10000
export const hex2bin = (hex: string) => {
  const points = hex2arr(hex)
  if (points.length <= MAX_ARGUMENTS_LENGTH) return String.fromCharCode.apply(null, points as unknown as number[])
  let res = ''
  let i = 0
  while (i < points.length) {
    res += String.fromCharCode.apply(null, points.subarray(i, i += MAX_ARGUMENTS_LENGTH) as unknown as number[])
  }
  return res
}

const formatMap = {
  hex: arr2hex,
  base64: arr2base
}

export async function hash(
  data: string | BufferSource,
  format?: undefined,
  algo?: HashAlgo
): Promise<Uint8Array<ArrayBuffer>>
export async function hash(
  data: string | BufferSource,
  format: HashType,
  algo?: HashAlgo
): Promise<string>
export async function hash (
  data: string | BufferSource,
  format?: HashType,
  algo: HashAlgo = 'sha-1'
): Promise<Uint8Array<ArrayBuffer> | string> {
  if (typeof data === 'string') data = text2arr(data)
  const out = new Uint8Array(await crypto.subtle.digest(algo, data))
  return format ? formatMap[format](out) : out
}

export const randomBytes = (size: number) => crypto.getRandomValues(new Uint8Array(size))

// there's a lot of duplicating here, but inlining matters for performance, can't really use helpers without loosing a lot
export function equal (a: ByteArray, b: ByteArray) {
  if (a.byteLength !== b.byteLength) return false
  const len = a.byteLength
  if (len < 128) {
    for (let i = 0; i < len; i++) if (a[i] !== b[i]) return false
    return true
  }

  const words = len >> 3
  if ((a.byteOffset & 7) === 0 && (b.byteOffset & 7) === 0) {
    const a64 = new BigInt64Array(a.buffer, a.byteOffset, words)
    const b64 = new BigInt64Array(b.buffer, b.byteOffset, words)
    for (let j = 0; j < words; j++) {
      if (a64[j] !== b64[j]) return false
    }
  } else {
    const dvA = new DataView(a.buffer, a.byteOffset, len)
    const dvB = new DataView(b.buffer, b.byteOffset, b.byteLength)
    for (let j = 0; j < words; j++) {
      if (dvA.getBigInt64(j << 3) !== dvB.getBigInt64(j << 3)) return false
    }
  }

  const off = words << 3
  for (let i = off; i < len; i++) if (a[i] !== b[i]) return false
  return true
}

export function compare (a: ByteArray, b: ByteArray) {
  const len = a.byteLength < b.byteLength ? a.byteLength : b.byteLength
  if (len < 128) {
    for (let i = 0; i < len; i++) if (a[i] !== b[i]) return a[i]! - b[i]!
    return a.byteLength - b.byteLength
  }

  const words = len >> 3
  if ((a.byteOffset & 7) === 0 && (b.byteOffset & 7) === 0) {
    const a64 = new BigInt64Array(a.buffer, a.byteOffset, words)
    const b64 = new BigInt64Array(b.buffer, b.byteOffset, words)
    for (let j = 0; j < words; j++) {
      if (a64[j] !== b64[j]) {
        const o = j << 3
        for (let k = 0; k < 8; k++) {
          if (a[o + k] !== b[o + k]) return a[o + k]! - b[o + k]!
        }
      }
    }
  } else {
    const dvA = new DataView(a.buffer, a.byteOffset, a.byteLength)
    const dvB = new DataView(b.buffer, b.byteOffset, b.byteLength)
    for (let j = 0; j < words; j++) {
      const o = j << 3
      if (dvA.getBigInt64(o) !== dvB.getBigInt64(o)) {
        for (let k = 0; k < 8; k++) {
          if (a[o + k] !== b[o + k]) return a[o + k]! - b[o + k]!
        }
      }
    }
  }

  for (let i = words << 3; i < len; i++) {
    if (a[i] !== b[i]) return a[i]! - b[i]!
  }
  return a.byteLength - b.byteLength
}

export * from './util.js'
