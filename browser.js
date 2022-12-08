import { arr2hex, text2arr } from './util.js'

const scope = typeof window !== 'undefined' ? window : self
const crypto = scope.crypto || scope.msCrypto || {}
const subtle = crypto.subtle || crypto.webkitSubtle

export const hash = async (data, algo, hex) => {
  if (!subtle) throw new Error('no web crypto support')
  if (typeof data === 'string') data = text2arr(data)
  const out = new Uint8Array(await subtle.digest(algo, data))
  return hex ? arr2hex(out) : out
}

const decoder = new TextDecoder()
export const arr2string = (buffer) => {
  if (buffer instanceof ArrayBuffer) buffer = new Uint8Array(buffer)
  return decoder.decode(buffer)
}

// sacrifice ~20% speed for bundle size
const encoder = new TextEncoder()
export const string2arr = string => {
  return encoder.encode(string)
}

export * from './util.js'
