import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

import { routes } from '../routes.ts'
import { Snowflake } from './public/icons.tsx'

export type NavKey = 'home' | 'tv' | 'history' | 'calendar' | 'about'

const items: Array<{ key: NavKey; label: string; href: string }> = [
  { key: 'home', label: 'Now', href: routes.home.href() },
  { key: 'tv', label: 'TV', href: routes.tv.href() },
  { key: 'history', label: 'Seasons', href: routes.history.href() },
  { key: 'calendar', label: 'Calendar', href: routes.calendar.href() },
  { key: 'about', label: 'About', href: routes.about.href() },
]

const barStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '24px',
  minHeight: '56px',
  borderBottom: '1px solid var(--rule)',
  '& .brand': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    color: 'var(--ink)',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '17px',
    letterSpacing: '-0.01em',
  },
  '& .brand svg': { color: 'var(--route)' },
  '& .brand small': {
    color: 'var(--ink-2)',
    fontWeight: 400,
    fontSize: '13px',
    marginLeft: '6px',
  },
  '& ul': {
    display: 'flex',
    gap: '4px',
    listStyle: 'none',
    margin: '0 0 0 auto',
    padding: 0,
  },
  '& ul a': {
    display: 'inline-block',
    padding: '6px 10px',
    color: 'var(--ink-2)',
    textDecoration: 'none',
    fontWeight: 500,
    borderRadius: 'var(--radius-s)',
    transition: 'color 150ms var(--ease-out), background-color 150ms var(--ease-out)',
  },
  '& ul a:hover': { color: 'var(--ink)', background: 'var(--panel-2)' },
  '& ul a[aria-current="page"]': {
    color: 'var(--ink)',
    boxShadow: 'inset 0 -2px 0 var(--route)',
    borderRadius: 0,
  },
  '& .meta': {
    color: 'var(--ink-2)',
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
  // Phones: brand and freshness on the first row, the links on their own row below.
  '@media (max-width: 640px)': {
    flexWrap: 'wrap',
    gap: '4px 16px',
    padding: '8px 0 0',
    minHeight: 0,
    '& .brand small': { display: 'none' },
    '& .meta': { marginLeft: 'auto', order: 1 },
    '& ul': { order: 2, marginLeft: '-10px', width: 'calc(100% + 20px)', overflowX: 'auto', padding: '0 10px' },
  },
})

export function Nav(handle: Handle<{ current: NavKey; meta?: RemixNode }>) {
  return () => (
    <nav class="page-nav" aria-label="Site" mix={barStyle}>
      <a class="brand" href={routes.home.href()}>
        <Snowflake size={22} />
        Truflake
        <small>Revy snow for nerds</small>
      </a>
      <ul>
        {items.map((item) => (
          <li key={item.key}>
            <a
              href={item.href}
              aria-current={item.key === handle.props.current ? 'page' : undefined}
              data-rmx-prefetch="intent"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
      {handle.props.meta ? <span class="meta">{handle.props.meta}</span> : null}
    </nav>
  )
}
