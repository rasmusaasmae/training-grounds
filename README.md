# Training Grounds

A map of which Estonian Defence Forces training grounds (harjutusväljad) are closed for exercises, and until when.

Pick the areas you care about, e.g. Männiku LA1–LA5. The choice is kept in the page address (`/?objects=manniku-LA1,manniku-LA2`), so bookmark it. Each area is coloured on an aerial map:

- **red**: closed for the rest of today; going there is forbidden
- **orange**: opens or closes later today
- **green**: open for the rest of today

Data comes from the public [mil.ee training grounds page](https://mil.ee/kaitsevagi/harjutusvaljad/), which has no API. The server fetches it at most every 10 minutes and reads the area polygons (embedded JSON) and each ground's schedule table. mil.ee lists multi-day exercises as one row per day (… – 23:59, 00:00 – …); those are joined, so "opens" is when the area is actually free again. If mil.ee is unreachable the last schedule keeps being served and the page says so.

## Layout

```
server/main.ts       entry point
server/serve.ts      Bun.serve: GET /api/grounds, /api/health, and the built web app
server/mil-ee.ts     fetching and parsing the mil.ee page
src/                 Vite + React web app (shadcn/ui on Base UI, react-leaflet)
src/lib/schedule.ts  closures and status; shared by server and browser
src/lib/grounds.ts   the /api/grounds types; shared by server and browser
test/                bun test, against a trimmed snapshot of the mil.ee page
```

## Development

```sh
bun install
bun run dev:api      # API on :3001
bun run dev          # Vite on :5173, proxies /api to :3001
bun test
bun run lint && bun run typecheck && bun run fmt:check
```

## Deployment

Pushing to `main` runs the checks and publishes `ghcr.io/rasmusaasmae/training-grounds:latest`. On the server, `docker-compose.yml` runs that image on the `hermes` network with Watchtower updates. No database, secrets or auth.
