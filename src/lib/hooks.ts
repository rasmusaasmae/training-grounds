import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import type { GroundsPayload } from './grounds'

const RELOAD_EVERY = 5 * 60_000
const TICK_EVERY = 30_000

/** The schedule from `/api/grounds`, refreshed every few minutes and on return to the tab. */
export function useGrounds() {
  const [data, setData] = useState<GroundsPayload>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/grounds')
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? `Server responded ${res.status}`)
        if (!cancelled) {
          setData(body)
          setError(undefined)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }
    const onVisible = () => document.visibilityState === 'visible' && void load()
    void load()
    const timer = setInterval(load, RELOAD_EVERY)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return { data, error }
}

/** The current time, ticking often enough for "in 5 min" to stay right. */
export function useNow() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const timer = setInterval(tick, TICK_EVERY)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return now
}

// The selection lives in the URL (?objects=manniku-LA1,manniku-LA2) so a
// bookmark brings it back.
const subscribe = (onChange: () => void) => {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}
const getSearch = () => window.location.search

export function useSelectedIds() {
  const search = useSyncExternalStore(subscribe, getSearch)
  const ids = useMemo(
    () => new URLSearchParams(search).get('objects')?.split(',').filter(Boolean) ?? [],
    [search],
  )

  const setIds = useCallback((next: string[]) => {
    const url = new URL(window.location.href)
    url.search = next.length ? `?objects=${next.map(encodeURIComponent).join(',')}` : ''
    window.history.replaceState(null, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  return [ids, setIds] as const
}
