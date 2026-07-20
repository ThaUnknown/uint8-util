import assert from 'node:assert/strict'
import * as crypto from 'node:crypto'
import { describe, it } from 'node:test'

import * as browserMod from '../src/browser.js'
import * as nodeMod from '../src/node.js'

function randArr (len: number) {
  const arr = new Uint8Array(len)
  for (let i = 0; i < len; i++) arr[i] = (Math.random() * 256) | 0
  return arr
}

// ------- arr2hex / hex2arr -------

describe('arr2hex / hex2arr', () => {
  it('roundtrip', () => {
    const arr = new Uint8Array([0, 1, 2, 255, 128, 64, 32, 16, 8, 4, 2, 1])
    const h = nodeMod.arr2hex(arr)
    assert.equal(h, Buffer.from(arr).toString('hex'))
    assert.deepEqual([...nodeMod.hex2arr(h)], [...arr])
  })

  it('empty', () => {
    assert.equal(nodeMod.arr2hex(new Uint8Array(0)), '')
    assert.equal(nodeMod.hex2arr('').length, 0)
  })

  it('various lengths', () => {
    for (const len of [1, 2, 3, 4, 7, 8, 15, 16, 31, 32, 127, 128, 129, 255, 256, 1024]) {
      const arr = randArr(len)
      const h = nodeMod.arr2hex(arr)
      assert.equal(h, Buffer.from(arr).toString('hex'))
      assert.deepEqual([...nodeMod.hex2arr(h)], [...arr])
    }
  })

  it('hex2arr lowercase input', () => {
    const arr = nodeMod.hex2arr('abcdef0123456789')
    assert.deepEqual([...arr], [0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89])
  })
})

// ------- concat -------

describe('concat', () => {
  it('basic', () => {
    const a = new Uint8Array([1, 2, 3])
    const b = new Uint8Array([4, 5, 6])
    const c = nodeMod.concat([a, b])
    assert.deepEqual([...c], [1, 2, 3, 4, 5, 6])
  })

  it('explicit size', () => {
    const a = new Uint8Array([1, 2, 3])
    const b = new Uint8Array([4, 5, 6])
    const c = nodeMod.concat([a, b], 6)
    assert.deepEqual([...c], [1, 2, 3, 4, 5, 6])
  })

  it('empty chunks', () => {
    assert.equal(nodeMod.concat([]).length, 0)
    assert.equal(nodeMod.concat([new Uint8Array(0)]).length, 0)
  })

  it('mixed types', () => {
    const c = nodeMod.concat([[1, 2], new Uint16Array([3, 4])])
    assert.deepEqual([...c], [1, 2, 3, 4])
  })
})

// ------- equal -------

describe('equal', () => {
  it('equal arrays', () => {
    const a = randArr(10)
    assert.ok(nodeMod.equal(a, a.slice()))
  })

  it('unequal arrays', () => {
    const a = randArr(10)
    const b = a.slice()
    b[5]!++
    assert.ok(!nodeMod.equal(a, b))
  })

  it('different lengths', () => {
    assert.ok(!nodeMod.equal(new Uint8Array([1]), new Uint8Array([1, 2])))
  })

  it('empty arrays', () => {
    assert.ok(nodeMod.equal(new Uint8Array(0), new Uint8Array(0)))
  })

  it('large arrays (>512) — fast 64-bit path', () => {
    const a = randArr(520)
    const b = a.slice()
    assert.ok(nodeMod.equal(a, b))
    b[519]!++
    assert.ok(!nodeMod.equal(a, b))
  })

  it('large arrays (len not multiple of 8) — remainder path', () => {
    const a = randArr(519)
    assert.ok(nodeMod.equal(a, a.slice()))
    const b = a.slice(); b[518]!++
    assert.ok(!nodeMod.equal(a, b))
  })

  it('large arrays — single byte diff in aligned region', () => {
    const a = randArr(520)
    const b = a.slice()
    b[100]!++
    assert.ok(!nodeMod.equal(a, b))
  })

  it('large arrays — diff in remainder after words', () => {
    const a = randArr(519)
    const b = a.slice()
    b[515]!++
    assert.ok(!nodeMod.equal(a, b))
  })

  it('large arrays — diff in remainder byte (non-multiple of 8)', () => {
    const a = randArr(522)
    const b = a.slice()
    b[521]!++
    assert.ok(!nodeMod.equal(a, b))
  })

  it('large arrays — unaligned offset (byteOffset & 7 !== 0)', () => {
    const buf = new ArrayBuffer(600)
    const a = new Uint8Array(buf, 7, 520); a.fill(0xaa)
    const b = new Uint8Array(buf.slice(0), 3, 520); b.fill(0xaa)
    assert.ok(nodeMod.equal(a, b))
  })

  it('large arrays — unaligned offset differing in prefix', () => {
    const buf = new ArrayBuffer(600)
    const a = new Uint8Array(buf, 7, 520); a.fill(0xaa)
    const b = new Uint8Array(buf.slice(0), 3, 520); b.fill(0xaa)
    b[2] = 0
    assert.ok(!nodeMod.equal(a, b))
  })
})

// ------- compare -------

describe('compare', () => {
  it('equal returns 0', () => {
    const a = randArr(10)
    assert.equal(nodeMod.compare(a, a.slice()), 0)
  })

  it('a < b returns negative', () => {
    const a = new Uint8Array([1, 2, 3])
    const b = new Uint8Array([1, 2, 4])
    assert.ok(nodeMod.compare(a, b) < 0)
  })

  it('a > b returns positive', () => {
    const a = new Uint8Array([1, 2, 4])
    const b = new Uint8Array([1, 2, 3])
    assert.ok(nodeMod.compare(a, b) > 0)
  })

  it('large arrays (>512) — fast path equal', () => {
    const a = randArr(520)
    assert.equal(nodeMod.compare(a, a.slice()), 0)
  })

  it('large arrays (len not multiple of 8) — remainder path', () => {
    const a = randArr(519)
    assert.equal(nodeMod.compare(a, a.slice()), 0)
    const b = a.slice(); b[518]!++
    assert.ok(nodeMod.compare(a, b) !== 0)
  })

  it('large arrays — fast path diff in words', () => {
    const a = randArr(520)
    const b = a.slice()
    b[50]!++
    assert.ok(nodeMod.compare(a, b) !== 0)
  })

  it('large arrays — diff in remainder', () => {
    const a = randArr(519)
    const b = a.slice()
    b[515]!++
    assert.notEqual(nodeMod.compare(a, b), 0)
  })

  it('large arrays — unaligned offset (byteOffset & 7 !== 0)', () => {
    const buf = new ArrayBuffer(600)
    const a = new Uint8Array(buf, 7, 520); a.fill(0xaa)
    const b = new Uint8Array(buf.slice(0), 3, 520); b.fill(0xaa)
    assert.equal(nodeMod.compare(a, b), 0)
  })

  it('large arrays — unaligned offset differing in prefix', () => {
    const buf = new ArrayBuffer(600)
    const a = new Uint8Array(buf, 7, 520); a.fill(0xaa)
    const b = new Uint8Array(buf.slice(0), 3, 520); b.fill(0xaa)
    b[2] = 0
    assert.ok(nodeMod.compare(a, b) !== 0)
  })

  it('first different element determines result', () => {
    const a = new Uint8Array([10, 20, 30])
    const b = new Uint8Array([10, 25, 30])
    assert.ok(nodeMod.compare(a, b) < 0)
  })

  it('different lengths (min < 128) — prefix match returns 0 (node behavior)', () => {
    const a = new Uint8Array([1, 2, 3])
    const b = new Uint8Array([1, 2, 3, 4])
    assert.equal(nodeMod.compare(a, b), 0)
    assert.equal(nodeMod.compare(b, a), 0)
  })

  it('different lengths (min >= 128) — uses Buffer.compare', () => {
    const a = randArr(200)
    const b = new Uint8Array([...a, 0])
    assert.equal(nodeMod.compare(a, b), Buffer.compare(a, b))
    assert.equal(nodeMod.compare(b, a), Buffer.compare(b, a))
  })
})

// ------- xor / or / and -------

describe('xor', () => {
  it('basic', () => {
    const a = new Uint8Array([0b1010, 0b1111])
    const b = new Uint8Array([0b1100, 0b0000])
    nodeMod.xor(a, b)
    assert.deepEqual([...a], [0b0110, 0b1111])
  })

  it('mutates in-place', () => {
    const a = new Uint8Array([1, 2, 3])
    const b = new Uint8Array([3, 2, 1])
    const r = nodeMod.xor(a, b)
    assert.equal(r, a)
  })

  it('large arrays (>128) — 64-bit path', () => {
    const a = randArr(200)
    const b = randArr(200)
    const expected = a.map((v, i) => v ^ b[i]!)
    nodeMod.xor(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('large arrays — unaligned offset (bitwise64 prefix)', () => {
    const buf = new Uint8Array(200)
    const a = new Uint8Array(buf.buffer, 1, 150)
    const b = new Uint8Array(buf.buffer, 2, 150)
    for (let i = 0; i < 150; i++) { a[i] = i; b[i] = i ^ 0xff }
    const expected = a.map((v, i) => v ^ b[i]!)
    nodeMod.xor(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('large arrays — non-multiple-of-8 length (bitwise64 remainder)', () => {
    const a = randArr(135)
    const b = randArr(135)
    const expected = a.map((v, i) => v ^ b[i]!)
    nodeMod.xor(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('large arrays — same unaligned byteOffset (bitwise64 prefix)', () => {
    const buf = new Uint8Array(300)
    const a = new Uint8Array(buf.buffer, 3, 200)
    const b = new Uint8Array(buf.buffer, 3, 200)
    for (let i = 0; i < 200; i++) { a[i] = i; b[i] = i ^ 0xff }
    const expected = a.map((v, i) => v ^ b[i]!)
    nodeMod.xor(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('large arrays — differing but same-alignment byteOffsets (aOff=1, bOff=9)', () => {
    const buf = new Uint8Array(300)
    const a = new Uint8Array(buf.buffer, 1, 200)
    const b = new Uint8Array(buf.buffer, 9, 200)
    for (let i = 0; i < 200; i++) { a[i] = i; b[i] = i ^ 0xff }
    const expected = a.map((v, i) => v ^ b[i]!)
    nodeMod.xor(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('empty', () => {
    const a = new Uint8Array(0)
    nodeMod.xor(a, a)
    assert.equal(a.length, 0)
  })

  it('works on number[]', () => {
    const a = [0b1010, 0b1111]
    const b = [0b1100, 0b0000]
    nodeMod.xor(a, b)
    assert.deepEqual(a, [0b0110, 0b1111])
  })

  it('number[] fallback — large', () => {
    const a: number[] = []
    const b: number[] = []
    for (let i = 0; i < 100; i++) { a.push(i); b.push(i ^ 0xff) }
    const expected = a.map((v, i) => v ^ b[i])
    nodeMod.xor(a, b)
    assert.deepEqual(a, expected)
  })

  it('mixed typed array and number[] — large', () => {
    const a = new Uint8Array([...Array(100)].map((_, i) => i))
    const b: number[] = Array.from(a).map(v => v ^ 0xff)
    const expected = a.map((v, i) => v ^ b[i])
    nodeMod.xor(a, b)
    assert.deepEqual([...a], [...expected])
  })

  // -------- regression: same-buffer views (direct indexing) --------

  it('same-buffer — aligned, equal', () => {
    const buf = new Uint8Array([...randArr(300)]); buf.fill(0xaa)
    const a = new Uint8Array(buf.buffer, 0, 150)
    const b = new Uint8Array(buf.buffer, 0, 150)
    const expected = a.map((v, i) => v ^ b[i]!)
    nodeMod.xor(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('same-buffer — unaligned same offset', () => {
    const buf = new Uint8Array([...randArr(300)]); buf.fill(0xaa)
    const a = new Uint8Array(buf.buffer, 5, 150)
    const b = new Uint8Array(buf.buffer, 5, 150)
    const expected = a.map((v, i) => v ^ b[i]!)
    nodeMod.xor(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('same-buffer — unaligned diff offset, same alignment', () => {
    const buf = new Uint8Array([...randArr(400)])
    const a = new Uint8Array(buf.buffer, 1, 200)
    const b = new Uint8Array(buf.buffer, 9, 200)
    const expected = a.map((v, i) => v ^ b[i]!)
    nodeMod.xor(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('same-buffer — unaligned diff offset, same alignment, diff in remainder', () => {
    const buf = new Uint8Array([...randArr(400)])
    const a = new Uint8Array(buf.buffer, 1, 135)
    const b = new Uint8Array(buf.buffer, 9, 135)
    const expected = a.map((v, i) => v ^ b[i]!)
    nodeMod.xor(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('unaligned — prefix offset 1-7', () => {
    for (const offset of [0, 1, 2, 3, 4, 5, 6, 7] as const) {
      const buf = new Uint8Array([...randArr(300)])
      const a = new Uint8Array(buf.buffer, offset, 150); a.fill(0xaa)
      const b = new Uint8Array(buf.slice().buffer, offset, 150); b.fill(0x55)
      const expected = a.map((v, i) => v ^ b[i]!)
      nodeMod.xor(a, b)
      assert.deepEqual([...a], [...expected], `offset=${offset}`)
    }
  })

  it('unaligned — diff at each prefix byte position 0-6', () => {
    for (const offset of [1, 2, 3, 4, 5, 6, 7] as const) {
      for (const diffPos of [0, 1, 2, 3, 4, 5, 6]) {
        if (diffPos >= 8 - offset) continue
        const buf = new Uint8Array(300)
        const a = new Uint8Array(buf.buffer, offset, 150); a.fill(0xaa)
        const b = new Uint8Array(buf.slice().buffer, offset, 150); b.fill(0xbb)
        b[diffPos] = 0x55
        const expected = a.map((v, i) => v ^ b[i]!)
        nodeMod.xor(a, b)
        assert.deepEqual([...a], [...expected], `offset=${offset} diffPos=${diffPos}`)
      }
    }
  })

  it('64-bit path — remainder lengths 1-7', () => {
    for (const rem of [1, 2, 3, 4, 5, 6, 7]) {
      const len = 128 + rem
      const a = randArr(len)
      const b = randArr(len)
      const expected = a.map((v, i) => v ^ b[i]!)
      nodeMod.xor(a, b)
      assert.deepEqual([...a], [...expected], `remainder=${rem}`)
    }
  })
})

describe('or', () => {
  it('basic', () => {
    const a = new Uint8Array([0b1010, 0b1111])
    const b = new Uint8Array([0b0101, 0b0000])
    nodeMod.or(a, b)
    assert.deepEqual([...a], [0b1111, 0b1111])
  })

  it('large arrays (>128) — 64-bit path', () => {
    const a = randArr(200)
    const b = randArr(200)
    const expected = a.map((v, i) => v | b[i]!)
    nodeMod.or(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('large arrays — unaligned offset', () => {
    const buf = new Uint8Array(200)
    const a = new Uint8Array(buf.buffer, 1, 150)
    const b = new Uint8Array(buf.buffer, 2, 150)
    for (let i = 0; i < 150; i++) { a[i] = i; b[i] = i ^ 0xff }
    const expected = a.map((v, i) => v | b[i]!)
    nodeMod.or(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('large arrays — non-multiple-of-8 length', () => {
    const a = randArr(135)
    const b = randArr(135)
    const expected = a.map((v, i) => v | b[i]!)
    nodeMod.or(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('large arrays — same unaligned byteOffset (bitwise64 prefix)', () => {
    const buf = new Uint8Array(300)
    const a = new Uint8Array(buf.buffer, 3, 200)
    const b = new Uint8Array(buf.buffer, 3, 200)
    for (let i = 0; i < 200; i++) { a[i] = i; b[i] = i ^ 0xff }
    const expected = a.map((v, i) => v | b[i]!)
    nodeMod.or(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('large arrays — differing but same-alignment byteOffsets (aOff=1, bOff=9)', () => {
    const buf = new Uint8Array(300)
    const a = new Uint8Array(buf.buffer, 1, 200)
    const b = new Uint8Array(buf.buffer, 9, 200)
    for (let i = 0; i < 200; i++) { a[i] = i; b[i] = i ^ 0xff }
    const expected = a.map((v, i) => v | b[i]!)
    nodeMod.or(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('works on number[]', () => {
    const a = [0b1010, 0b1111]
    const b = [0b0101, 0b0000]
    nodeMod.or(a, b)
    assert.deepEqual(a, [0b1111, 0b1111])
  })

  it('mixed typed array and number[] — large', () => {
    const a = new Uint8Array([...Array(100)].map((_, i) => i))
    const b: number[] = Array.from(a).map(v => v | 0x80)
    const expected = a.map((v, i) => v | b[i])
    nodeMod.or(a, b)
    assert.deepEqual([...a], [...expected])
  })

  // -------- regression: same-buffer views (direct indexing) --------

  it('same-buffer — aligned', () => {
    const buf = new Uint8Array([...randArr(300)]); buf.fill(0xaa)
    const a = new Uint8Array(buf.buffer, 0, 150)
    const b = new Uint8Array(buf.buffer, 0, 150)
    const expected = a.map((v, i) => v | b[i]!)
    nodeMod.or(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('same-buffer — unaligned same offset', () => {
    const buf = new Uint8Array([...randArr(300)]); buf.fill(0xaa)
    const a = new Uint8Array(buf.buffer, 5, 150)
    const b = new Uint8Array(buf.buffer, 5, 150)
    const expected = a.map((v, i) => v | b[i]!)
    nodeMod.or(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('same-buffer — unaligned diff offset, same alignment', () => {
    const buf = new Uint8Array([...randArr(400)])
    const a = new Uint8Array(buf.buffer, 1, 200)
    const b = new Uint8Array(buf.buffer, 9, 200)
    const expected = a.map((v, i) => v | b[i]!)
    nodeMod.or(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('same-buffer — unaligned diff offset, same alignment, diff in remainder', () => {
    const buf = new Uint8Array([...randArr(400)])
    const a = new Uint8Array(buf.buffer, 1, 135)
    const b = new Uint8Array(buf.buffer, 9, 135)
    const expected = a.map((v, i) => v | b[i]!)
    nodeMod.or(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('unaligned — prefix offset 1-7', () => {
    for (const offset of [0, 1, 2, 3, 4, 5, 6, 7] as const) {
      const buf = new Uint8Array([...randArr(300)])
      const a = new Uint8Array(buf.buffer, offset, 150); a.fill(0xaa)
      const b = new Uint8Array(buf.slice().buffer, offset, 150); b.fill(0x55)
      const expected = a.map((v, i) => v | b[i]!)
      nodeMod.or(a, b)
      assert.deepEqual([...a], [...expected], `offset=${offset}`)
    }
  })

  it('64-bit path — remainder lengths 1-7', () => {
    for (const rem of [1, 2, 3, 4, 5, 6, 7]) {
      const len = 128 + rem
      const a = randArr(len)
      const b = randArr(len)
      const expected = a.map((v, i) => v | b[i]!)
      nodeMod.or(a, b)
      assert.deepEqual([...a], [...expected], `remainder=${rem}`)
    }
  })
})

describe('and', () => {
  it('basic', () => {
    const a = new Uint8Array([0b1010, 0b1111])
    const b = new Uint8Array([0b0110, 0b0001])
    nodeMod.and(a, b)
    assert.deepEqual([...a], [0b0010, 0b0001])
  })

  it('large arrays (>128) — 64-bit path', () => {
    const a = randArr(200)
    const b = randArr(200)
    const expected = a.map((v, i) => v & b[i]!)
    nodeMod.and(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('large arrays — unaligned offset', () => {
    const buf = new Uint8Array(200)
    const a = new Uint8Array(buf.buffer, 1, 150)
    const b = new Uint8Array(buf.buffer, 2, 150)
    for (let i = 0; i < 150; i++) { a[i] = i; b[i] = i ^ 0xff }
    const expected = a.map((v, i) => v & b[i]!)
    nodeMod.and(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('large arrays — non-multiple-of-8 length', () => {
    const a = randArr(135)
    const b = randArr(135)
    const expected = a.map((v, i) => v & b[i]!)
    nodeMod.and(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('large arrays — same unaligned byteOffset (bitwise64 prefix)', () => {
    const buf = new Uint8Array(300)
    const a = new Uint8Array(buf.buffer, 3, 200)
    const b = new Uint8Array(buf.buffer, 3, 200)
    for (let i = 0; i < 200; i++) { a[i] = i; b[i] = i ^ 0xff }
    const expected = a.map((v, i) => v & b[i]!)
    nodeMod.and(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('large arrays — differing but same-alignment byteOffsets (aOff=1, bOff=9)', () => {
    const buf = new Uint8Array(300)
    const a = new Uint8Array(buf.buffer, 1, 200)
    const b = new Uint8Array(buf.buffer, 9, 200)
    for (let i = 0; i < 200; i++) { a[i] = i; b[i] = i ^ 0xff }
    const expected = a.map((v, i) => v & b[i]!)
    nodeMod.and(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('works on number[]', () => {
    const a = [0b1010, 0b1111]
    const b = [0b0110, 0b0001]
    nodeMod.and(a, b)
    assert.deepEqual(a, [0b0010, 0b0001])
  })

  it('mixed typed array and number[] — large', () => {
    const a = new Uint8Array([...Array(100)].map((_, i) => i))
    const b: number[] = Array.from(a).map(v => v & 0xaa)
    const expected = a.map((v, i) => v & b[i])
    nodeMod.and(a, b)
    assert.deepEqual([...a], [...expected])
  })

  // -------- regression: same-buffer views (direct indexing) --------

  it('same-buffer — aligned', () => {
    const buf = new Uint8Array([...randArr(300)]); buf.fill(0xaa)
    const a = new Uint8Array(buf.buffer, 0, 150)
    const b = new Uint8Array(buf.buffer, 0, 150)
    const expected = a.map((v, i) => v & b[i]!)
    nodeMod.and(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('same-buffer — unaligned same offset', () => {
    const buf = new Uint8Array([...randArr(300)]); buf.fill(0xaa)
    const a = new Uint8Array(buf.buffer, 5, 150)
    const b = new Uint8Array(buf.buffer, 5, 150)
    const expected = a.map((v, i) => v & b[i]!)
    nodeMod.and(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('same-buffer — unaligned diff offset, same alignment', () => {
    const buf = new Uint8Array([...randArr(400)])
    const a = new Uint8Array(buf.buffer, 1, 200)
    const b = new Uint8Array(buf.buffer, 9, 200)
    const expected = a.map((v, i) => v & b[i]!)
    nodeMod.and(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('same-buffer — unaligned diff offset, same alignment, diff in remainder', () => {
    const buf = new Uint8Array([...randArr(400)])
    const a = new Uint8Array(buf.buffer, 1, 135)
    const b = new Uint8Array(buf.buffer, 9, 135)
    const expected = a.map((v, i) => v & b[i]!)
    nodeMod.and(a, b)
    assert.deepEqual([...a], [...expected])
  })

  it('unaligned — prefix offset 1-7', () => {
    for (const offset of [0, 1, 2, 3, 4, 5, 6, 7] as const) {
      const buf = new Uint8Array([...randArr(300)])
      const a = new Uint8Array(buf.buffer, offset, 150); a.fill(0xaa)
      const b = new Uint8Array(buf.slice().buffer, offset, 150); b.fill(0x55)
      const expected = a.map((v, i) => v & b[i]!)
      nodeMod.and(a, b)
      assert.deepEqual([...a], [...expected], `offset=${offset}`)
    }
  })

  it('64-bit path — remainder lengths 1-7', () => {
    for (const rem of [1, 2, 3, 4, 5, 6, 7]) {
      const len = 128 + rem
      const a = randArr(len)
      const b = randArr(len)
      const expected = a.map((v, i) => v & b[i]!)
      nodeMod.and(a, b)
      assert.deepEqual([...a], [...expected], `remainder=${rem}`)
    }
  })
})

// ------- arr2text / text2arr (Node) -------

describe('Node: arr2text / text2arr', () => {
  it('text2arr roundtrip', () => {
    const str = 'hello world ñoño 🎉'
    const arr = nodeMod.text2arr(str)
    assert.deepEqual([...arr], [...Buffer.from(str, 'utf8')])
    assert.equal(nodeMod.arr2text(arr), str)
  })

  it('text2arr empty', () => {
    assert.equal(nodeMod.text2arr('').length, 0)
  })

  it('arr2text with utf-8 encoding', () => {
    const arr = new Uint8Array([0xc3, 0xb1, 0xf0, 0x9f, 0x8e, 0x89])
    assert.equal(nodeMod.arr2text(arr, 'utf-8'), 'ñ🎉')
    assert.equal(nodeMod.arr2text(arr, 'utf-8'), Buffer.from(arr).toString('utf-8'))
  })

  it('arr2text with utf-16le encoding', () => {
    const arr = new Uint8Array([0xf1, 0x00, 0x3d, 0xd8, 0x49, 0xdc])
    assert.equal(nodeMod.arr2text(arr, 'utf-16le'), Buffer.from(arr).toString('utf16le'))
  })

  it('arr2text with ascii encoding — low bytes (0-127)', () => {
    const arr = new Uint8Array([65, 66, 67, 0, 31, 127])
    assert.equal(nodeMod.arr2text(arr, 'ascii'), Buffer.from(arr).toString('ascii'))
  })

  it('arr2text works on ArrayBuffer', () => {
    const ab = new Uint8Array([104, 105]).buffer
    assert.equal(nodeMod.arr2text(ab), 'hi')
  })
})

// ------- arr2base / base2arr (Node) -------

describe('Node: arr2base / base2arr', () => {
  it('roundtrip', () => {
    const arr = randArr(20)
    const b64 = nodeMod.arr2base(arr)
    assert.equal(b64, Buffer.from(arr).toString('base64'))
    assert.deepEqual([...nodeMod.base2arr(b64)], [...arr])
  })

  it('empty', () => {
    assert.equal(nodeMod.arr2base(new Uint8Array(0)), '')
    assert.equal(nodeMod.base2arr('').length, 0)
  })

  it('padding', () => {
    assert.equal(nodeMod.arr2base(new Uint8Array([0])), 'AA==')
    assert.equal(nodeMod.arr2base(new Uint8Array([0, 0])), 'AAA=')
    assert.equal(nodeMod.arr2base(new Uint8Array([0, 0, 0])), 'AAAA')
  })
})

// ------- hex2bin / bin2hex (Node) -------

describe('Node: hex2bin / bin2hex', () => {
  it('roundtrip', () => {
    const bin = '\x00\x01\xff\xfe\x80\x7f'
    const h = nodeMod.bin2hex(bin)
    assert.equal(h, Buffer.from(bin, 'binary').toString('hex'))
    assert.equal(nodeMod.hex2bin(h), bin)
  })

  it('empty', () => {
    assert.equal(nodeMod.hex2bin(''), '')
    assert.equal(nodeMod.bin2hex(''), '')
  })

  it('hex2bin via Buffer', () => {
    const hex = 'aabbccdd'
    assert.equal(nodeMod.hex2bin(hex), Buffer.from(hex, 'hex').toString('binary'))
  })
})

// ------- hash (Node) -------

describe('Node: hash', () => {
  const testData = 'hello world'
  const testArr = new Uint8Array([104, 101, 108, 108, 111])

  async function ref (data: string | Uint8Array, algo: string, format?: 'hex' | 'base64') {
    const hash = crypto.createHash(algo.replace('sha-', 'sha'))
    if (typeof data === 'string') hash.update(data, 'utf-8')
    else hash.update(data)
    if (format === 'hex' || format === 'base64') return hash.digest(format)
    return new Uint8Array(hash.digest().buffer)
  }

  for (const algo of ['sha-1', 'sha-256', 'sha-384', 'sha-512'] as const) {
    it(`${algo} raw`, async () => {
      const result = await nodeMod.hash(testData, undefined, algo)
      const expected = await ref(testData, algo)
      assert.deepEqual([...result], [...expected])
    })

    it(`${algo} hex`, async () => {
      const result = await nodeMod.hash(testData, 'hex', algo)
      const expected = await ref(testData, algo, 'hex')
      assert.equal(result, expected)
    })

    it(`${algo} base64`, async () => {
      const result = await nodeMod.hash(testData, 'base64', algo)
      const expected = await ref(testData, algo, 'base64')
      assert.equal(result, expected)
    })
  }

  it('hash with Uint8Array input', async () => {
    const result = await nodeMod.hash(testArr, 'hex')
    const expected = crypto.createHash('sha1').update(testArr).digest('hex')
    assert.equal(result, expected)
  })

  it('hash with ArrayBuffer input', async () => {
    const ab = testArr.buffer
    const result = await nodeMod.hash(ab, 'hex')
    assert.equal(result, crypto.createHash('sha1').update(testArr).digest('hex'))
  })

  it('hash default algo is sha1', async () => {
    const r1 = await nodeMod.hash(testData)
    const r2 = await nodeMod.hash(testData, undefined, 'sha-1')
    assert.deepEqual([...r1], [...r2])
  })

  it('hash without format returns Uint8Array', async () => {
    const result = await nodeMod.hash(testData)
    assert.ok(result instanceof Uint8Array)
    assert.equal(result.length, 20)
  })
})

// ------- randomBytes (Node) -------

describe('Node: randomBytes', () => {
  it('returns correct length', () => {
    const buf = nodeMod.randomBytes(32)
    assert.ok(buf instanceof Uint8Array)
    assert.equal(buf.length, 32)
  })

  it('produces different values', () => {
    const a = nodeMod.randomBytes(16)
    const b = nodeMod.randomBytes(16)
    assert.notEqual(nodeMod.arr2hex(a), nodeMod.arr2hex(b))
  })
})

// ======== BROWSER MODULE ========

describe('Browser: arr2hex / hex2arr', () => {
  it('odd-length array hits fallback loop', () => {
    const arr = new Uint8Array([0, 1, 2])
    assert.equal(browserMod.arr2hex(arr), '000102')
  })

  it('hex2arr odd-length hex string hits fallback loop', () => {
    assert.deepEqual([...browserMod.hex2arr('aabb')], [0xaa, 0xbb])
  })
})

describe('Browser: arr2text / text2arr', () => {
  it('text2arr roundtrip', () => {
    const str = 'hello world ñoño 🎉'
    const arr = browserMod.text2arr(str)
    assert.deepEqual([...arr], [...Buffer.from(str, 'utf8')])
    assert.equal(browserMod.arr2text(arr), str)
  })

  it('arr2text with utf-8 encoding', () => {
    const arr = new Uint8Array([0xc3, 0xb1, 0xf0, 0x9f, 0x8e, 0x89])
    assert.equal(browserMod.arr2text(arr, 'utf-8'), 'ñ🎉')
  })

  it('arr2text with utf-16le', () => {
    const arr = new Uint8Array([0xf1, 0x00, 0x3d, 0xd8, 0x49, 0xdc])
    assert.equal(browserMod.arr2text(arr, 'utf-16le'), Buffer.from(arr).toString('utf16le'))
  })
})

describe('Browser: arr2base / base2arr', () => {
  it('roundtrip', () => {
    const arr = randArr(20)
    const b64 = browserMod.arr2base(arr)
    assert.equal(b64, Buffer.from(arr).toString('base64'))
    assert.deepEqual([...browserMod.base2arr(b64)], [...arr])
  })

  it('empty', () => {
    assert.equal(browserMod.arr2base(new Uint8Array(0)), '')
    assert.equal(browserMod.base2arr('').length, 0)
  })

  it('large array (>0x10000) — chunked btoa path', () => {
    const arr = randArr(0x10001)
    const result = browserMod.arr2base(arr)
    assert.equal(result, Buffer.from(arr).toString('base64'))
    assert.deepEqual([...browserMod.base2arr(result)], [...arr])
  })

  it('exactly 0x10000 boundary', () => {
    const arr = randArr(0x10000)
    const result = browserMod.arr2base(arr)
    assert.equal(result, Buffer.from(arr).toString('base64'))
  })
})

describe('Browser: bin2hex / hex2bin', () => {
  it('roundtrip', () => {
    const bin = '\x00\x01\xff\xfe\x80\x7f\xab\xcd'
    const h = browserMod.bin2hex(bin)
    assert.equal(h, Buffer.from(bin, 'binary').toString('hex'))
    assert.equal(browserMod.hex2bin(h), bin)
  })

  it('large binary string for hex2bin chunked path', () => {
    const arr = randArr(0x10001)
    const bin = String.fromCharCode(...arr)
    const hex = browserMod.bin2hex(bin)
    assert.equal(hex, Buffer.from(bin, 'binary').toString('hex'))
    assert.equal(browserMod.hex2bin(hex), bin)
  })
})

describe('Browser: hash', () => {
  const testData = 'hello world'

  for (const algo of ['sha-1', 'sha-256', 'sha-384', 'sha-512'] as const) {
    it(`${algo} hex`, async () => {
      const result = await browserMod.hash(testData, 'hex', algo)
      const expected = crypto.createHash(algo.replace('sha-', 'sha')).update(testData).digest('hex')
      assert.equal(result, expected)
    })

    it(`${algo} base64`, async () => {
      const result = await browserMod.hash(testData, 'base64', algo)
      const expected = crypto.createHash(algo.replace('sha-', 'sha')).update(testData).digest('base64')
      assert.equal(result, expected)
    })
  }

  it('hash without format returns Uint8Array', async () => {
    const result = await browserMod.hash(testData)
    assert.ok(result instanceof Uint8Array)
    assert.equal(result.length, 20)
  })

  it('hash with Uint8Array input', async () => {
    const arr = new Uint8Array([104, 101, 108, 108, 111])
    const result = await browserMod.hash(arr, 'hex')
    const expected = crypto.createHash('sha1').update(arr).digest('hex')
    assert.equal(result, expected)
  })
})

describe('Browser: randomBytes', () => {
  it('returns correct length', () => {
    const buf = browserMod.randomBytes(64)
    assert.ok(buf instanceof Uint8Array)
    assert.equal(buf.length, 64)
  })
})

// ======== SHARED UTILS (re-exported by both) ========

describe('shared: equal (browser)', () => {
  it('matches node equal', () => {
    const a = randArr(150)
    assert.equal(browserMod.equal(a, a.slice()), nodeMod.equal(a, a.slice()))
    const b = a.slice(); b[0]!++
    assert.equal(browserMod.equal(a, b), nodeMod.equal(a, b))
  })

  it('64-bit path — diff in word region', () => {
    const a = randArr(200); const b = a.slice(); b[50]!++
    assert.ok(!browserMod.equal(a, b))
  })

  it('64-bit path — diff in remainder after words', () => {
    const a = randArr(135); const b = a.slice(); b[130]!++
    assert.ok(!browserMod.equal(a, b))
  })

  it('64-bit path — unaligned (byteOffset & 7 !== 0)', () => {
    const buf = new ArrayBuffer(300)
    const a = new Uint8Array(buf, 1, 150); a.fill(0xaa)
    const b = new Uint8Array(buf.slice(0), 1, 150); b.fill(0xaa)
    assert.ok(browserMod.equal(a, b))
  })

  it('64-bit path — unaligned diff in prefix bytes', () => {
    const buf = new ArrayBuffer(300)
    const a = new Uint8Array(buf, 1, 150); a.fill(0xaa)
    const b = new Uint8Array(buf.slice(0), 1, 150); b.fill(0xaa); b[0] = 0
    assert.ok(!browserMod.equal(a, b))
  })

  it('64-bit path — unaligned diff in word region', () => {
    const buf = new ArrayBuffer(300)
    const a = new Uint8Array(buf, 1, 150); a.fill(0xaa); a[50] = 0x55
    const b = new Uint8Array(buf.slice(0), 1, 150); b.fill(0xaa); b[50] = 0xaa
    assert.ok(!browserMod.equal(a, b))
  })

  it('64-bit path — unaligned diff in remainder', () => {
    const buf = new ArrayBuffer(300)
    const a = new Uint8Array(buf, 1, 135); a.fill(0xaa); a[130] = 0x55
    const b = new Uint8Array(buf.slice(0), 1, 135); b.fill(0xaa)
    assert.ok(!browserMod.equal(a, b))
  })

  it('64-bit path — different-length arrays return false', () => {
    const a = randArr(200)
    assert.ok(!browserMod.equal(a, new Uint8Array(100)))
  })

  it('fallback — length <= 128 (byte loop)', () => {
    const a = new Uint8Array([1, 2, 3, 4, 5])
    assert.ok(browserMod.equal(a, a.slice()))
    const b = a.slice(); b[2] = 0
    assert.ok(!browserMod.equal(a, b))
  })

  // -------- regression: same-buffer views (direct indexing) --------

  it('same-buffer — aligned, equal', () => {
    const buf = new Uint8Array(300); buf.fill(0xaa)
    const a = new Uint8Array(buf.buffer, 0, 150)
    const b = new Uint8Array(buf.buffer, 0, 150)
    assert.ok(browserMod.equal(a, b))
  })

  it('same-buffer — unaligned same offset, equal', () => {
    const buf = new Uint8Array(300); buf.fill(0xaa)
    const a = new Uint8Array(buf.buffer, 5, 150)
    const b = new Uint8Array(buf.buffer, 5, 150)
    assert.ok(browserMod.equal(a, b))
  })

  it('same-buffer — unaligned same offset, diff (separate buffers)', () => {
    const buf = new Uint8Array(300)
    const a = new Uint8Array(buf.buffer, 5, 150); a.fill(0xaa)
    const b = new Uint8Array(buf.slice().buffer, 5, 150); b.fill(0xaa); b[3] = 0x55
    assert.ok(!browserMod.equal(a, b))
    const c = new Uint8Array(buf.slice().buffer, 5, 150); c.fill(0xaa); c[50] = 0x55
    assert.ok(!browserMod.equal(a, c))
  })

  it('same-buffer — unaligned same offset, diff in remainder (separate buffers)', () => {
    const buf = new Uint8Array(300)
    const a = new Uint8Array(buf.buffer, 3, 135); a.fill(0xaa); a[130] = 0x55
    const b = new Uint8Array(buf.slice().buffer, 3, 135); b.fill(0xaa)
    assert.ok(!browserMod.equal(a, b))
  })

  // -------- regression: offset 1-7 prefix with diff at each prefix position --------

  it('unaligned — diff at each prefix byte position 0-6', () => {
    for (const offset of [1, 2, 3, 4, 5, 6, 7] as const) {
      for (const diffPos of [0, 1, 2, 3, 4, 5, 6]) {
        if (diffPos >= 8 - offset) continue
        const buf = new Uint8Array(300)
        const a = new Uint8Array(buf.buffer, offset, 150); a.fill(0xaa)
        const b = new Uint8Array(buf.slice().buffer, offset, 150); b.fill(0xaa); b[diffPos] = 0x55
        assert.ok(!browserMod.equal(a, b), `offset=${offset} diffPos=${diffPos}`)
      }
    }
  })

  // -------- regression: diff at each of the 8 byte positions within a word --------

  it('64-bit path — diff at each byte position 0-7 inside a word', () => {
    for (let pos = 0; pos < 8; pos++) {
      const a = randArr(200); const b = a.slice()
      const wordStart = 48
      b[wordStart + pos] = a[wordStart + pos]! ^ 0xff
      assert.ok(!browserMod.equal(a, b), `bytePos=${pos}`)
    }
  })

  // -------- regression: various remainder lengths 1-7 --------

  it('64-bit path — remainder lengths 1-7', () => {
    for (const rem of [1, 2, 3, 4, 5, 6, 7]) {
      const len = 128 + rem
      const a = randArr(len)
      const b = a.slice(); b[len - 1]!++
      assert.ok(!browserMod.equal(a, b), `remainder=${rem}`)
    }
  })
})

describe('shared: compare (browser)', () => {
  it('matches node compare', () => {
    const a = randArr(150)
    assert.equal(browserMod.compare(a, a.slice()), 0)
    const b = a.slice(); b[100]!--
    assert.ok(browserMod.compare(a, b) > 0)
  })

  it('64-bit path — diff in word region', () => {
    const a = randArr(200); const b = a.slice(); b[50]!++
    assert.ok(browserMod.compare(a, b) !== 0)
  })

  it('64-bit path — diff in remainder after words', () => {
    const a = randArr(135); const b = a.slice(); b[130]!++
    assert.ok(browserMod.compare(a, b) !== 0)
  })

  it('64-bit path — unaligned (byteOffset & 7 !== 0)', () => {
    const buf = new ArrayBuffer(300)
    const a = new Uint8Array(buf, 1, 150); a.fill(0xaa)
    const b = new Uint8Array(buf.slice(0), 1, 150); b.fill(0xaa)
    assert.equal(browserMod.compare(a, b), 0)
  })

  it('64-bit path — unaligned diff in prefix bytes', () => {
    const buf = new ArrayBuffer(300)
    const a = new Uint8Array(buf, 1, 150); a.fill(0xaa)
    const b = new Uint8Array(buf.slice(0), 1, 150); b.fill(0xaa); b[0] = 0
    assert.ok(browserMod.compare(a, b) !== 0)
  })

  it('64-bit path — unaligned diff in word region', () => {
    const buf = new ArrayBuffer(300)
    const a = new Uint8Array(buf, 1, 150); a.fill(0xaa); a[50] = 0x55
    const b = new Uint8Array(buf.slice(0), 1, 150); b.fill(0xaa)
    assert.ok(browserMod.compare(a, b) !== 0)
  })

  it('64-bit path — unaligned diff in remainder', () => {
    const buf = new ArrayBuffer(300)
    const a = new Uint8Array(buf, 1, 135); a.fill(0xaa); a[130] = 0x55
    const b = new Uint8Array(buf.slice(0), 1, 135); b.fill(0xaa)
    assert.ok(browserMod.compare(a, b) !== 0)
  })

  it('64-bit path — a is prefix of b (different lengths)', () => {
    const a = new Uint8Array(200); a.fill(0xaa)
    const b = new Uint8Array(210); b.fill(0xaa)
    assert.equal(browserMod.compare(a, b), -10)
    assert.equal(browserMod.compare(b, a), 10)
  })

  it('fallback — different lengths (len <= 128)', () => {
    const a = new Uint8Array([1, 2, 3])
    assert.equal(browserMod.compare(a, new Uint8Array([1, 2, 3, 4])), -1)
    assert.equal(browserMod.compare(new Uint8Array([1, 2, 3, 4]), a), 1)
  })

  // -------- regression: same-buffer views (direct indexing) --------

  it('same-buffer — aligned, equal', () => {
    const buf = new Uint8Array(300); buf.fill(0xaa)
    const a = new Uint8Array(buf.buffer, 0, 150)
    const b = new Uint8Array(buf.buffer, 0, 150)
    assert.equal(browserMod.compare(a, b), 0)
  })

  it('same-buffer — unaligned same offset, equal', () => {
    const buf = new Uint8Array(300); buf.fill(0xaa)
    const a = new Uint8Array(buf.buffer, 5, 150)
    const b = new Uint8Array(buf.buffer, 5, 150)
    assert.equal(browserMod.compare(a, b), 0)
  })

  it('same-buffer — unaligned same offset, diff (separate buffers)', () => {
    const buf = new Uint8Array(300)
    const a = new Uint8Array(buf.buffer, 5, 150); a.fill(0xbb)
    const b = new Uint8Array(buf.slice().buffer, 5, 150); b.fill(0xbb); b[3] = 0x55
    assert.ok(browserMod.compare(a, b) !== 0)
    const c = new Uint8Array(buf.slice().buffer, 5, 150); c.fill(0xbb); c[50] = 0x55
    assert.ok(browserMod.compare(a, c) !== 0)
  })

  it('same-buffer — unaligned same offset, diff in remainder (separate buffers)', () => {
    const buf = new Uint8Array(300)
    const a = new Uint8Array(buf.buffer, 3, 135); a.fill(0xbb); a[130] = 0x55
    const b = new Uint8Array(buf.slice().buffer, 3, 135); b.fill(0xbb)
    assert.ok(browserMod.compare(a, b) !== 0)
  })

  // -------- regression: offset 1-7 prefix with diff at each prefix position --------

  it('unaligned — diff at each prefix byte position 0-6', () => {
    for (const offset of [1, 2, 3, 4, 5, 6, 7] as const) {
      for (const diffPos of [0, 1, 2, 3, 4, 5, 6]) {
        if (diffPos >= 8 - offset) continue
        const buf = new Uint8Array(300)
        const a = new Uint8Array(buf.buffer, offset, 150); a.fill(0xbb)
        const b = new Uint8Array(buf.slice().buffer, offset, 150); b.fill(0xbb); b[diffPos] = 0x55
        assert.ok(browserMod.compare(a, b) !== 0, `offset=${offset} diffPos=${diffPos}`)
        assert.ok(browserMod.compare(b, a) !== 0, `offset=${offset} diffPos=${diffPos} reversed`)
      }
    }
  })

  // -------- regression: diff at each of the 8 byte positions within a word --------

  it('64-bit path — diff at each byte position 0-7 inside a word', () => {
    for (let pos = 0; pos < 8; pos++) {
      const a = randArr(200); const b = a.slice()
      const wordStart = 48
      b[wordStart + pos] = a[wordStart + pos]! ^ 0xff
      assert.ok(browserMod.compare(a, b) !== 0, `bytePos=${pos}`)
    }
  })

  // -------- regression: various remainder lengths 1-7 --------

  it('64-bit path — remainder lengths 1-7', () => {
    for (const rem of [1, 2, 3, 4, 5, 6, 7]) {
      const len = 128 + rem
      const a = randArr(len)
      const b = a.slice(); b[len - 1]!++
      assert.ok(browserMod.compare(a, b) !== 0, `remainder=${rem}`)
    }
  })
})

describe('exports', () => {
  it('node module exports all expected functions', () => {
    const expected = ['arr2text', 'text2arr', 'arr2base', 'base2arr', 'hex2bin', 'bin2hex', 'hash', 'randomBytes', 'arr2hex', 'hex2arr', 'concat', 'equal', 'compare', 'xor', 'or', 'and'] as const
    for (const name of expected) {
      assert.ok(name in nodeMod, `${name} missing from node module`)
    }
  })

  it('browser module exports all expected functions', () => {
    const expected = ['arr2text', 'text2arr', 'arr2base', 'base2arr', 'hex2bin', 'bin2hex', 'hash', 'randomBytes', 'arr2hex', 'hex2arr', 'concat', 'equal', 'compare', 'xor', 'or', 'and'] as const
    for (const name of expected) {
      assert.ok(name in browserMod, `${name} missing from browser module`)
    }
  })
})
