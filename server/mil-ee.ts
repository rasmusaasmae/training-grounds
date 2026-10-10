// Reads training grounds off the Defence Forces' public page. It has no API:
// polygons are embedded as JSON in a <script>, and each ground's schedule is a
// server-rendered table in its own tab (`#t-<slug>`).

import type { MultiPolygon, TrainingGround } from '../src/lib/grounds'
import { type Exercise, type ExerciseType, type NoiseLevel, tallinnTime } from '../src/lib/schedule'

export const SOURCE_URL = 'https://mil.ee/kaitsevagi/harjutusvaljad/'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

export async function fetchPage(): Promise<string> {
  const res = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'training-grounds (+https://github.com/rasmusaasmae/training-grounds)',
    },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`mil.ee responded ${res.status}`)
  return res.text()
}

export async function parseTrainingGrounds(html: string): Promise<Map<string, TrainingGround>> {
  const grounds = await parseSchedules(html)
  if (grounds.size === 0) throw new Error('mil.ee page has no training ground tabs')

  for (const feature of scriptJson(html, 'mapTrainingAreas')) {
    const ground = grounds.get(slugOf(feature) ?? '')
    if (ground) ground.boundary = toMultiPolygon(feature)
  }
  for (const feature of scriptJson(html, 'mapTrainingObjects')) {
    const ground = grounds.get(slugOf(feature) ?? '')
    const label = feature.popup_content.match(/class="[^"]*\bobjname\b[^"]*">([^<]*)</)?.[1]?.trim()
    // "Linnakuala 1 (LA1)"
    const [, name, code] = label?.match(/^(.*?)\s*\(([^()]+)\)$/) ?? []
    if (ground && name && code) {
      ground.objects.push({
        id: objectId(ground.slug, code.trim()),
        code: code.trim(),
        name,
        geometry: toMultiPolygon(feature),
      })
    }
  }
  return grounds
}

// Codes can hold spaces and commas ("TA 1", "AH1, AH2"), which would need
// escaping in a comma-separated URL parameter.
function objectId(slug: string, code: string) {
  return `${slug}-${code.replace(/[\s,]+/g, '_')}`
}

type ScheduleRow = { date: string; type: string; noise: string; cells: string[] }

async function parseSchedules(html: string) {
  const grounds = new Map<string, TrainingGround>()
  const rows = new Map<TrainingGround, ScheduleRow[]>()
  let ground: TrainingGround | undefined
  let row: ScheduleRow | undefined

  await new HTMLRewriter()
    .on('div.tab-pane[id^="t-"]', {
      element(el) {
        const slug = el.getAttribute('id')!.slice(2)
        ground = { slug, name: '', boundary: null, objects: [], exercises: [] }
        grounds.set(slug, ground)
        rows.set(ground, [])
      },
    })
    .on('div.tab-pane > .card-header span', {
      text(chunk) {
        if (ground) ground.name += chunk.text
      },
    })
    .on('tr.schedule-table__exercise', {
      element(el) {
        row = {
          date: el.getAttribute('data-exercise-date') ?? '',
          type: el.getAttribute('data-exercise-type') ?? '',
          noise: el.getAttribute('data-noise-level') ?? '',
          cells: [],
        }
        if (ground) rows.get(ground)!.push(row)
      },
    })
    .on('tr.schedule-table__exercise > td', {
      element() {
        row?.cells.push('')
      },
      text(chunk) {
        if (row?.cells.length) row.cells[row.cells.length - 1] += chunk.text
      },
    })
    .transform(new Response(html))
    .text()

  for (const [ground, groundRows] of rows) {
    ground.name = ground.name.trim()
    ground.exercises = groundRows.flatMap((r) => toExercise(r) ?? [])
  }
  return grounds
}

// Columns: Kuupäev, Harjutuse toimumisaeg, Harjutuse tüüp, Väljaõppeobjektid, Müratase
function toExercise({ date, type, noise, cells }: ScheduleRow): Exercise | undefined {
  const time = cells[1]?.match(/(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})/)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !time) return undefined
  const [h1, m1, h2, m2] = time.slice(1).map(Number) as [number, number, number, number]

  const start = tallinnTime(date, h1, m1)
  // "23:59" means until the end of the day.
  let end = h2 === 23 && m2 === 59 ? tallinnTime(date, h2, m2) + MINUTE : tallinnTime(date, h2, m2)
  if (end <= start) end += DAY

  const objects = (cells[3] ?? '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean)
  return { start, end, type: type as ExerciseType, noise: noise as NoiseLevel, objects }
}

type MapFeature = {
  shape: { geometries: { type: string; coordinates: [number, number][][] }[] }
  popup_content: string
}

function scriptJson(html: string, name: string): MapFeature[] {
  const json = html.match(new RegExp(`var ${name} = (\\[[\\s\\S]*?\\])\\s*;`))?.[1]
  if (!json) throw new Error(`mil.ee page has no ${name}`)
  return JSON.parse(json)
}

// Popups link to the ground's tab: href="#tab-manniku-toggle"
function slugOf(feature: MapFeature) {
  return feature.popup_content.match(/#tab-(.+?)-toggle/)?.[1]
}

const EARTH_RADIUS = 6378137
const round = (n: number) => Math.round(n * 1e6) / 1e6

// The page's shapes are in EPSG:3857 (web mercator metres).
function toMultiPolygon(feature: MapFeature): MultiPolygon {
  return {
    type: 'MultiPolygon',
    coordinates: feature.shape.geometries
      .filter((g) => g.type === 'Polygon')
      .map((polygon) =>
        polygon.coordinates.map((ring) =>
          ring.map(([x, y]): [number, number] => [
            round((x / EARTH_RADIUS) * (180 / Math.PI)),
            round((2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * (180 / Math.PI)),
          ]),
        ),
      ),
  }
}
