import Benchmark from 'benchmark'

globalThis.Benchmark = Benchmark

const bin = 'bZDÑ\x98\x93Kw¤[©UU)[\\'
const hex = '625a44d198934b77a45ba95555295b5c'

const suite = new Benchmark.Suite()

const hex2binary = hex => {
  let string = ''
  for (let i = 0, l = hex.length; i < l; i += 2) {
    string += String.fromCharCode(parseInt(hex.substr(i, 2), 16))
  }

  return string
}

export const alphabet = '0123456789abcdef'
const decodeLookup = []

for (let i = 0; i < 256; i++) {
  if (i < 16) {
    if (i < 10) {
      decodeLookup[0x30 + i] = i
    } else {
      decodeLookup[0x61 - 10 + i] = i
    }
  }
}

const hex2arr = str => {
  const sizeof = str.length >> 1
  const length = sizeof << 1
  const array = new Uint8Array(sizeof)
  let n = 0
  let i = 0
  while (i < length) {
    array[n++] = decodeLookup[str.charCodeAt(i++)] << 4 | decodeLookup[str.charCodeAt(i++)]
  }
  return array
}

const hex2binspread = hex => {
  const points = new Array(hex.length / 2)
  for (let i = 0, l = hex.length / 2; i < l; ++i) {
    points[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return decodeCodePointsArray(points)
}

const hex2binspread2arr = hex => {
  const points = hex2arr(hex)
  return decodeCodePointsArray(points)
}

const MAX_ARGUMENTS_LENGTH = 0x10000

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

suite
  .add('Buffer.from', function () {
    const res = Buffer.from(hex, 'hex').toString('binary')

    if (res !== bin) {
      console.dir(res)
      throw new Error('String decoding failed')
    }
  })
  .add('wtcommon', function () {
    const res = hex2binary(hex)

    if (res !== bin) {
      throw new Error('String decoding failed')
    }
  })
  .add('wtcommonspread', function () {
    const res = hex2binspread(hex)
    if (res !== bin) {
      throw new Error('String decoding failed')
    }
  })
  .add('wtcommonspread2arr', function () {
    const res = hex2binspread2arr(hex)
    if (res !== bin) {
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
