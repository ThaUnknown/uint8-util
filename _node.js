import { createHash } from 'crypto'

export const hash = async (data, algo, hex) => {
  const out = createHash(algo).update(data)
  return hex ? out.digest('hex') : new Uint8Array(out.digest().buffer)
}

const decoder = new TextDecoder()
export const arr2string = buffer => {
  if (buffer.byteLength > 1024) return decoder.decode(buffer)
  return Buffer.from(buffer).toString('utf8')
}

export const string2arr = str => {
  return new Uint8Array(Buffer.from(str, 'utf-8'))
}

export * from './util.js'
