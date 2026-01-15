import Benchmark from 'benchmark'

globalThis.Benchmark = Benchmark

const string = 'Hello world, this is a Uint8Array created from a string'
const DATA = Buffer.from(string, 'utf-8')
const suite = new Benchmark.Suite()
// sha1 hashing, node crypto vs web crypto
import { createHash } from 'node:crypto'
import { subtle } from 'node:crypto'
suite
  .add('node crypto sha1', async () => {
    createHash('sha1').update(DATA).digest()
  })
  .add('web crypto sha1', async () => {
    await subtle.digest('SHA-1', DATA)
  })
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
