import { createAssetServer } from 'remix/assets'

const rootDir = process.cwd()
const nodeEnv = process.env.NODE_ENV ?? 'development'
const isDevelopment = nodeEnv === 'development'
const isProduction = nodeEnv === 'production'

export const assets = createAssetServer({
  basePath: '/assets',
  rootDir,
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  denyFiles: ['app/**/*.test.*'],
  files: {
    extensions: ['.svg', '.png', '.jpg', '.woff2'],
  },
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  fingerprint: isProduction,
  watch: isDevelopment,
  target: { chrome: '109', firefox: '115', safari: '16' },
  onError(error) {
    console.error('Asset compilation failed', error)
    return new Response('Internal Server Error', { status: 500 })
  },
})

const entry = 'app/actions/public/entry.ts'

export function getScriptEntry() {
  return assets.getScriptEntry(entry)
}

export function getStylesheetHref() {
  return assets.getHref('app/actions/public/app.css')
}
