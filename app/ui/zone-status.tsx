import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { SNOW_REPORT_URL, type ZoneStatus as Zone } from '../server/snow-report.ts'
import { ChevronRight } from './public/icons.tsx'

// Where each zone sits on the ridge, as percentages of the panel: desktop (x, y) and
// phone (mx, my), where the panel is taller and the labels need more room.
interface Place {
  x: number
  y: number
  mx: number
  my: number
  flip?: boolean
}

const PLACES: Record<string, Place> = {
  Subpeak: { x: 55, y: 14, mx: 54, my: 12 },
  'Kill the Banker': { x: 44, y: 30, mx: 44, my: 30, flip: true },
  'Lemming Line': { x: 69, y: 32, mx: 66, my: 32 },
  'Lower North Bowl': { x: 23, y: 46, mx: 48, my: 50, flip: true },
  'Greely Bowl': { x: 66, y: 56, mx: 64, my: 60 },
  'Three Bears': { x: 36, y: 70, mx: 36, my: 74, flip: true },
  Southside: { x: 86, y: 68, mx: 76, my: 82, flip: true },
}

const style = css({
  display: 'block',
  position: 'relative',
  textDecoration: 'none',
  color: 'inherit',
  overflow: 'hidden',
  height: '280px',
  '--ridge-far': 'light-dark(#d6e2ef, #1a2638)',
  '--ridge': 'light-dark(#c3d4e6, #223349)',
  '--ridge-fore': 'light-dark(#eaf0f6, #141d2b)',
  '--snow': 'light-dark(#ffffff, #3a4d66)',
  '--contour': 'light-dark(rgb(90 120 160 / 0.35), rgb(150 180 220 / 0.22))',
  transition: 'border-color 150ms var(--ease-out)',
  '&:hover': { borderColor: 'var(--ink-3)' },
  '& svg.ridge': { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' },
  '& .pin': {
    position: 'absolute',
    left: 'var(--x)',
    top: 'var(--y)',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
  },
  '& .pin.flip': { flexDirection: 'row-reverse', transform: 'translate(-100%, -50%)', marginLeft: '7px' },
  '& .pin:not(.flip)': { transform: 'translate(0, -50%)', marginLeft: '-7px' },
  // Trail-map markers: a filled disc for open, a crossed ring for closed, a half disc for "soon".
  '& .pin i': {
    position: 'relative',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    border: '2px solid var(--tone)',
    background: 'var(--panel)',
    boxShadow: '0 0 0 3px var(--panel)',
    flexShrink: 0,
  },
  '& .pin.open i': { background: 'var(--tone)' },
  '& .pin.open i::after': {
    content: '""',
    position: 'absolute',
    inset: '3px',
    borderRadius: '50%',
    background: 'var(--panel)',
  },
  '& .pin.closed i::before, & .pin.closed i::after': {
    content: '""',
    position: 'absolute',
    left: '2px',
    right: '2px',
    top: '50%',
    height: '2px',
    background: 'var(--tone)',
    transform: 'rotate(45deg)',
  },
  '& .pin.closed i::after': { transform: 'rotate(-45deg)' },
  '& .pin.scheduled i, & .pin.hold i': {
    background: 'linear-gradient(90deg, var(--tone) 50%, var(--panel) 50%)',
  },
  '& .pin.open': { '--tone': 'var(--up)' },
  '& .pin.closed': { '--tone': 'var(--down)' },
  '& .pin.scheduled, & .pin.hold, & .pin.unknown': { '--tone': 'var(--warn)' },
  '& .pin .label': { display: 'flex', flexDirection: 'column', lineHeight: 1.1 },
  '& .pin b': {
    fontFamily: 'var(--font-cond)',
    fontWeight: 600,
    fontSize: '13px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    textShadow: '0 0 6px var(--panel), 0 0 2px var(--panel)',
  },
  '& .pin small': { fontSize: '11px', color: 'var(--tone)', fontWeight: 500, textShadow: '0 0 4px var(--panel)' },
  '& .pin.closed b': { color: 'var(--ink-2)' },
  '& .pin.flip .label': { alignItems: 'flex-end' },
  '& .elev': {
    position: 'absolute',
    left: '14px',
    top: '12px',
    fontFamily: 'var(--font-cond)',
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--ink-3)',
    lineHeight: 1.5,
  },
  '& .elev b': { color: 'var(--ink-2)', fontWeight: 600, marginRight: '4px' },
  '& .legend': {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '8px 14px',
    fontSize: '12px',
    color: 'var(--ink-2)',
    background: 'linear-gradient(transparent, var(--panel) 40%)',
  },
  '& .legend i': {
    display: 'inline-block',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: '2px solid var(--tone)',
    verticalAlign: '-1px',
    marginRight: '5px',
    boxSizing: 'border-box',
  },
  '& .legend .open i': { background: 'var(--up)', '--tone': 'var(--up)' },
  '& .legend .closed i': { '--tone': 'var(--down)' },
  '& .legend .more': { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--route)', fontWeight: 500 },
  '& .extra': { position: 'absolute', right: '14px', top: '12px', display: 'flex', gap: '12px' },
  '@media (max-width: 720px)': {
    height: '340px',
    '& .pin': { left: 'var(--mx)', top: 'var(--my)' },
    '& .elev': { display: 'none' },
    '& .legend': { gap: '10px', padding: '8px 12px' },
  },
})

export function zoneSummary(zones: Zone[]): string {
  let open = zones.filter((z) => z.state === 'open').length
  return `${open} of ${zones.length} open`
}

function Pin(handle: Handle<{ zone: Zone; place: Place }>) {
  return () => {
    let { zone, place } = handle.props
    return (
      <div
        class={`pin ${zone.state}${place.flip ? ' flip' : ''}`}
        style={{ '--x': `${place.x}%`, '--y': `${place.y}%`, '--mx': `${place.mx}%`, '--my': `${place.my}%` }}
      >
        <i aria-hidden="true"></i>
        <span class="label">
          <b>{zone.name}</b>
          <small>{zone.label}</small>
        </span>
      </div>
    )
  }
}

// The resort's alpine zones pinned on a painted ridge, trail-map style. Links to the resort's page.
export function ZoneStatus(handle: Handle<{ zones: Zone[] }>) {
  return () => {
    let placed = handle.props.zones.filter((z) => PLACES[z.name])
    let extra = handle.props.zones.filter((z) => !PLACES[z.name])
    return (
      <a class="panel" href={SNOW_REPORT_URL} target="_blank" rel="noopener" aria-label="Zone status on the resort's snow report" mix={style}>
        <svg class="ridge" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="zs-snow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="var(--snow)" stop-opacity="0.9" />
              <stop offset="0.45" stop-color="var(--snow)" stop-opacity="0" />
            </linearGradient>
          </defs>
          {/* Far range */}
          <path d="M0 150 L90 118 L170 132 L260 96 L340 120 L420 88 L470 104 L560 60 L640 92 L720 74 L800 104 L880 86 L1000 118 L1000 300 L0 300 Z" fill="var(--ridge-far)" />
          {/* Main ridge: Subpeak at the top, the North Bowl shoulder left, Greely right */}
          <path d="M0 236 L120 192 L210 166 L300 150 L380 118 L460 84 L550 42 L600 62 L660 96 L740 126 L820 160 L900 184 L1000 206 L1000 300 L0 300 Z" fill="var(--ridge)" />
          <path d="M0 236 L120 192 L210 166 L300 150 L380 118 L460 84 L550 42 L600 62 L660 96 L740 126 L820 160 L900 184 L1000 206 L1000 300 L0 300 Z" fill="url(#zs-snow)" />
          {/* Contours */}
          <path d="M60 230 Q220 170 400 150 T760 170 T1000 236" fill="none" stroke="var(--contour)" stroke-width="1" />
          <path d="M0 262 Q260 206 520 182 T1000 250" fill="none" stroke="var(--contour)" stroke-width="1" />
          <path d="M140 286 Q380 236 640 220 T1000 270" fill="none" stroke="var(--contour)" stroke-width="1" />
          {/* Ski-area boundary */}
          <path d="M30 300 L130 236 L250 200 L330 190 L420 150 L500 110 L550 50 L620 110 L700 150 L790 196 L880 230 L960 300" fill="none" stroke="var(--ink-3)" stroke-width="1.2" stroke-dasharray="5 6" opacity="0.7" />
          {/* Foreground slope */}
          <path d="M0 300 L0 272 L160 252 L320 262 L480 244 L640 258 L800 246 L1000 266 L1000 300 Z" fill="var(--ridge-fore)" />
        </svg>
        <div class="elev">
          <div>
            <b>2340</b>Subpeak
          </div>
          <div>
            <b>1680</b>Ripper
          </div>
        </div>
        {placed.map((zone) => (
          <Pin key={zone.name} zone={zone} place={PLACES[zone.name]!} />
        ))}
        {extra.length ? (
          <div class="extra">
            {extra.map((zone) => (
              <div key={zone.name} class={`pin ${zone.state}`} style={{ position: 'static', transform: 'none', margin: 0 }}>
                <i aria-hidden="true"></i>
                <span class="label">
                  <b>{zone.name}</b>
                  <small>{zone.label}</small>
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div class="legend">
          <span class="open">
            <i></i>Open
          </span>
          <span class="closed">
            <i></i>Closed
          </span>
          <span>{zoneSummary(handle.props.zones)}</span>
          <span class="more">
            Resort snow report <ChevronRight />
          </span>
        </div>
      </a>
    )
  }
}
