import { equal, compare } from '../../_node.ts'

import { SIZES, measure, run } from './_suite.ts'

function makeAligned (size: number): [Uint8Array, Uint8Array] {
  const a = new Uint8Array(size)
  const b = new Uint8Array(size)
  for (let i = 0; i < size; i++) { a[i] = i & 0xff; b[i] = i & 0xff }
  return [a, b]
}

function misalign (a: Uint8Array, offset: number): Uint8Array {
  const buf = new ArrayBuffer(a.length + 16)
  const view = new Uint8Array(buf, offset, a.length)
  view.set(a)
  return view
}

function equalByte (a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = a.length - 1; i > -1; --i) { if (a[i] !== b[i]) return false }
  return true
}

function equal32 (a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  if (a.byteOffset % 4 === 0 && b.byteOffset % 4 === 0) {
    const a32 = new Uint32Array(a.buffer, a.byteOffset, a.byteLength >> 2)
    const b32 = new Uint32Array(b.buffer, b.byteOffset, b.byteLength >> 2)
    for (let i = 0; i < a32.length; i++) {
      if (a32[i] !== b32[i]) {
        const o = i << 2
        for (let j = 0; j < 4; j++) { if (a[o + j] !== b[o + j]) return false }
      }
    }
    const off = a32.length << 2
    for (let i = off; i < a.length; i++) { if (a[i] !== b[i]) return false }
    return true
  }
  for (let i = a.length - 1; i > -1; --i) { if (a[i] !== b[i]) return false }
  return true
}

function equal32Unchecked (a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  const a32 = new Uint32Array(a.buffer, a.byteOffset, a.byteLength >> 2)
  const b32 = new Uint32Array(b.buffer, b.byteOffset, b.byteLength >> 2)
  for (let i = 0; i < a32.length; i++) {
    if (a32[i] !== b32[i]) {
      const o = i << 2
      for (let j = 0; j < 4; j++) { if (a[o + j] !== b[o + j]) return false }
    }
  }
  const off = a32.length << 2
  for (let i = off; i < a.length; i++) { if (a[i] !== b[i]) return false }
  return true
}

function equalDataView (a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  const dvA = new DataView(a.buffer, a.byteOffset, a.byteLength)
  const dvB = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const words = a.byteLength >> 2
  for (let i = 0; i < words; i++) {
    if (dvA.getUint32(i << 2) !== dvB.getUint32(i << 2)) {
      const o = i << 2
      for (let j = 0; j < 4; j++) { if (a[o + j] !== b[o + j]) return false }
    }
  }
  const off = words << 2
  for (let i = off; i < a.length; i++) { if (a[i] !== b[i]) return false }
  return true
}

function equalBuffer (a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  return Buffer.compare(a, b) === 0
}

function compareByte (a: Uint8Array, b: Uint8Array): number {
  const min = Math.min(a.length, b.length)
  for (let i = 0; i < min; i++) { if (a[i] !== b[i]) return a[i] - b[i] }
  return a.length - b.length
}

function compare32 (a: Uint8Array, b: Uint8Array): number {
  const min = Math.min(a.length, b.length)
  if (min >= 4 && a.byteOffset % 4 === 0 && b.byteOffset % 4 === 0) {
    const words = min >> 2
    const a32 = new Uint32Array(a.buffer, a.byteOffset, words)
    const b32 = new Uint32Array(b.buffer, b.byteOffset, words)
    for (let i = 0; i < words; i++) {
      if (a32[i] !== b32[i]) {
        const o = i << 2
        for (let j = 0; j < 4; j++) { if (a[o + j] !== b[o + j]) return a[o + j] - b[o + j] }
      }
    }
    const off = words << 2
    for (let i = off; i < min; i++) { if (a[i] !== b[i]) return a[i] - b[i] }
    return a.length - b.length
  }
  for (let i = 0; i < min; i++) { if (a[i] !== b[i]) return a[i] - b[i] }
  return a.length - b.length
}

function compareDataView (a: Uint8Array, b: Uint8Array): number {
  const min = Math.min(a.byteLength, b.byteLength)
  const dvA = new DataView(a.buffer, a.byteOffset, a.byteLength)
  const dvB = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const words = min >> 2
  for (let i = 0; i < words; i++) {
    if (dvA.getUint32(i << 2) !== dvB.getUint32(i << 2)) {
      const o = i << 2
      for (let j = 0; j < 4; j++) { if (a[o + j] !== b[o + j]) return a[o + j] - b[o + j] }
    }
  }
  const off = words << 2
  for (let i = off; i < min; i++) { if (a[i] !== b[i]) return a[i] - b[i] }
  return a.byteLength - b.byteLength
}

export async function benchEqual () {
  for (const size of SIZES) {
    const [a, b] = makeAligned(size)
    const aEnd = Uint8Array.from(a); aEnd[size - 1] ^= 1
    const aStart = Uint8Array.from(a); aStart[0] ^= 1
    const mid = Math.floor(size / 2)
    const aMid = Uint8Array.from(a); aMid[mid] ^= 1

    for (const [label, a2, b2] of [['equal   ', a, b], ['diffMid  ', aMid, b], ['diffLen  ', a, new Uint8Array(size - 1)]] as const) {
      const results: Array<{ name: string, ops: number }> = []
      results.push({ name: `equal lib ${label} ${size}B`, ops: measure(() => equal(a2, b2)) })
      results.push({ name: `equal byte ${label} ${size}B`, ops: measure(() => equalByte(a2, b2)) })
      if (size >= 4) {
        results.push({ name: `equal 32 ${label} ${size}B`, ops: measure(() => equal32(a2, b2)) })
        results.push({ name: `equal 32un ${label} ${size}B`, ops: measure(() => equal32Unchecked(a2, b2)) })
        results.push({ name: `equal dv ${label} ${size}B`, ops: measure(() => equalDataView(a2, b2)) })
      }
      results.push({ name: `equal buf ${label} ${size}B`, ops: measure(() => equalBuffer(a2, b2)) })
      run(`equal ${label} ${size}B`, results)

      if (size >= 8) {
        const aU = misalign(a2, 1); const bU = misalign(b2, 1)
        const unalignResults: Array<{ name: string, ops: number }> = []
        unalignResults.push({ name: `equal lib unalign ${label} ${size}B`, ops: measure(() => equal(aU, bU)) })
        unalignResults.push({ name: `equal byte unalign ${label} ${size}B`, ops: measure(() => equalByte(aU, bU)) })
        if (size >= 4) {
          unalignResults.push({ name: `equal 32 unalign ${label} ${size}B`, ops: measure(() => equal32(aU, bU)) })
          unalignResults.push({ name: `equal dv unalign ${label} ${size}B`, ops: measure(() => equalDataView(aU, bU)) })
        }
        unalignResults.push({ name: `equal buf unalign ${label} ${size}B`, ops: measure(() => equalBuffer(aU, bU)) })
        run(`equal unalign ${label} ${size}B`, unalignResults)
      }
    }
  }
}

export async function benchCompare () {
  for (const size of SIZES) {
    const [a, b] = makeAligned(size)
    const aEnd = Uint8Array.from(a); aEnd[size - 1] ^= 1
    const aStart = Uint8Array.from(a); aStart[0] ^= 1
    const mid = Math.floor(size / 2)
    const aMid = Uint8Array.from(a); aMid[mid] ^= 1

    for (const [label, a2, b2] of [['equal   ', a, b], ['diffMid  ', aMid, b], ['diffLen  ', a, new Uint8Array(size - 1)]] as const) {
      const results: Array<{ name: string, ops: number }> = []
      results.push({ name: `comp lib ${label} ${size}B`, ops: measure(() => compare(a2, b2)) })
      results.push({ name: `comp byte ${label} ${size}B`, ops: measure(() => compareByte(a2, b2)) })
      if (size >= 4) {
        results.push({ name: `comp 32 ${label} ${size}B`, ops: measure(() => compare32(a2, b2)) })
        results.push({ name: `comp dv ${label} ${size}B`, ops: measure(() => compareDataView(a2, b2)) })
      }
      results.push({ name: `comp buf ${label} ${size}B`, ops: measure(() => Buffer.compare(a2, b2)) })
      run(`compare ${label} ${size}B`, results)

      if (size >= 8) {
        const aU = misalign(a2, 1); const bU = misalign(b2, 1)
        const unalignResults: Array<{ name: string, ops: number }> = []
        unalignResults.push({ name: `comp lib unalign ${label} ${size}B`, ops: measure(() => compare(aU, bU)) })
        unalignResults.push({ name: `comp byte unalign ${label} ${size}B`, ops: measure(() => compareByte(aU, bU)) })
        if (size >= 4) {
          unalignResults.push({ name: `comp 32 unalign ${label} ${size}B`, ops: measure(() => compare32(aU, bU)) })
          unalignResults.push({ name: `comp dv unalign ${label} ${size}B`, ops: measure(() => compareDataView(aU, bU)) })
        }
        unalignResults.push({ name: `comp buf unalign ${label} ${size}B`, ops: measure(() => Buffer.compare(aU, bU)) })
        run(`compare unalign ${label} ${size}B`, unalignResults)
      }
    }
  }
}
