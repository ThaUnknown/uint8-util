import { concat } from '../../src/node.js'

import { SIZES, measure, run } from './_suite.ts'

function concatForward (chunks: Uint8Array[], size = 0): Uint8Array {
  if (!size) for (let i = 0; i < chunks.length; i++) size += chunks[i].length
  const b = new Uint8Array(size)
  let offset = 0
  for (let i = 0; i < chunks.length; i++) { b.set(chunks[i], offset); offset += chunks[i].length }
  return b
}

function concatReduce (chunks: Uint8Array[], size = 0): Uint8Array {
  if (!size) size = chunks.reduce((a, c) => a + c.length, 0)
  const b = new Uint8Array(size)
  chunks.reduce((off, c) => { b.set(c, off); return off + c.length }, 0)
  return b
}

function concatForEach (chunks: Uint8Array[], size = 0): Uint8Array {
  if (!size) for (const c of chunks) size += c.length
  const b = new Uint8Array(size)
  let offset = 0
  chunks.forEach(c => { b.set(c, offset); offset += c.length })
  return b
}

const algos = [
  { label: 'backward', fn: concat },
  { label: 'buffer', fn: (chunks: Uint8Array[], size?: number) => Buffer.concat(chunks, size) },
  { label: 'forward', fn: concatForward },
  { label: 'reduce', fn: concatReduce },
  { label: 'forEach', fn: concatForEach }
]

export async function benchConcat () {
  for (const totalSize of SIZES) {
    for (const chunkCount of [4, 32, 256]) {
      const chunkSize = Math.max(1, Math.ceil(totalSize / chunkCount))
      let allocated = 0
      const chunks: Uint8Array[] = []
      for (let i = 0; i < chunkCount && allocated < totalSize; i++) {
        const actualSize = Math.min(chunkSize, totalSize - allocated)
        const c = new Uint8Array(actualSize)
        for (let j = 0; j < actualSize; j++) c[j] = (i + j) & 0xff
        chunks.push(c)
        allocated += actualSize
      }
      if (chunks.length < 2) continue

      const results: Array<{ name: string, ops: number }> = []
      for (const algo of algos) {
        results.push({ name: `concat ${algo.label} w/size ${totalSize}B ${chunkCount}c`, ops: measure(() => algo.fn(chunks, totalSize)) })
        results.push({ name: `concat ${algo.label} no sz ${totalSize}B ${chunkCount}c`, ops: measure(() => algo.fn(chunks)) })
      }
      run(`concat ${totalSize}B ${chunkCount} chunks`, results)
    }
  }
}
