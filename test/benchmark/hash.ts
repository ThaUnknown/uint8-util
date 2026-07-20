import { hash, randomBytes } from '../../_node.ts'
import { hash as hashBr, randomBytes as randomBytesBr } from '../../browser.ts'

import { SIZES, measure, measureAsync, run, getData } from './_suite.ts'

export async function benchHash () {
  for (const size of SIZES) {
    const data = getData(size)
    const results: Array<{ name: string, ops: number }> = []

    for (const algo of ['sha1', 'sha256', 'sha512'] as const) {
      const algoBr = algo === 'sha1' ? 'sha-1' : algo === 'sha256' ? 'sha-256' : 'sha-512'
      results.push({ name: `hash ${algo}     ${size}B`, ops: await measureAsync(() => hash(data, undefined, algo) as Promise<Uint8Array>) })
      results.push({ name: `hash ${algo}-br  ${size}B`, ops: await measureAsync(() => hashBr(data, undefined, algoBr) as Promise<Uint8Array>) })
    }

    run(`hash ${size}B`, results)
  }
}

export async function benchRandomBytes () {
  for (const size of SIZES) {
    const results: Array<{ name: string, ops: number }> = []

    results.push({ name: `randomBytes       ${size}B`, ops: measure(() => randomBytes(size)) })
    results.push({ name: `randomBytes-br    ${size}B`, ops: measure(() => randomBytesBr(size)) })

    run(`randomBytes ${size}B`, results)
  }
}
