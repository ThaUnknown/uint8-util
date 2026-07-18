import { createHash, randomBytes as rand } from 'node:crypto'

import type { Encoding, HashType, HashAlgo, TypedArray } from './util.ts'

const decoder = new TextDecoder()
export const arr2text = (data: ArrayBuffer | Uint8Array, enc?: Encoding): string => {
  if (!enc) return decoder.decode(data)
  const dec = new TextDecoder(enc)
  return dec.decode(data)
}

export const text2arr = (str: string) => new Uint8Array(Buffer.from(str, 'utf8'))

export const arr2base = (data: TypedArray) => Buffer.from(data).toString('base64')

export const base2arr = (str: string) => new Uint8Array(Buffer.from(str, 'base64'))

export const hex2bin = (hex: string) => Buffer.from(hex, 'hex').toString('binary')

export const bin2hex = (bin: string) => Buffer.from(bin, 'binary').toString('hex')

export async function hash(
  data: string | TypedArray | ArrayBuffer | DataView,
  format?: undefined,
  algo?: HashAlgo
): Promise<Uint8Array>
export async function hash(
  data: string | TypedArray | ArrayBuffer | DataView,
  format: HashType,
  algo?: HashAlgo
): Promise<string>
export async function hash (
  data: string | TypedArray | ArrayBuffer | DataView,
  format?: HashType,
  algo = 'sha1'
): Promise<Uint8Array | string> {
  algo = algo.replace('sha-', 'sha')
  if (data instanceof ArrayBuffer) data = new Uint8Array(data)
  const out = createHash(algo).update(data)
  return format ? out.digest(format) : new Uint8Array(out.digest().buffer)
}

export const randomBytes = (size: number) => new Uint8Array(rand(size))

export * from './util.ts'
