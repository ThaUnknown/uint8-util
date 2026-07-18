import { arr2hex, hex2arr, encodeLookup, type Encoding, type HashType, type HashAlgo } from './util.ts'

const decoder = new TextDecoder()
export const arr2text = (data: AllowSharedBufferSource, enc?: Encoding) => {
  if (!enc) return decoder.decode(data)
  const dec = new TextDecoder(enc)
  return dec.decode(data)
}

const encoder = new TextEncoder()
export const text2arr = (str: string) => encoder.encode(str)

export const arr2base = (data: ArrayBufferView<ArrayBuffer>) => {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  const len = bytes.length
  if (len <= MAX_ARGUMENTS_LENGTH) return btoa(String.fromCharCode.apply(null, bytes as unknown as number[]))
  let binary = ''
  let i = 0
  while (i < len) {
    const end = Math.min(i + MAX_ARGUMENTS_LENGTH, len)
    binary += String.fromCharCode.apply(null, bytes.subarray(i, end) as unknown as number[])
    i = end
  }
  return btoa(binary)
}
export const base2arr = (str: string) => {
  const binary = atob(str)
  const len = binary.length
  const arr = new Uint8Array(len)
  for (let i = 0; i < len; i++) arr[i] = binary.charCodeAt(i)
  return arr
}

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
  const out = new Uint8Array(await globalThis.crypto.subtle.digest(algo, data))
  return format ? formatMap[format](out) : out
}

export const randomBytes = (size: number) => globalThis.crypto.getRandomValues(new Uint8Array(size))

export * from './util.ts'
