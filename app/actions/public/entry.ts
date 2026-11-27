import { run } from 'remix/component'
import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await importModule(moduleUrl)
    let Component = module[exportName]
    if (typeof Component !== 'function') {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads
    preloadShim(preloads)
    return []
  },
})

app.addEventListener('error', (event) => {
  console.error('Component error:', event.error)
})

await app.ready()
