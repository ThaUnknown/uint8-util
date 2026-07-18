import { hash, randomBytes } from '../../_node.ts'

import { SIZES, measure, measureAsync, run, getData } from './_suite.ts'

export async function benchHash () {
  for (const size of SIZES) {
    const data = getData(size)
    const results: Array<{ name: string, ops: number }> = []

    for (const algo of ['sha1', 'sha256', 'sha512'] as const) {
      results.push({ name: `hash ${algo}     ${size}B`, ops: await measureAsync(() => hash(data, undefined, algo) as Promise<Uint8Array>) })
    }

    run(`hash ${size}B`, results)
  }
}

export async function benchRandomBytes () {
  for (const size of SIZES) {
    const results: Array<{ name: string, ops: number }> = []

    results.push({ name: `randomBytes      ${size}B`, ops: measure(() => randomBytes(size)) })

    run(`randomBytes ${size}B`, results)
  }
}
