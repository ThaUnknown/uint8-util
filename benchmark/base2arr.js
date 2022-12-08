import Benchmark from 'benchmark'

globalThis.Benchmark = Benchmark

const string = 'Hello world, this is a Uint8Array created from a string'
const DATA = Buffer.from(string)
const base = DATA.toString('base64')

function checkBuffer (arr) {
  for (let i = 0; i < arr.byteLength; i++) {
    if (arr[i] !== DATA[i]) {
      return false
    }
  }

  return true
}

const suite = new Benchmark.Suite()
const encoder = new TextEncoder()

suite
  .add('TextEncoder', () => {
    const res = encoder.encode(atob(base))

    if (!checkBuffer(res)) {
      throw new Error('String decoding failed')
    }
  })
  .add('Buffer.from', function () {
    const res = new Uint8Array(Buffer.from(base, 'base64'))

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
