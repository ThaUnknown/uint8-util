import { createHash, randomBytes as rand } from 'node:crypto'

import type { HashType, HashAlgo, ByteArray } from './util.ts'

export const text2arr = (str: string) => {
  const buf = Buffer.from(str, 'utf8')
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

// toBase64 is faster, but >=node25
export const arr2base = (data: ArrayBufferView) => Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('base64')

export const base2arr = (str: string) => {
  const buf = Buffer.from(str, 'base64')
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

export const arr2hex = (data: ArrayBufferView) => Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('hex')

export const hex2arr = (str: string) => {
  const buf = Buffer.from(str, 'hex')
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

export const hex2bin = (hex: string) => Buffer.from(hex, 'hex').toString('binary')

export const bin2hex = (bin: string) => Buffer.from(bin, 'binary').toString('hex')

export async function hash(
  data: string | NodeJS.ArrayBufferView,
  format?: undefined,
  algo?: HashAlgo
): Promise<Uint8Array>
export async function hash(
  data: string | NodeJS.ArrayBufferView,
  format: HashType,
  algo?: HashAlgo
): Promise<string>
export async function hash (
  data: string | NodeJS.ArrayBufferView,
  format?: HashType,
  algo = 'sha1'
): Promise<Uint8Array | string> {
  algo = algo.replace('sha-', 'sha')
  if (data instanceof ArrayBuffer) data = new Uint8Array(data)
  const out = createHash(algo).update(data)
  if (format) return out.digest(format)
  const res = out.digest()
  return new Uint8Array(res.buffer, res.byteOffset, res.byteLength)
}

export const randomBytes = (size: number) => new Uint8Array(rand(size))

export function compare (a: ByteArray, b: ByteArray) {
  const min = Math.min(a.byteLength, b.byteLength)
  if (min < 128) {
    for (let i = min - 1; i > -1; --i) if (a[i] !== b[i]) return a[i]! - b[i]!
    return 0
  }
  return Buffer.compare(a, b)
}

export function equal (a: ByteArray, b: ByteArray) {
  if (a.byteLength !== b.byteLength) return false
  if (a.byteLength < 256) {
    for (let i = a.byteLength - 1; i > -1; --i) if (a[i] !== b[i]) return false
    return true
  }
  return Buffer.compare(a, b) === 0
}

export * from './util.js'
