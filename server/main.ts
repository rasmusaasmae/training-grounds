import { fetchPage } from './mil-ee'
import { serve } from './serve'

const server = serve({
  port: Number(process.env.PORT ?? 3000),
  loadPage: fetchPage,
  dist: new URL('../dist', import.meta.url).pathname,
})

console.log(`Listening on ${server.url.href}`)
