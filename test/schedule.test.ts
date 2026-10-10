import { describe, expect, test } from 'bun:test'

import {
  closuresFor,
  cutoffsBetween,
  type Exercise,
  statusAt,
  stretchesBetween,
  tallinnTime,
} from '../src/lib/schedule'

const at = (iso: string) => Date.parse(iso)

const exercise = (start: string, end: string, objects: string[]): Exercise => ({
  start: at(start),
  end: at(end),
  type: 'tactics',
  noise: 'low',
  objects,
})

// Männiku, 10–14 Oct 2026, as mil.ee lists it: one exercise per day.
const exercises = [
  exercise('2026-10-10T08:00+03:00', '2026-10-11T00:00+03:00', ['LA1', 'LA2', 'LA3']),
  exercise('2026-10-11T00:00+03:00', '2026-10-11T17:00+03:00', ['LA1', 'LA2', 'LA3']),
  exercise('2026-10-12T08:00+03:00', '2026-10-13T00:00+03:00', ['LA1', 'LA2', 'LA4', 'LA5']),
  exercise('2026-10-12T23:30+03:00', '2026-10-13T00:00+03:00', ['LA3']),
  exercise('2026-10-13T00:00+03:00', '2026-10-14T00:00+03:00', ['LA5', 'LA4', 'LA2', 'LA1', 'LA3']),
  exercise('2026-10-14T00:00+03:00', '2026-10-14T17:00+03:00', ['LA3', 'LA1', 'LA2', 'LA4', 'LA5']),
]

describe('closuresFor', () => {
  test('joins exercises that run on over midnight into one closure', () => {
    const closures = closuresFor('LA1', exercises)
    expect(closures.map((c) => [c.start, c.end])).toEqual([
      [at('2026-10-10T08:00+03:00'), at('2026-10-11T17:00+03:00')],
      [at('2026-10-12T08:00+03:00'), at('2026-10-14T17:00+03:00')],
    ])
  })

  test('only counts exercises that list the object', () => {
    const closures = closuresFor('LA4', exercises)
    expect(closures[0]?.start).toBe(at('2026-10-12T08:00+03:00'))
  })
})

describe('statusAt', () => {
  const la1 = closuresFor('LA1', exercises)

  test('is closed while the closure runs past midnight', () => {
    const status = statusAt(la1, at('2026-10-10T23:00+03:00'))
    expect(status.kind).toBe('closed')
    expect(status.closure?.end).toBe(at('2026-10-11T17:00+03:00'))
  })

  test('changes today when the closure ends before midnight', () => {
    const status = statusAt(la1, at('2026-10-11T12:00+03:00'))
    expect(status.kind).toBe('today')
    expect(status.closure?.end).toBe(at('2026-10-11T17:00+03:00'))
  })

  test('changes today when a closure starts before midnight', () => {
    const status = statusAt(la1, at('2026-10-12T05:30+03:00'))
    expect(status.kind).toBe('today')
    expect(status.closure?.start).toBe(at('2026-10-12T08:00+03:00'))
  })

  test('is open today when the next closure starts tomorrow', () => {
    const status = statusAt(la1, at('2026-10-11T23:30+03:00'))
    expect(status.kind).toBe('open')
    expect(status.closure?.start).toBe(at('2026-10-12T08:00+03:00'))
  })

  test('is open once the closure of the day is over', () => {
    expect(statusAt(la1, at('2026-10-11T17:00+03:00')).kind).toBe('open')
  })

  test('is open without a closure once nothing more is scheduled', () => {
    expect(statusAt(la1, at('2026-10-15T12:00+03:00'))).toEqual({
      kind: 'open',
      closure: undefined,
    })
  })
})

describe('stretchesBetween', () => {
  test('fills the gaps between closures with open stretches, keeping every stretch whole', () => {
    const stretches = stretchesBetween(
      closuresFor('LA1', exercises),
      at('2026-10-11T00:00+03:00'),
      at('2026-10-13T00:00+03:00'),
    )
    expect(stretches.map((s) => [s.closed, s.start, s.end])).toEqual([
      [true, at('2026-10-10T08:00+03:00'), at('2026-10-11T17:00+03:00')],
      [false, at('2026-10-11T17:00+03:00'), at('2026-10-12T08:00+03:00')],
      [true, at('2026-10-12T08:00+03:00'), at('2026-10-14T17:00+03:00')],
    ])
  })

  test('runs open stretches from the last closure, with no end once nothing is scheduled', () => {
    const from = at('2026-10-20T00:00+03:00')
    const to = at('2026-10-23T00:00+03:00')
    expect(stretchesBetween(closuresFor('LA1', exercises), from, to)).toEqual([
      { closed: false, start: at('2026-10-14T17:00+03:00'), end: Infinity },
    ])
  })
})

describe('cutoffsBetween', () => {
  test('lists the times of day an area opens or closes in the range, once each', () => {
    const cutoffs = cutoffsBetween(
      closuresFor('LA3', exercises),
      at('2026-10-10T00:00+03:00'),
      at('2026-10-13T00:00+03:00'),
    )
    expect(cutoffs).toEqual([
      { hour: 8, minute: 0 },
      { hour: 17, minute: 0 },
      { hour: 23, minute: 30 },
    ])
  })
})

describe('tallinnTime', () => {
  test('uses summer and winter time around the October switch', () => {
    expect(tallinnTime('2026-10-24', 12, 0)).toBe(at('2026-10-24T12:00+03:00'))
    expect(tallinnTime('2026-10-26', 12, 0)).toBe(at('2026-10-26T12:00+02:00'))
  })
})
