import assert from 'node:assert/strict'
import * as crypto from 'node:crypto'
import { describe, it } from 'node:test'

import * as nodeMod from '../_node.ts'
import * as browserMod from '../browser.ts'

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

  it('arr2hex works on number[]', () => {
    assert.equal(nodeMod.arr2hex([0, 255, 128]), '00ff80')
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

  it('works on number[]', () => {
    assert.ok(nodeMod.equal([1, 2, 3], [1, 2, 3]))
    assert.ok(!nodeMod.equal([1, 2, 3], [1, 2, 4]))
  })

  it('mixed typed array and number[] — large', () => {
    const a = new Uint8Array([...Array(100)].map(() => 42))
    const b: number[] = Array.from(a)
    assert.ok(nodeMod.equal(a, b))
    b[50] = 0
    assert.ok(!nodeMod.equal(a, b))
  })

  it('large number[] — both non-view', () => {
    const a: number[] = Array.from({ length: 100 }, () => 42)
    const b: number[] = a.slice()
    assert.ok(nodeMod.equal(a, b))
    b[50] = 0
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

  it('works on number[]', () => {
    assert.equal(nodeMod.compare([1, 2, 3], [1, 2, 3]), 0)
    assert.ok(nodeMod.compare([1, 2, 3], [1, 2, 4]) < 0)
    assert.ok(nodeMod.compare([1, 2, 4], [1, 2, 3]) > 0)
  })

  it('mixed typed array and number[] — large', () => {
    const a = new Uint8Array([...Array(100)].map(() => 42))
    const b: number[] = Array.from(a)
    assert.equal(nodeMod.compare(a, b), 0)
    b[50] = 41
    assert.ok(nodeMod.compare(a, b) > 0)
  })

  it('large number[] — both non-view', () => {
    const a: number[] = Array.from({ length: 100 }, () => 42)
    const b: number[] = a.slice()
    assert.equal(nodeMod.compare(a, b), 0)
    b[50] = 41
    assert.ok(nodeMod.compare(a, b) > 0)
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

  it('arr2text with latin1 encoding', () => {
    const arr = randArr(20)
    assert.equal(nodeMod.arr2text(arr, 'latin1'), Buffer.from(arr).toString('latin1'))
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
})

describe('shared: compare (browser)', () => {
  it('matches node compare', () => {
    const a = randArr(150)
    assert.equal(browserMod.compare(a, a.slice()), 0)
    const b = a.slice(); b[100]!--
    assert.ok(browserMod.compare(a, b) > 0)
  })
})

describe('exports', () => {
  it('node module exports all expected functions', () => {
    const expected = ['arr2text', 'text2arr', 'arr2base', 'base2arr', 'hex2bin', 'bin2hex', 'hash', 'randomBytes', 'arr2hex', 'hex2arr', 'concat', 'equal', 'compare', 'xor', 'or', 'and', 'alphabet', 'encodeLookup'] as const
    for (const name of expected) {
      assert.ok(name in nodeMod, `${name} missing from node module`)
    }
  })

  it('browser module exports all expected functions', () => {
    const expected = ['arr2text', 'text2arr', 'arr2base', 'base2arr', 'hex2bin', 'bin2hex', 'hash', 'randomBytes', 'arr2hex', 'hex2arr', 'concat', 'equal', 'compare', 'xor', 'or', 'and', 'alphabet', 'encodeLookup'] as const
    for (const name of expected) {
      assert.ok(name in browserMod, `${name} missing from browser module`)
    }
  })
})
