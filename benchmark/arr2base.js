import Benchmark from 'benchmark'
import { encode } from 'base64-arraybuffer'

globalThis.Benchmark = Benchmark

const string = 'Hello world, this is a Uint8Array created from a string'
const DATA = Buffer.from(string)
const base = DATA.toString('base64')

const suite = new Benchmark.Suite()
const decoder = new TextDecoder()

suite
  .add('TextDecoder', () => {
    const res = decoder.decode(DATA)
    const text = btoa(res)
    if (text !== base) {
      throw new Error('String encoding failed')
    }
  })
  .add('Buffer.toString', () => {
    const res = Buffer.from(DATA).toString('base64')

    if (res !== base) {
      throw new Error('String encoding failed')
    }
  })
  .add('b64ab', () => {
    const res = encode(DATA)

    if (res !== base) {
      throw new Error('String encoding failed')
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
  // run async
  .run({ async: true })
