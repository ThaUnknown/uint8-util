import { benchArr2base, benchBase2arr } from './base64.ts'
import { benchBitwise } from './bitwise.ts'
// import { benchConcat } from './concat.ts'
import { benchEqual, benchCompare } from './equal-compare.ts'
// import { benchHash, benchRandomBytes } from './hash.ts'
import { benchArr2hex, benchHex2arr, benchBin2hex, benchHex2bin } from './hex.ts'
// import { benchArr2text, benchText2arr } from './text.ts'
import { benchUnroll } from './unroll.ts'

const suites = [
  // benchArr2hex,
  // benchHex2arr
  // benchBin2hex,
  // benchHex2bin,
  // benchArr2text,
  // benchText2arr,
  // benchArr2base,
  // benchBase2arr
  // benchEqual
  // benchCompare
  benchBitwise
  // benchConcat,
  // benchHash,
  // benchRandomBytes,
  // benchUnroll
]

async function main () {
  console.log('uint8-util benchmark suite')
  console.log(`Node ${process.version ?? 'browser'}, ${process.arch ?? ''}`)
  console.log(new Date().toISOString())
  console.log('='.repeat(70))

  for (const suite of suites) {
    try {
      await suite()
    } catch (err) {
      console.error('Suite failed:', err)
    }
  }
}

main()
