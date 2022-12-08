import { arr2hex } from './util.js'
import { decode, encode } from 'base64-arraybuffer'

const decoder = new TextDecoder()
// 50% slower at < 48 chars, but little impact at 4M OPS/s vs 8M OPS/s
export const arr2text = (buffer) => {
  return decoder.decode(buffer)
}

// sacrifice ~20% speed for bundle size
const encoder = new TextEncoder()
export const text2arr = string => {
  return encoder.encode(string)
}

export const arr2base = buffer => {
  return encode(buffer)
}

export const base2arr = str => {
  return new Uint8Array(decode(str))
}

const scope = typeof window !== 'undefined' ? window : self
const crypto = scope.crypto || scope.msCrypto || {}
const subtle = crypto.subtle || crypto.webkitSubtle

const formatMap = {
  hex: arr2hex,
  base64: arr2base
}

export const hash = async (data, format, algo = 'sha-1') => {
  if (!subtle) throw new Error('no web crypto support')
  if (typeof data === 'string') data = text2arr(data)
  const out = new Uint8Array(await subtle.digest(algo, data))
  return format ? formatMap[format](out) : out
}

export * from './util.js'
