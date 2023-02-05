type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array

type Encoding = 
  | 'utf-8'
  | 'utf-16le'
  | 'latin-1'
  | 'ascii'

type HashType = 
  | 'hex'
  | 'base64'

type HashAlgo = 
  | 'sha-1'
  | 'sha-256'
  | 'sha-384'
  | 'sha-512'

type HexPrimitive = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 0 | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
type HexPart<S extends string | number> = `${S}${'' | `${S}`}`
type Hex = HexPart<HexPart<HexPrimitive>>

type BasePrimitive = "A"|"B"|"C"|"D"|"E"|"F"|"G"|"H"|"I"|"J"|"K"|"L"|"M"|"N"|"O"|"P"|"Q"|"R"|"S"|"T"|"U"|"V"|"W"|"X"|"Y"|"Z"|"a"|"b"|"c"|"d"|"e"|"f"|"g"|"h"|"i"|"j"|"k"|"l"|"m"|"n"|"o"|"p"|"q"|"r"|"s"|"t"|"u"|"v"|"w"|"x"|"y"|"z"|"0"|"1"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"+"|"/"|"="
type BasePart<S extends string> = `${S}${'' | `${S}`}`
type Base64 = BasePart<BasePart<BasePrimitive>>


export function concat (chunks: (TypedArray | Array)[]): Uint8Array

export function equal (a: TypedArray, b: TypedArray): boolean

export function arr2hex (data: Uint8Array | Array): Hex

export function hex2array (str: Hex): Uint8Array

export function arr2text (data: ArrayBuffer | Uint8Array, enc: Encoding): string

export function arr2base (data: Uint8Array | Array): Base64

export function base2arr (str: Base64): Uint8Array

export function text2arr (str: string): Uint8Array

export function hex2bin (str: Hex): string

export function bin2hex (str: string): Hex

export async function hash (data: string | TypedArray | ArrayBuffer | DataView, format: HashType, algo: HashAlgo): Uint8Array | Hex | Base64

export function randomBytes (size: number): Uint8Array
