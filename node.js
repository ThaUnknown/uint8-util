import { createHash } from 'crypto'

export const sha1 = (data, cb) => {
  cb(createHash('sha1').update(data).digest('hex'))
}

export * from './util.js'
