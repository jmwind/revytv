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

export const SITE_URL = 'https://truflake.com'

// The link-preview card (public/og.png), rendered from design/og-card.html.
const OG_IMAGE = { href: `${SITE_URL}/og.png`, width: 1200, height: 630, alt: 'Truflake: Revy snow for nerds. Snow falling over the Revelstoke ridge.' }

export interface DocumentProps {
  shell: Shell
  title: string
  description?: string
  /** Path of this page, for the canonical link and the share card. */
  path?: string
  bodyClass?: string
  head?: RemixNode
  children?: RemixNode
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { shell, title, description, path = '/', bodyClass, head, children } = handle.props
    let { href, importMap, preloads } = shell.scriptEntry
    let url = `${SITE_URL}${path}`

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
          <link rel="canonical" href={url} />
          <title>{title}</title>
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="Truflake" />
          <meta property="og:title" content={title} />
          {description ? <meta property="og:description" content={description} /> : null}
          <meta property="og:url" content={url} />
          <meta property="og:image" content={OG_IMAGE.href} />
          <meta property="og:image:type" content="image/png" />
          <meta property="og:image:width" content={String(OG_IMAGE.width)} />
          <meta property="og:image:height" content={String(OG_IMAGE.height)} />
          <meta property="og:image:alt" content={OG_IMAGE.alt} />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={title} />
          {description ? <meta name="twitter:description" content={description} /> : null}
          <meta name="twitter:image" content={OG_IMAGE.href} />
          <meta name="twitter:image:alt" content={OG_IMAGE.alt} />
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
