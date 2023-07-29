import Benchmark from 'benchmark'

globalThis.Benchmark = Benchmark

const hex = '625a44d198934b77a45ba95555295b5c'

const suite = new Benchmark.Suite()

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

const HEX_PREFIX = '0x'

const number = str => {
  const sizeof = str.length >> 1
  const length = sizeof << 1
  const array = new Uint8Array(sizeof)
  let n = 0
  let i = 0
  while (i < length) {
    array[n++] = Number(HEX_PREFIX + str.substring(i++, ++i))
  }
  return array
}
const int = str => {
  const sizeof = str.length >> 1
  const length = sizeof << 1
  const array = new Uint8Array(sizeof)
  let n = 0
  let i = 0
  while (i < length) {
    array[n++] = parseInt(str.substring(i++, ++i), 16)
  }
  return array
}

suite
  .add('buffer', function () {
    Buffer.from(hex, 'hex')
  })
  .add('wtcommon', function () {
    hex2arr(hex)
  })
  .add('number', function () {
    number(hex)
  })
  .add('int', function () {
    int(hex)
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
