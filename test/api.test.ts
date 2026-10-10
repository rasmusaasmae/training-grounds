import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { serve } from '../server/serve'
import type { GroundsPayload } from '../src/lib/grounds'

const fixture = await Bun.file(new URL('./fixtures/harjutusvaljad.html', import.meta.url)).text()

let server: ReturnType<typeof serve> | undefined
// Failures are logged on purpose; keep them out of the test output.
beforeEach(() => spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => server?.stop(true))

// Every request goes back to mil.ee, so the fake page decides what is served.
function start(loadPage: () => Promise<string>) {
  server = serve({ port: 0, loadPage, cacheTtl: 0, retryAfter: 0 })
  return (path: string) => fetch(new URL(path, server!.url))
}

describe('GET /api/grounds', () => {
  test('lists grounds with objects addressable as <ground>-<code>', async () => {
    const get = start(async () => fixture)
    const res = await get('/api/grounds')
    expect(res.headers.get('content-encoding')).toBe('gzip')

    const body = (await res.json()) as GroundsPayload
    const manniku = body.grounds.find((g) => g.slug === 'manniku')!
    expect(manniku.objects.map((o) => o.id)).toContain('manniku-LA1')
    expect(manniku.objects.map((o) => o.id)).toContain('manniku-TA_1')
    expect(body.error).toBeUndefined()
  })

  test('keeps serving the last schedule while mil.ee is down', async () => {
    let up = true
    const get = start(async () => {
      if (!up) throw new Error('mil.ee responded 503')
      return fixture
    })
    await get('/api/grounds')
    up = false

    const res = await get('/api/grounds')
    expect(res.status).toBe(200)
    const body = (await res.json()) as GroundsPayload
    expect(body.grounds.map((g) => g.slug)).toContain('manniku')
    expect(body.error).toBe('mil.ee responded 503')
  })

  test('fails when mil.ee has never been reachable', async () => {
    const get = start(async () => {
      throw new Error('mil.ee responded 503')
    })
    const res = await get('/api/grounds')
    expect(res.status).toBe(502)
  })
})
