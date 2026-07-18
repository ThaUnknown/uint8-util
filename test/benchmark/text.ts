import { arr2text, text2arr } from '../../_node.ts'
import { text2arr as text2arrBr } from '../../browser.ts'

import { SIZES, measure, run, getText } from './_suite.ts'

function manualUtf8Decode (data: Uint8Array): string {
  let out = ''
  let i = 0
  while (i < data.length) {
    const b = data[i++]
    if (b < 0x80) {
      out += String.fromCharCode(b)
    } else if (b < 0xE0) {
      out += String.fromCharCode(((b & 0x1F) << 6) | (data[i++] & 0x3F))
    } else if (b < 0xF0) {
      out += String.fromCharCode(((b & 0x0F) << 12) | ((data[i++] & 0x3F) << 6) | (data[i++] & 0x3F))
    } else {
      const cp = ((b & 0x07) << 18) | ((data[i++] & 0x3F) << 12) | ((data[i++] & 0x3F) << 6) | (data[i++] & 0x3F)
      out += String.fromCharCode((cp >> 10) + 0xD800, (cp & 0x3FF) + 0xDC00)
    }
  }
  return out
}

function utf8Spread (data: Uint8Array): string {
  const pts: number[] = []
  let i = 0
  while (i < data.length) {
    const b = data[i++]
    if (b < 0x80) pts.push(b)
    else if (b < 0xE0) pts.push(((b & 0x1F) << 6) | (data[i++] & 0x3F))
    else if (b < 0xF0) pts.push(((b & 0x0F) << 12) | ((data[i++] & 0x3F) << 6) | (data[i++] & 0x3F))
    else {
      const cp = ((b & 0x07) << 18) | ((data[i++] & 0x3F) << 12) | ((data[i++] & 0x3F) << 6) | (data[i++] & 0x3F)
      pts.push((cp >> 10) + 0xD800, (cp & 0x3FF) + 0xDC00)
    }
  }
  let s = ''
  const max = 0x10000
  for (let j = 0; j < pts.length; j += max) {
    s += String.fromCharCode.apply(null, pts.slice(j, j + max))
  }
  return s
}

function arr2textBuffer (data: Uint8Array): string {
  return Buffer.from(data).toString('utf8')
}

function manualUtf8Encode (str: string): Uint8Array {
  const buf: number[] = []
  for (let i = 0; i < str.length; i++) {
    let cp = str.charCodeAt(i)
    if (cp >= 0xD800 && cp <= 0xDBFF) {
      cp = 0x10000 + ((cp - 0xD800) << 10) + (str.charCodeAt(++i) - 0xDC00)
    }
    if (cp < 0x80) buf.push(cp)
    else if (cp < 0x800) buf.push(0xC0 | (cp >> 6), 0x80 | (cp & 0x3F))
    else if (cp < 0x10000) buf.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F))
    else buf.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F))
  }
  return new Uint8Array(buf)
}

function text2arrEncoder (str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

export async function benchArr2text () {
  for (const size of SIZES) {
    const text = getText(size)
    const arr = text2arr(text)
    const results: Array<{ name: string, ops: number }> = []

    results.push({ name: `arr2text lib       ${size}B`, ops: measure(() => arr2text(arr)) })
    results.push({ name: `arr2text manual    ${size}B`, ops: measure(() => manualUtf8Decode(arr)) })
    results.push({ name: `arr2text spread    ${size}B`, ops: measure(() => utf8Spread(arr)) })
    results.push({ name: `arr2text buffer    ${size}B`, ops: measure(() => arr2textBuffer(arr)) })
    results.push({ name: `arr2text utf-16le  ${size}B`, ops: measure(() => arr2text(arr, 'utf-16le')) })
    results.push({ name: `arr2text latin1    ${size}B`, ops: measure(() => arr2text(arr, 'latin1')) })
    results.push({ name: `arr2text ascii     ${size}B`, ops: measure(() => arr2text(arr, 'ascii')) })

    run(`arr2text ${size}B`, results)
  }
}

export async function benchText2arr () {
  for (const size of SIZES) {
    const text = getText(size)
    const results: Array<{ name: string, ops: number }> = []

    results.push({ name: `text2arr lib       ${size}B`, ops: measure(() => text2arr(text)) })
    results.push({ name: `text2arr lib-br    ${size}B`, ops: measure(() => text2arrBr(text)) })
    results.push({ name: `text2arr encoder   ${size}B`, ops: measure(() => text2arrEncoder(text)) })
    results.push({ name: `text2arr manual    ${size}B`, ops: measure(() => manualUtf8Encode(text)) })

    run(`text2arr ${size}B`, results)
  }
}
