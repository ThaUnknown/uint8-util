import { arr2hex, text2arr } from './util.js'

const scope = typeof window !== 'undefined' ? window : self
const crypto = scope.crypto || scope.msCrypto || {}
const subtle = crypto.subtle || crypto.webkitSubtle

const hash = subtle ? subtle.digest.bind(subtle, 'sha-1') : () => Promise.reject(new Error('no web crypto support'))

export const sha1 = (data, cb) => {
  if (typeof data === 'string') data = text2arr(data)
  hash(data).then(ab => cb(arr2hex(new Uint8Array(ab))))
}

export * from './util.js'
