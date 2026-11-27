// Vercel entry: one function serves every route through the Remix fetch handler.
//
// Vercel's Node builder traces this file with nft and compiles any .ts it finds.
// The Remix asset server also needs the raw .ts/.tsx sources on disk so it can
// compile them for the browser, so the app is imported dynamically (nft leaves it
// alone) and shipped verbatim through vercel.json's includeFiles. The static
// imports below exist only so nft bundles the server-side remix modules.
import 'remix/node-tsx'
import 'remix/router'
import 'remix/routes'
import 'remix/component'
import 'remix/component/server'
import 'remix/middleware/render'
import 'remix/middleware/static'
import 'remix/assets'
import 'remix/response/redirect'
import '@upstash/redis'

const routerPath = process.env.TRUFLAKE_ROUTER ?? '../app/router.ts'
const routerPromise = import(routerPath).then((mod) => mod.router)

/** @param {Request} request */
async function handler(request) {
  const router = await routerPromise
  return router.fetch(request)
}

export const GET = handler
export const HEAD = handler
export const OPTIONS = handler
