import { arr2hex, alphabet } from './util.js'
import { decode, encode } from 'base64-arraybuffer'

const decoder = new TextDecoder()
// 50% slower at < 48 chars, but little impact at 4M OPS/s vs 8M OPS/s
export const arr2text = (data, enc) => {
  if (!enc) return decoder.decode(data)
  const dec = new TextDecoder(enc)
  return dec.decode(data)
}

// sacrifice ~20% speed for bundle size
const encoder = new TextEncoder()
export const text2arr = str => encoder.encode(str)

export const arr2base = data => encode(data)

export const base2arr = str => new Uint8Array(decode(str))

export const bin2hex = str => {
  let res = ''
  let c
  let i = 0
  const len = str.length

  while (i < len) {
    c = str.charCodeAt(i++)
    res += alphabet[c >> 4]
    res += alphabet[c & 0xF]
  }

  return res
}

const MAX_ARGUMENTS_LENGTH = 0x10000
export const hex2bin = hex => {
  const points = new Array(hex.length / 2)
  for (let i = 0, l = hex.length / 2; i < l; ++i) {
    points[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  if (points.length <= MAX_ARGUMENTS_LENGTH) return String.fromCharCode(...points)

  let res = ''
  let i = 0
  while (i < points.length) {
    res += String.fromCharCode(...points.slice(i, i += MAX_ARGUMENTS_LENGTH))
  }
  return res
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

export const randomBytes = size => {
  const view = new Uint8Array(size)
  return crypto.getRandomValues(view)
}

export * from './util.js'
