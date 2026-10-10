# Project

A Vite + React web app (`src/`, shadcn/ui on Base UI, react-leaflet) and a small Bun server (`server/`) that turns the public mil.ee training grounds page into `GET /api/grounds` and serves the built app. See README.md for the layout. No database or auth; keep it simple.

`src/lib/schedule.ts` and `src/lib/grounds.ts` are shared by the server and the browser, so keep them free of Bun, Node and DOM APIs. All schedule times are Europe/Tallinn wall-clock times on mil.ee; convert with `tallinnTime`.

Bun runs the server's TypeScript directly in production. Do not add a build step for it.

# Skills

Agent skills live in `.agents/skills/<name>/SKILL.md`; `.claude/skills` is a symlink to that directory. Before starting a task, check whether a skill there covers it, read its `SKILL.md` and follow it.

- `tdd`: from [mattpocock/skills](https://github.com/mattpocock/skills/tree/main/skills/engineering/tdd). Use it for any feature or bug fix. The seams it asks you to agree on are already fixed in the Tests section below.
- `apple-design`: from [emilkowalski/skills](https://github.com/emilkowalski/skills/tree/main/skills/apple-design). Use it for UI, motion and typography work in `src/`.

These are vendored copies, kept unformatted (`.agents/**` is in the oxfmt ignore list). To update one, copy it over again from upstream.

# Libraries

When working with any external library, framework, SDK, API, or CLI tool, query the Context7 MCP for the relevant docs first. Your training data may be stale; Context7 is the source of truth for current syntax, configuration, and idioms.

DO use patterns and APIs the library documentation recommends. Prefer the simplest code that meets the requirement. AVOID custom abstractions, wrappers, or complex logic when a documented library primitive does the job.

Add dependencies with `bun add` (`bunfig.toml` pins exact versions) at their latest version. Add shadcn components with `bunx --bun shadcn@latest add <component>`; don't copy them from other projects.

# Tests

Work test-first with `bun test`. Tests live at three seams: the parser (`test/mil-ee.test.ts`), schedule status (`test/schedule.test.ts`) and the HTTP API through a real `serve()` with a fake mil.ee loader (`test/api.test.ts`). They run against `test/fixtures/harjutusvaljad.html`, a trimmed real snapshot of the mil.ee page (Männiku and Klooga). If mil.ee changes its markup, refresh the fixture from the live page rather than hand-editing it.

Test business decisions, not every edge case.
