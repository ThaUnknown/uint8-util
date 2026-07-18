import { arr2hex, hex2arr, hex2bin, bin2hex } from '../../_node.ts'
import { bin2hex as bin2hexBr, hex2bin as hex2binBr } from '../../browser.ts'

import { SIZES, measure, run, getData, getBinaryString } from './_suite.ts'

const ALPH = '0123456789abcdef'
const encodeLookup: string[] = []
for (let i = 0; i < 256; i++) encodeLookup[i] = ALPH[i >> 4 & 0xf] + ALPH[i & 0xf]

const decodeLookup: number[] = []
for (let i = 0; i < 256; i++) {
  if (i < 16) {
    if (i < 10) decodeLookup[0x30 + i] = i
    else decodeLookup[0x61 - 10 + i] = i
  }
}

const pairLookup: Record<string, number> = {}
for (let i = 0; i < 256; i++) pairLookup[encodeLookup[i]] = i

function hexValue (c: number): number {
  if (c >= 0x30 && c <= 0x39) return c - 0x30
  if (c >= 0x41 && c <= 0x46) return c - 0x41 + 10
  if (c >= 0x61 && c <= 0x66) return c - 0x61 + 10
  return 0
}

function decodeCodePointsArray (codePoints: number[]): string {
  const max = 0x10000
  let s = ''
  for (let i = 0; i < codePoints.length; i += max) {
    s += String.fromCharCode.apply(null, codePoints.slice(i, i + max))
  }
  return s
}

function arr2hexNibbles (data: Uint8Array): string {
  let s = ''
  for (let i = 0; i < data.length; i++) {
    s += ALPH[data[i] >> 4] + ALPH[data[i] & 0xf]
  }
  return s
}

function arr2hexConcat (data: Uint8Array): string {
  let s = ''
  for (let i = 0; i < data.length; i++) {
    s += ALPH[data[i] >> 4 & 0xf] + ALPH[data[i] & 0xf]
  }
  return s
}

function hex2arrInline (str: string): Uint8Array {
  const len = str.length
  const out = new Uint8Array(len >> 1)
  for (let i = 0, j = 0; i < len; i += 2, j++) {
    out[j] = (hexValue(str.charCodeAt(i)) << 4) | hexValue(str.charCodeAt(i + 1))
  }
  return out
}

function hex2arrParseInt (str: string): Uint8Array {
  const out = new Uint8Array(str.length >> 1)
  for (let i = 0, j = 0; i < str.length; i += 2, j++) {
    out[j] = parseInt(str.substring(i, i + 2), 16)
  }
  return out
}

function hex2arrNumber (str: string): Uint8Array {
  const out = new Uint8Array(str.length >> 1)
  for (let i = 0, j = 0; i < str.length; i += 2, j++) {
    out[j] = Number('0x' + str.substring(i, i + 2))
  }
  return out
}

function hex2arrPair (str: string): Uint8Array {
  const out = new Uint8Array(str.length >> 1)
  for (let i = 0, j = 0; i < str.length; i += 2, j++) {
    out[j] = pairLookup[str.substring(i, i + 2)]
  }
  return out
}

function bin2hexNibbles (bin: string): string {
  let s = ''
  for (let i = 0; i < bin.length; i++) {
    const c = bin.charCodeAt(i)
    s += ALPH[c >> 4] + ALPH[c & 0xf]
  }
  return s
}

function bin2hexLookup (bin: string): string {
  let s = ''
  for (let i = 0; i < bin.length; i++) {
    s += encodeLookup[bin.charCodeAt(i)]
  }
  return s
}

function bin2hexConcat (bin: string): string {
  let s = ''
  for (let i = 0; i < bin.length; i++) {
    const c = bin.charCodeAt(i)
    s += ALPH[c >> 4 & 0xf] + ALPH[c & 0xf]
  }
  return s
}

function hex2binParseInt (hex: string): string {
  let s = ''
  for (let i = 0; i < hex.length; i += 2) {
    s += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16))
  }
  return s
}

function hex2binSpread (hex: string): string {
  const points: number[] = []
  for (let i = 0; i < hex.length; i += 2) {
    points.push(parseInt(hex.substring(i, i + 2), 16))
  }
  return decodeCodePointsArray(points)
}

function hex2binSpread2arr (hex: string): string {
  const arr = hex2arr(hex)
  return decodeCodePointsArray(Array.from(arr))
}

export async function benchArr2hex () {
  for (const size of SIZES) {
    const data = getData(size)
    const results: Array<{ name: string, ops: number }> = []

    results.push({ name: `arr2hex lib         ${size}B`, ops: measure(() => arr2hex(data)) })
    results.push({ name: `arr2hex nibbles     ${size}B`, ops: measure(() => arr2hexNibbles(data)) })
    results.push({ name: `arr2hex concat      ${size}B`, ops: measure(() => arr2hexConcat(data)) })
    results.push({
      name: `arr2hex unroll2     ${size}B`,
      ops: measure(() => {
        const d = data; const len = d.length; let s = ''; let i = 0
        while (i + 2 <= len) { s += encodeLookup[d[i++]] + encodeLookup[d[i++]] }
        while (i < len) { s += encodeLookup[d[i++]] }
        return s
      })
    })
    results.push({
      name: `arr2hex unroll4     ${size}B`,
      ops: measure(() => {
        const d = data; const len = d.length; let s = ''; let i = 0
        while (i + 4 <= len) {
          s += encodeLookup[d[i++]] + encodeLookup[d[i++]] + encodeLookup[d[i++]] + encodeLookup[d[i++]]
        }
        while (i < len) { s += encodeLookup[d[i++]] }
        return s
      })
    })

    run(`arr2hex ${size}B`, results)
  }
}

export async function benchHex2arr () {
  for (const size of SIZES) {
    const data = getData(size)
    const hex = arr2hex(data)
    const results: Array<{ name: string, ops: number }> = []

    results.push({ name: `hex2arr lib         ${size}B`, ops: measure(() => hex2arr(hex)) })
    results.push({ name: `hex2arr inline      ${size}B`, ops: measure(() => hex2arrInline(hex)) })
    results.push({ name: `hex2arr parseInt    ${size}B`, ops: measure(() => hex2arrParseInt(hex)) })
    results.push({ name: `hex2arr Number      ${size}B`, ops: measure(() => hex2arrNumber(hex)) })
    results.push({ name: `hex2arr pairLookup  ${size}B`, ops: measure(() => hex2arrPair(hex)) })
    results.push({
      name: `hex2arr unroll4     ${size}B`,
      ops: measure(() => {
        const str = hex; const len = str.length; const out = new Uint8Array(len >> 1); let j = 0; let i = 0
        while (i + 8 <= len) {
          out[j++] = (decodeLookup[str.charCodeAt(i++)] << 4) | decodeLookup[str.charCodeAt(i++)]
          out[j++] = (decodeLookup[str.charCodeAt(i++)] << 4) | decodeLookup[str.charCodeAt(i++)]
          out[j++] = (decodeLookup[str.charCodeAt(i++)] << 4) | decodeLookup[str.charCodeAt(i++)]
          out[j++] = (decodeLookup[str.charCodeAt(i++)] << 4) | decodeLookup[str.charCodeAt(i++)]
        }
        while (i < len) { out[j++] = (decodeLookup[str.charCodeAt(i++)] << 4) | decodeLookup[str.charCodeAt(i++)] }
        return out
      })
    })

    run(`hex2arr ${size}B`, results)
  }
}

export async function benchBin2hex () {
  for (const size of SIZES) {
    const bin = getBinaryString(size)
    const results: Array<{ name: string, ops: number }> = []

    results.push({ name: `bin2hex lib         ${size}B`, ops: measure(() => bin2hex(bin)) })
    results.push({ name: `bin2hex lib-br      ${size}B`, ops: measure(() => bin2hexBr(bin)) })
    results.push({ name: `bin2hex nibbles     ${size}B`, ops: measure(() => bin2hexNibbles(bin)) })
    results.push({ name: `bin2hex lookup      ${size}B`, ops: measure(() => bin2hexLookup(bin)) })
    results.push({ name: `bin2hex concat      ${size}B`, ops: measure(() => bin2hexConcat(bin)) })

    run(`bin2hex ${size}B`, results)
  }
}

export async function benchHex2bin () {
  for (const size of SIZES) {
    const bin = getBinaryString(size)
    const hex = bin2hex(bin)
    const results: Array<{ name: string, ops: number }> = []

    results.push({ name: `hex2bin lib         ${size}B`, ops: measure(() => hex2bin(hex)) })
    results.push({ name: `hex2bin lib-br      ${size}B`, ops: measure(() => hex2binBr(hex)) })
    results.push({ name: `hex2bin parseInt    ${size}B`, ops: measure(() => hex2binParseInt(hex)) })
    results.push({ name: `hex2bin spread      ${size}B`, ops: measure(() => hex2binSpread(hex)) })
    results.push({ name: `hex2bin spread2arr  ${size}B`, ops: measure(() => hex2binSpread2arr(hex)) })

    run(`hex2bin ${size}B`, results)
  }
}
