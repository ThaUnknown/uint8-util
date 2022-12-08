import { createHash } from 'node:crypto'

const decoder = new TextDecoder()
export const arr2text = buffer => {
  if (buffer.byteLength > 1024) return decoder.decode(buffer)
  return Buffer.from(buffer).toString('utf8')
}

export const text2arr = str => {
  return new Uint8Array(Buffer.from(str, 'utf-8'))
}

export const arr2base = buffer => {
  return Buffer.from(buffer).toString('base64')
}

export const base2arr = str => {
  return new Uint8Array(Buffer.from(str, 'base64'))
}

export const hash = async (data, format, algo = 'sha1') => {
  algo = algo.replace('sha-', 'sha')
  const out = createHash(algo).update(data)
  return format ? out.digest(format) : new Uint8Array(out.digest().buffer)
}

export * from './util.js'
