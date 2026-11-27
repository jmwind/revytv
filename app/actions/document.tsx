import type { ScriptEntry } from 'remix/assets'
import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'

import { getScriptEntry, getStylesheetHref } from '../assets.ts'

export interface Shell {
  scriptEntry: ScriptEntry
  stylesheetHref: string
}

// Resolved per request so dev-mode file changes are picked up.
export async function loadShell(): Promise<Shell> {
  let [scriptEntry, stylesheetHref] = await Promise.all([getScriptEntry(), getStylesheetHref()])
  return { scriptEntry, stylesheetHref }
}

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Semi+Condensed:wght@500;600&display=swap'

export interface DocumentProps {
  shell: Shell
  title: string
  description?: string
  bodyClass?: string
  head?: RemixNode
  children?: RemixNode
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { shell, title, description, bodyClass, head, children } = handle.props
    let { href, importMap, preloads } = shell.scriptEntry

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          <meta name="theme-color" content="#f4f4f0" media="(prefers-color-scheme: light)" />
          <meta name="theme-color" content="#0f141c" media="(prefers-color-scheme: dark)" />
          {description ? <meta name="description" content={description} /> : null}
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <title>{title}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={FONTS_HREF} />
          <link rel="stylesheet" href={shell.stylesheetHref} />
          {head}
          <ImportMap value={importMap} />
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          <script type="module" src={href}></script>
        </head>
        <body class={bodyClass}>{children}</body>
      </html>
    )
  }
}
