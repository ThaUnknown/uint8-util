import Benchmark from 'benchmark'
import fs from 'fs'

globalThis.Benchmark = Benchmark

const string = 'Hello world, this is a Uint8Array created from a string'
const DATA = Buffer.from(string, 'utf-8')

// https://github.com/achingbrain/uint8arrays/issues/30#issuecomment-1199120924
function utf8ReadFromCharCode (buffer, start = 0, end = buffer.byteLength) {
  const len = end - start
  if (len < 1) { return '' }
  const parts = []
  const chunk = []
  let i = 0 // char offset
  let t // temporary
  while (start < end) {
    t = buffer[start++]
    if (t < 128) { chunk[i++] = t } else if (t > 191 && t < 224) { chunk[i++] = (t & 31) << 6 | buffer[start++] & 63 } else if (t > 239 && t < 365) {
      t = ((t & 7) << 18 | (buffer[start++] & 63) << 12 | (buffer[start++] & 63) << 6 | buffer[start++] & 63) - 0x10000
      chunk[i++] = 0xD800 + (t >> 10)
      chunk[i++] = 0xDC00 + (t & 1023)
    } else {
      chunk[i++] = (t & 15) << 12 | (buffer[start++] & 63) << 6 | buffer[start++] & 63
    }
    if (i > 8191) {
      parts.push(String.fromCharCode(...chunk))
      i = 0
    }
  }
  if (parts.length) {
    if (i) parts.push(String.fromCharCode(...chunk.slice(0, i)))
    return parts.join('')
  }
  return String.fromCharCode(...chunk.slice(0, i))
}

function utf8Slice (buf, start = 0, end = buf.byteLength) {
  end = Math.min(buf.length, end)
  const res = []

  let i = start
  while (i < end) {
    const firstByte = buf[i]
    let codePoint = null
    let bytesPerSequence = (firstByte > 0xEF)
      ? 4
      : (firstByte > 0xDF)
          ? 3
          : (firstByte > 0xBF)
              ? 2
              : 1

    if (i + bytesPerSequence <= end) {
      let secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// https://github.com/feross/buffer/blob/master/index.js#L1035
// https://github.com/anonrig/undici/blob/494d27782ad2df68e2e61603914aa0a2dce0f5c8/lib/fetch/util.js#L872
const MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  const len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode(...codePoints)
  }

  let res = ''
  let i = 0
  while (i < len) {
    res += String.fromCharCode(...codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH))
  }
  return res
}
// https://github.com/protobufjs/protobuf.js/blob/6f0806ddef408647fbaed049dbd8929ad9f5c10c/lib/utf8/index.js#L40-L62

function utf8Spread (buffer, start = 0, end = buffer.byteLength) {
  if (end - start < 1) {
    return ''
  }
  let arr = new Array(end - start)
  let j = 0
  for (let i = start; i < end;) {
    const t = buffer[i++]
    if (t <= 0x7F) {
      arr[j++] = t
    } else if (t >= 0xC0 && t < 0xE0) {
      arr[j++] = (t & 0x1F) << 6 | buffer[i++] & 0x3F
    } else if (t >= 0xE0 && t < 0xF0) {
      arr[j++] = (t & 0xF) << 12 | (buffer[i++] & 0x3F) << 6 | buffer[i++] & 0x3F
    } else if (t >= 0xF0) {
      const t2 = ((t & 7) << 18 | (buffer[i++] & 0x3F) << 12 | (buffer[i++] & 0x3F) << 6 | buffer[i++] & 0x3F) - 0x10000
      arr[j++] = 0xD800 + (t2 >> 10)
      arr[j++] = 0xDC00 + (t2 & 0x3FF)
    }
  }

  arr = arr.slice(0, j)

  return decodeCodePointsArray(arr)
}

const suite = new Benchmark.Suite()
const decoder = new TextDecoder()

suite
  .add('TextDecoder', () => {
    const res = decoder.decode(DATA)

    if (res !== string) {
      throw new Error('String encoding failed')
    }
  })
  .add('utf8ReadFromCharCode', () => {
    const res = utf8ReadFromCharCode(DATA)

    if (res !== string) {
      throw new Error('String encoding failed')
    }
  })
  .add('utf8Spread', () => {
    const res = utf8Spread(DATA)

    if (res !== string) {
      fs.writeFileSync('./benchmark/err.txt', res, { encoding: 'utf-8' })
      throw new Error('String encoding failed')
    }
  })
  .add('utf8SliceSpread', () => {
    const res = utf8Slice(DATA)

    if (res !== string) {
      throw new Error('String encoding failed')
    }
  })
  .add('Buffer.toString', () => {
    const buf = Buffer.from(DATA)
    const res = buf.toString('utf8')

    if (res !== string) {
      throw new Error('String encoding failed')
    }
  })
if (globalThis.Response) {
  suite.add('async response', async () => {
    const res = await new Response(DATA).text()

    if (res !== string) {
      throw new Error('String encoding failed')
    }
  })
}

suite
  // add listeners
  .on('cycle', (event) => {
    console.log(String(event.target))
  })
  .on('complete', function () {
    console.log('Fastest is ' + this.filter('fastest').map('name') + '\n')
  })
  // run async
  .run({ async: true })
