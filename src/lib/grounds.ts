// The shape of `GET /api/grounds`, shared by the server and the browser.

import type { Exercise } from './schedule'

export type MultiPolygon = {
  type: 'MultiPolygon'
  /** Longitude/latitude (WGS 84). */
  coordinates: [number, number][][][]
}

/** A part of a ground with its own schedule entry, e.g. "Linnakuala 1 (LA1)". */
export type TrainingObject = {
  /** `<ground slug>-<code>`, e.g. `manniku-LA1`; used in the page URL. */
  id: string
  code: string
  name: string
  geometry: MultiPolygon
}

export type TrainingGround = {
  /** The tab id on mil.ee without `t-`, e.g. `manniku`. */
  slug: string
  name: string
  boundary: MultiPolygon | null
  objects: TrainingObject[]
  exercises: Exercise[]
}

/** What `GET /api/grounds` returns. */
export type GroundsPayload = {
  grounds: TrainingGround[]
  sourceUrl: string
  fetchedAt: number
  /** Set when mil.ee could not be refreshed and the data is older than usual. */
  error?: string
}
