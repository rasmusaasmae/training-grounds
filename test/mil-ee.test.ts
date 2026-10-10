import { beforeAll, describe, expect, test } from 'bun:test'

import { parseTrainingGrounds } from '../server/mil-ee'
import type { TrainingGround } from '../src/lib/grounds'

// Trimmed snapshot of https://mil.ee/kaitsevagi/harjutusvaljad/ from
// 2026-10-10, keeping only Männiku and Klooga (both have an "LA1").
const fixture = Bun.file(new URL('./fixtures/harjutusvaljad.html', import.meta.url))

let grounds: Map<string, TrainingGround>
let manniku: TrainingGround

beforeAll(async () => {
  grounds = await parseTrainingGrounds(await fixture.text())
  manniku = grounds.get('manniku')!
})

describe('parseTrainingGrounds', () => {
  test('finds each training ground by its mil.ee tab slug', () => {
    expect([...grounds.keys()].toSorted()).toEqual(['klooga', 'manniku'])
    expect(manniku.name).toBe('Männiku')
  })

  test('reads the objects of a ground with their code and name', () => {
    const la = manniku.objects.filter((o) => o.code.startsWith('LA'))
    expect(la.map((o) => [o.code, o.name])).toEqual([
      ['LA1', 'Linnakuala 1'],
      ['LA2', 'Linnakuala 2'],
      ['LA3', 'Linnakuala 3'],
      ['LA4', 'Linnakuala 4'],
      ['LA5', 'Linnakuala 5'],
    ])
  })

  test('keeps same-coded objects of different grounds apart', () => {
    const klooga = grounds.get('klooga')!
    expect(klooga.objects.find((o) => o.code === 'LA1')?.name).toBe('Linnak')
    expect(manniku.objects.filter((o) => o.code === 'LA1')).toHaveLength(1)
  })

  test('converts polygons from web mercator to longitude/latitude', () => {
    const la1 = manniku.objects.find((o) => o.code === 'LA1')!
    expect(la1.geometry.type).toBe('MultiPolygon')
    for (const [lon, lat] of la1.geometry.coordinates.flat(2)) {
      // Männiku, just south of Tallinn.
      expect(lon).toBeGreaterThan(24.6)
      expect(lon).toBeLessThan(24.8)
      expect(lat).toBeGreaterThan(59.3)
      expect(lat).toBeLessThan(59.4)
    }
    expect(manniku.boundary?.coordinates.length).toBeGreaterThan(0)
  })

  test('reads exercises in Tallinn time, treating 23:59 as midnight', () => {
    expect(manniku.exercises).toContainEqual({
      start: Date.parse('2026-10-10T08:00:00+03:00'),
      end: Date.parse('2026-10-11T00:00:00+03:00'),
      type: 'tactics',
      noise: 'low',
      objects: ['LA1', 'LA2', 'LA3'],
    })
  })

  test('follows the switch to winter time on 25 October', () => {
    expect(manniku.exercises).toContainEqual(
      expect.objectContaining({
        start: Date.parse('2026-10-25T00:00:00+03:00'),
        end: Date.parse('2026-10-25T17:00:00+02:00'),
        objects: ['LA1', 'LA2', 'LA3', 'LA4', 'LA5'],
      }),
    )
  })

  test('rejects a page that no longer has the expected structure', async () => {
    const error = await parseTrainingGrounds('<html><body>Hooldustööd</body></html>').catch(
      (e) => e,
    )
    expect(error).toBeInstanceOf(Error)
  })
})
