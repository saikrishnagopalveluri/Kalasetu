import { describe, it, expect } from 'vitest'
import { readJsonObject } from '@/lib/readJson'

function request(body: string | undefined) {
  return new Request('http://localhost/api/test', { method: 'POST', body })
}

describe('readJsonObject', () => {
  it('returns a parsed JSON object', async () => {
    expect(await readJsonObject(request('{"a":1,"b":"x"}'))).toEqual({ a: 1, b: 'x' })
  })

  it.each([
    ['malformed JSON', '{not json'],
    ['an empty body', undefined],
    ['null', 'null'],
    ['an array', '[1,2,3]'],
    ['a bare string', '"hello"'],
    ['a number', '42'],
  ])('returns an empty object for %s', async (_label, body) => {
    expect(await readJsonObject(request(body))).toEqual({})
  })
})
