import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { SNOW_REPORT_URL, type ZoneStatus as Zone } from '../server/snow-report.ts'
import { ChevronRight } from './public/icons.tsx'

const style = css({
  display: 'block',
  textDecoration: 'none',
  color: 'inherit',
  overflow: 'hidden',
  transition: 'border-color 150ms var(--ease-out)',
  '&:hover': { borderColor: 'var(--ink-3)' },
  // Hairline seams between tiles come from the grid gap over the rule colour.
  '& .zones': {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1px',
    background: 'var(--rule-2)',
  },
  '& .zone': {
    background: 'var(--panel)',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
    boxShadow: 'inset 0 3px 0 var(--tone)',
    '--tone': 'var(--rule)',
  },
  '& .zone .name': { fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  '& .zone .state': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: 'var(--ink-2)',
  },
  '& .zone .state i': {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--tone)',
    flexShrink: 0,
  },
  '& .zone.open': { '--tone': 'var(--up)', background: 'var(--up-soft)' },
  '& .zone.open .state': { color: 'var(--up)', fontWeight: 500 },
  '& .zone.closed': { '--tone': 'var(--down)' },
  '& .zone.closed .name': { color: 'var(--ink-2)' },
  '& .zone.scheduled, & .zone.hold': { '--tone': 'var(--warn)' },
  '& .more': {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    padding: '8px 14px',
    borderTop: '1px solid var(--rule-2)',
    color: 'var(--route)',
    fontSize: '12px',
    fontWeight: 500,
  },
  '@media (max-width: 720px)': {
    '& .zones': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  },
})

export function zoneSummary(zones: Zone[]): string {
  let open = zones.filter((z) => z.state === 'open').length
  return `${open} of ${zones.length} open`
}

// The resort's alpine zones and whether patrol has them open. Links to the resort's page.
export function ZoneStatus(handle: Handle<{ zones: Zone[] }>) {
  return () => (
    <a class="panel" href={SNOW_REPORT_URL} target="_blank" rel="noopener" aria-label="Zone status on the resort's snow report" mix={style}>
      <div class="zones">
        {handle.props.zones.map((zone) => (
          <div key={zone.name} class={`zone ${zone.state}`}>
            <span class="name">{zone.name}</span>
            <span class="state">
              <i></i>
              {zone.label}
            </span>
          </div>
        ))}
      </div>
      <div class="more">
        Resort snow report <ChevronRight />
      </div>
    </a>
  )
}
