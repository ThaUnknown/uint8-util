import Benchmark from 'benchmark'

globalThis.Benchmark = Benchmark

const bin = 'bZDÑ\x98\x93Kw¤[©UU)[\\'
const hex = '625a44d198934b77a45ba95555295b5c'

const suite = new Benchmark.Suite()

const alph = '0123456789abcdef'
const bin2hex = str => {
  let res = ''
  let c
  let i = 0
  const len = str.length

  while (i < len) {
    c = str.charCodeAt(i++)
    res += alph[c >> 4] + alph[c & 0xF]
  }

  return res
}

suite
  .add('Buffer.from', function () {
    const res = Buffer.from(bin, 'binary').toString('hex')

    if (res !== hex) {
      throw new Error('String decoding failed')
    }
  })
  .add('wtcommon', function () {
    const res = bin2hex(bin)

    if (res !== hex) {
      console.log(res, hex)
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
