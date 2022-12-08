/* Common package for dealing with hex/string/uint8 conversions (and sha1 hashing)
*
* @author   Jimmy Wärting <jimmy@warting.se> (https://jimmy.warting.se/opensource)
* @license  MIT
*/
const alphabet = '0123456789abcdef'
const encodeLookup = []
const decodeLookup = []

for (let i = 0; i < 256; i++) {
  encodeLookup[i] = alphabet[i >> 4 & 0xf] + alphabet[i & 0xf]
  if (i < 16) {
    if (i < 10) {
      decodeLookup[0x30 + i] = i
    } else {
      decodeLookup[0x61 - 10 + i] = i
    }
  }
}

export const arr2hex = array => {
  const length = array.length
  let string = ''
  let i = 0
  while (i < length) {
    string += encodeLookup[array[i++]]
  }
  return string
}

export const hex2arr = string => {
  const sizeof = string.length >> 1
  const length = sizeof << 1
  const array = new Uint8Array(sizeof)
  let n = 0
  let i = 0
  while (i < length) {
    array[n++] = decodeLookup[string.charCodeAt(i++)] << 4 | decodeLookup[string.charCodeAt(i++)]
  }
  return array
}

export const concat = (chunks, size) => {
  if (!size) {
    size = 0
    let i = chunks.length || chunks.byteLength || 0
    while (i--) size += chunks[i].length
  }
  const b = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    b.set(chunk, offset)
    offset += chunk.byteLength || chunk.length
  }

  return b
}

export const equal = (a, b) => {
  if (a.byteLength !== b.byteLength) return false
  for (let i = a.length; i > -1; i -= 1) {
    if ((a[i] !== b[i])) return false
  }
  return true
}
