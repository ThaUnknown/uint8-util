import Benchmark from 'benchmark'

globalThis.Benchmark = Benchmark

const string = 'Hello world, this is a Uint8Array created from a string'
const DATA = Buffer.from(string, 'utf-8')

function checkBuffer (arr) {
  for (let i = 0; i < arr.byteLength; i++) {
    if (arr[i] !== DATA[i]) {
      return false
    }
  }

  return true
}

/* Fast polyfill for TextEncoder and TextDecoder, only supports UTF-8
*
* @author   Sam Thorogood <sam.thorogood@gmail.com>
* @license  Apache-2.0
*/
const text2arr = string => {
  let pos = 0
  const len = string.length

  let at = 0 // output position
  let tlen = Math.max(32, len + (len >>> 1) + 7) // 1.5x size
  let target = new Uint8Array((tlen >>> 3) << 3) // ... but at 8 byte offset

  while (pos < len) {
    let value = string.charCodeAt(pos++)
    if (value >= 0xd800 && value <= 0xdbff) {
      // high surrogate
      if (pos < len) {
        const extra = string.charCodeAt(pos)
        if ((extra & 0xfc00) === 0xdc00) {
          ++pos
          value = ((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000
        }
      }
      if (value >= 0xd800 && value <= 0xdbff) {
        continue // drop lone surrogate
      }
    }

    // expand the buffer if we couldn't write 4 bytes
    if (at + 4 > target.length) {
      tlen += 8 // minimum extra
      tlen *= (1.0 + (pos / string.length) * 2) // take 2x the remaining
      tlen = (tlen >>> 3) << 3 // 8 byte offset

      const update = new Uint8Array(tlen)
      update.set(target)
      target = update
    }

    if ((value & 0xffffff80) === 0) { // 1-byte
      target[at++] = value // ASCII
      continue
    } else if ((value & 0xfffff800) === 0) { // 2-byte
      target[at++] = ((value >>> 6) & 0x1f) | 0xc0
    } else if ((value & 0xffff0000) === 0) { // 3-byte
      target[at++] = ((value >>> 12) & 0x0f) | 0xe0
      target[at++] = ((value >>> 6) & 0x3f) | 0x80
    } else if ((value & 0xffe00000) === 0) { // 4-byte
      target[at++] = ((value >>> 18) & 0x07) | 0xf0
      target[at++] = ((value >>> 12) & 0x3f) | 0x80
      target[at++] = ((value >>> 6) & 0x3f) | 0x80
    } else {
      continue // out of range
    }

    target[at++] = (value & 0x3f) | 0x80
  }

  return target.slice(0, at)
}

// https://github.com/anonyco/FastestSmallestTextEncoderDecoder/blob/master/EncoderDecoderTogether.src.js#L220
const fsted = inputString => {
  // 0xc0 => 0b11000000; 0xff => 0b11111111; 0xc0-0xff => 0b11xxxxxx
  // 0x80 => 0b10000000; 0xbf => 0b10111111; 0x80-0xbf => 0b10xxxxxx
  const encodedString = inputString === undefined ? '' : ('' + inputString)
  const len = encodedString.length | 0
  let result = new Uint8Array((len << 1) + 8 | 0)
  let tmpResult
  let i = 0; let pos = 0; let point = 0; let nextcode = 0
  for (i = 0; i < len; i = i + 1 | 0, pos = pos + 1 | 0) {
    point = encodedString.charCodeAt(i) | 0
    if (point <= 0x007f) {
      result[pos] = point
    } else if (point <= 0x07ff) {
      result[pos] = (0x6 << 5) | (point >> 6)
      result[pos = pos + 1 | 0] = (0x2 << 6) | (point & 0x3f)
    } else {
      // eslint-disable-next-line no-labels
      widenCheck: {
        if (point >= 0xD800) {
          if (point <= 0xDBFF) {
            nextcode = encodedString.charCodeAt(i = i + 1 | 0) | 0 // defaults to 0 when NaN, causing null replacement character

            if (nextcode >= 0xDC00 && nextcode <= 0xDFFF) {
              // point = ((point - 0xD800)<<10) + nextcode - 0xDC00 + 0x10000|0;
              point = (point << 10) + nextcode - 0x35fdc00 | 0
              if (point > 0xffff) {
                result[pos] = (0x1e/* 0b11110 */ << 3) | (point >> 18)
                result[pos = pos + 1 | 0] = (0x2/* 0b10 */ << 6) | ((point >> 12) & 0x3f/* 0b00111111 */)
                result[pos = pos + 1 | 0] = (0x2/* 0b10 */ << 6) | ((point >> 6) & 0x3f/* 0b00111111 */)
                result[pos = pos + 1 | 0] = (0x2/* 0b10 */ << 6) | (point & 0x3f/* 0b00111111 */)
                continue
              }
              // eslint-disable-next-line no-labels
              break widenCheck
            }
            point = 65533/* 0b1111111111111101 */// return '\xEF\xBF\xBD';//fromCharCode(0xef, 0xbf, 0xbd);
          } else if (point <= 0xDFFF) {
            point = 65533/* 0b1111111111111101 */// return '\xEF\xBF\xBD';//fromCharCode(0xef, 0xbf, 0xbd);
          }
        }
        if ((i << 1) < pos && (i << 1) < (pos - 7 | 0)) {
          tmpResult = new Uint8Array(len * 3)
          tmpResult.set(result)
          result = tmpResult
        }
      }
      result[pos] = (0xe/* 0b1110 */ << 4) | (point >> 12)
      result[pos = pos + 1 | 0] = (0x2/* 0b10 */ << 6) | ((point >> 6) & 0x3f/* 0b00111111 */)
      result[pos = pos + 1 | 0] = (0x2/* 0b10 */ << 6) | (point & 0x3f/* 0b00111111 */)
    }
  }
  return result.subarray(0, pos)
}

const suite = new Benchmark.Suite()
const encoder = new TextEncoder()

suite
  .add('TextEncoder', () => {
    const res = encoder.encode(string)

    if (!checkBuffer(res)) {
      throw new Error('String decoding failed')
    }
  })
  .add('text2arr', () => {
    const res = text2arr(string)

    if (!checkBuffer(res)) {
      throw new Error('String decoding failed')
    }
  })
  .add('fsted', () => {
    const res = fsted(string)

    if (!checkBuffer(res)) {
      throw new Error('String decoding failed')
    }
  })
  .add('Buffer.from', function () {
    const res = new Uint8Array(Buffer.from(string, 'utf-8'))

    if (!checkBuffer(res)) {
      throw new Error('String decoding failed')
    }
  })

suite
  // add listeners
  .on('cycle', (event) => {
    console.log(String(event.target))
  })
  .on('complete', function () {
    console.log('Fastest is ' + this.filter('fastest').map('name') + '\n')
  })
  .on('error', (err) => {
    console.error(err)
  })
  // run async
  .run({ async: true })
