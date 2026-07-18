import { arr2base, base2arr } from '../../_node.ts'
import { arr2base as arr2baseBr, base2arr as base2arrBr } from '../../browser.ts'

import { SIZES, measure, run, getData } from './_suite.ts'

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function btoaCharCode (data: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < data.length; i++) bin += String.fromCharCode(data[i]!)
  return btoa(bin)
}

function btoaApply (data: Uint8Array): string {
  return btoa(String.fromCharCode.apply(null, data as unknown as number[]))
}

function manualB64 (data: Uint8Array): string {
  const len = data.length
  let out = ''
  let i = 0
  while (i + 3 <= len) {
    const b = (data[i++] << 16) | (data[i++] << 8) | data[i++]
    out += B64[(b >> 18) & 0x3f] + B64[(b >> 12) & 0x3f] + B64[(b >> 6) & 0x3f] + B64[b & 0x3f]
  }
  if (i < len) {
    const rem = len - i
    if (rem === 1) {
      const b = data[i]
      out += B64[(b >> 2) & 0x3f] + B64[(b & 3) << 4] + '=='
    } else {
      const b = (data[i] << 8) | data[i + 1]
      out += B64[(b >> 10) & 0x3f] + B64[(b >> 4) & 0x3f] + B64[(b & 0xf) << 2] + '='
    }
  }
  return out
}

function atobCharCode (str: string): Uint8Array {
  const bin = atob(str)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

export async function benchArr2base () {
  for (const size of SIZES) {
    const data = getData(size)
    const results: Array<{ name: string, ops: number }> = []

    results.push({ name: `arr2base lib       ${size}B`, ops: measure(() => arr2base(data)) })
    results.push({ name: `arr2base lib-br    ${size}B`, ops: measure(() => arr2baseBr(data)) })
    results.push({ name: `arr2base btoaChar  ${size}B`, ops: measure(() => btoaCharCode(data)) })
    if (size <= 16384) results.push({ name: `arr2base btoaApply ${size}B`, ops: measure(() => btoaApply(data)) })
    results.push({ name: `arr2base manualB64 ${size}B`, ops: measure(() => manualB64(data)) })

    run(`arr2base ${size}B`, results)
  }
}

export async function benchBase2arr () {
  for (const size of SIZES) {
    const data = getData(size)
    const base64 = arr2base(data)
    const results: Array<{ name: string, ops: number }> = []

    results.push({ name: `base2arr lib       ${size}B`, ops: measure(() => base2arr(base64)) })
    results.push({ name: `base2arr lib-br    ${size}B`, ops: measure(() => base2arrBr(base64)) })
    results.push({ name: `base2arr atobChar  ${size}B`, ops: measure(() => atobCharCode(base64)) })

    run(`base2arr ${size}B`, results)
  }
}
