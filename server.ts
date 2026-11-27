import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { assets } from './app/assets.ts'
import { router } from './app/router.ts'

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000

const server = http.createServer(createRequestListener(router.fetch))

server.listen(port, () => {
  console.log(`Truflake listening on http://localhost:${port}`)
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => assets.close().finally(() => process.exit(0)))
  server.closeAllConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
