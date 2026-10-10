import { join } from 'node:path'

import type { GroundsPayload, TrainingGround } from '../src/lib/grounds'
import { parseTrainingGrounds, SOURCE_URL } from './mil-ee'

type Options = {
  port: number
  /** Fetches the mil.ee page. */
  loadPage: () => Promise<string>
  /** The built web app (`vite build`); in development Vite serves it instead. */
  dist?: string
  /** mil.ee is fetched at most this often. */
  cacheTtl?: number
  /** After a failed fetch, keep serving what we have for this long before retrying. */
  retryAfter?: number
}

export function serve({
  port,
  loadPage,
  dist,
  cacheTtl = 10 * 60_000,
  retryAfter = 60_000,
}: Options) {
  let cache: { grounds: TrainingGround[]; fetchedAt: number } | undefined
  let failure: { at: number; message: string } | undefined
  let refreshing: Promise<void> | undefined

  async function refresh() {
    try {
      const grounds = await parseTrainingGrounds(await loadPage())
      cache = { grounds: [...grounds.values()], fetchedAt: Date.now() }
      failure = undefined
    } catch (error) {
      failure = { at: Date.now(), message: error instanceof Error ? error.message : String(error) }
      console.error('Refreshing from mil.ee failed:', error)
    }
  }

  async function trainingGrounds() {
    const now = Date.now()
    const fresh = cache && now - cache.fetchedAt < cacheTtl
    const backingOff = failure && now - failure.at < retryAfter
    if (!fresh && !backingOff) {
      refreshing ??= refresh().finally(() => (refreshing = undefined))
      await refreshing
    }
    return { cache, error: failure?.message }
  }

  return Bun.serve({
    port,
    routes: {
      '/api/health': new Response('ok'),
      '/api/grounds': async (req) => {
        const { cache, error } = await trainingGrounds()
        if (!cache) return Response.json({ error }, { status: 502 })
        const json = JSON.stringify({
          grounds: cache.grounds,
          sourceUrl: SOURCE_URL,
          fetchedAt: cache.fetchedAt,
          error,
        } satisfies GroundsPayload)
        // All polygons together are ~300 kB of JSON but compress to a quarter.
        const headers = { 'Content-Type': 'application/json', Vary: 'Accept-Encoding' }
        if (!req.headers.get('Accept-Encoding')?.includes('gzip'))
          return new Response(json, { headers })
        return new Response(Bun.gzipSync(json), {
          headers: { ...headers, 'Content-Encoding': 'gzip' },
        })
      },
    },
    fetch: (req) => (dist ? serveStatic(dist, req) : new Response('Not found', { status: 404 })),
  })
}

async function serveStatic(dist: string, req: Request) {
  const path = join(dist, new URL(req.url).pathname)
  const file = Bun.file(path)
  if (path.startsWith(join(dist, '/')) && (await file.exists())) {
    // Vite fingerprints everything under /assets.
    const immutable = path.startsWith(join(dist, 'assets/'))
    return new Response(file, {
      headers: immutable ? { 'Cache-Control': 'public, max-age=31536000, immutable' } : {},
    })
  }
  const index = Bun.file(join(dist, 'index.html'))
  if (await index.exists()) return new Response(index)
  return new Response('Not found', { status: 404 })
}
