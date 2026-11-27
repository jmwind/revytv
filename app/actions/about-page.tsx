import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { Nav } from '../ui/nav.tsx'
import { Document, type Shell } from './document.tsx'

const style = css({
  '& article': {
    maxWidth: '68ch',
    margin: '40px auto 0',
    fontSize: '17px',
    lineHeight: 1.6,
  },
  '& article h1': {
    fontSize: '41px',
    fontWeight: 600,
    letterSpacing: '-0.02em',
    lineHeight: 1.05,
    marginBottom: '28px',
  },
  '& article h2': {
    fontSize: '19px',
    fontWeight: 600,
    margin: '36px 0 10px',
    paddingTop: '14px',
    borderTop: '1px solid var(--rule-strong)',
  },
  '& article p + p': { marginTop: '12px' },
  '& article em': { color: 'var(--ink-2)' },
  '& article ul': { margin: '12px 0 0', padding: '0 0 0 1.2em' },
  '& article li + li': { marginTop: '6px' },
  '& article .credits': { color: 'var(--ink-2)', fontSize: '15px' },
  '& footer': {
    maxWidth: '68ch',
    margin: '48px auto 0',
    paddingTop: '14px',
    borderTop: '1px solid var(--rule)',
    color: 'var(--ink-3)',
    fontSize: '13px',
  },
})

// The origin story. Kept funny on purpose.
export function AboutPage(handle: Handle<{ shell: Shell }>) {
  return () => (
    <Document shell={handle.props.shell} title="About · Truflake" description="Why Revy Snow for Nerds exists.">
      <div class="page" mix={style}>
        <Nav current="about" />
        <article>
          <h1>The origin story</h1>

          <h2>Why does this exist?</h2>
          <p>
            One day, Jean-Michel looked at the Revelstoke Mountain Resort snow report and thought:{' '}
            <em>
              “This is nice, but where are the sparklines? Where’s the historical trend analysis? How am I supposed
              to obsessively track forecast changes without a calendar view?”
            </em>
          </p>
          <p>Like any reasonable person, he spent countless hours building this dashboard instead of actually skiing. Priorities.</p>

          <h2>Features nobody asked for</h2>
          <ul>
            <li>Sparklines showing how forecasts change over time (because the mountain likes to tease us)</li>
            <li>Color-coded forecast cards that turn red when dreams are crushed</li>
            <li>Freezing levels drawn against the actual mountain, so you know which lift the rain stops at</li>
            <li>TV mode for maximum snow-watching productivity at home</li>
            <li>A scrolling ticker because this is clearly a financial trading floor for powder</li>
            <li>Historical calendar view to relive past forecast disappointments</li>
            <li>Every season since 2007-08 on one chart, so the “worst season ever” claims can be fact-checked</li>
          </ul>

          <h2>The philosophy</h2>
          <p>
            Regular people check the snow report once in the morning. Legends check it every 10 minutes and
            cross-reference with multiple data sources. This dashboard is for the legends.
          </p>
          <p>
            <strong>Remember:</strong> A forecast is just a suggestion. An obsessively tracked forecast with
            historical trends is <em>science</em>.
          </p>

          <h2>Credits</h2>
          <p class="credits">Built with caffeine, questionable life choices, and an unhealthy relationship with weather data.</p>
          <p class="credits">
            Powered by Remix, because the old ways got a new version. Data from Revelstoke Mountain Resort. Stored in
            Upstash Redis because even snow data deserves a good database. Free, forever, no login: the paywall was
            quietly taken out back.
          </p>
        </article>
        <footer>Made with obsessive attention to snowfall in Revelstoke, BC</footer>
      </div>
    </Document>
  )
}
