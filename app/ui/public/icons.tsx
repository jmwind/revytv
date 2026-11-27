// One stroke weight, one grid. Drawn, not borrowed from emoji.
import type { Handle } from 'remix/component'

export function Snowflake(handle: Handle<{ size?: number; class?: string }>) {
  return () => {
    let size = handle.props.size ?? 24
    return (
      <svg
        class={handle.props.class}
        width={size}
        height={size}
        viewBox="0 0 100 100"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        stroke-width="7"
        stroke-linecap="round"
      >
        <line x1="50" y1="10" x2="50" y2="90" />
        <line x1="10" y1="50" x2="90" y2="50" />
        <line x1="21" y1="21" x2="79" y2="79" />
        <line x1="79" y1="21" x2="21" y2="79" />
        <line x1="50" y1="20" x2="40" y2="30" />
        <line x1="50" y1="20" x2="60" y2="30" />
        <line x1="50" y1="80" x2="40" y2="70" />
        <line x1="50" y1="80" x2="60" y2="70" />
      </svg>
    )
  }
}

type WeatherKind = 'snow-heavy' | 'snow-light' | 'sun' | 'partly' | 'rain' | 'cloud'

export function weatherKind(description: string | null | undefined, amount: number): WeatherKind {
  let desc = (description ?? '').toLowerCase()
  if (amount >= 5) return 'snow-heavy'
  if (amount > 0) return 'snow-light'
  if (/sun|clear/.test(desc)) return 'sun'
  if (/rain|shower/.test(desc)) return 'rain'
  if (/partly|mix/.test(desc)) return 'partly'
  return 'cloud'
}

export function summerKind(condition: string | null | undefined): WeatherKind {
  switch ((condition ?? '').toLowerCase()) {
    case 'sunny':
      return 'sun'
    case 'partly cloudy':
      return 'partly'
    case 'rain':
    case 'storm':
      return 'rain'
    case 'snow':
      return 'snow-heavy'
    default:
      return 'cloud'
  }
}

export function WeatherIcon(handle: Handle<{ kind: WeatherKind; size?: number; title?: string }>) {
  return () => {
    let { kind, size = 20, title } = handle.props
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        role={title ? 'img' : undefined}
        aria-hidden={title ? undefined : 'true'}
      >
        {title ? <title>{title}</title> : null}
        {kind === 'sun' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
          </>
        ) : kind === 'partly' ? (
          <>
            <circle cx="8" cy="8.5" r="3" />
            <path d="M8 2.5v1.5M2.5 8.5H4M3.9 4.4l1.1 1.1M12.1 4.4L11 5.5" />
            <path d="M9 19.5h8.5a3 3 0 0 0 .4-6 4.5 4.5 0 0 0-8.6-1.3A3.6 3.6 0 0 0 9 19.5z" />
          </>
        ) : (
          <>
            <path d="M7 16.5h10a3.5 3.5 0 0 0 .5-7 5 5 0 0 0-9.6-1.4A4.2 4.2 0 0 0 7 16.5z" />
            {kind === 'snow-heavy' ? (
              <path d="M8 19.5v.1M12 19.5v.1M16 19.5v.1M10 22v.1M14 22v.1" stroke-width="2.4" />
            ) : kind === 'snow-light' ? (
              <path d="M9 20v.1M13.5 20.5v.1" stroke-width="2.4" />
            ) : kind === 'rain' ? (
              <path d="M9 19l-1 3M13 19l-1 3M17 19l-1 3" />
            ) : null}
          </>
        )}
      </svg>
    )
  }
}

export function Arrow(handle: Handle<{ dir: 'up' | 'down'; size?: number }>) {
  return () => {
    let size = handle.props.size ?? 10
    let d = handle.props.dir === 'up' ? 'M2 9L6 3l4 6z' : 'M2 3l4 6 4-6z'
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" fill="currentColor">
        <path d={d} />
      </svg>
    )
  }
}

export function ChevronRight(handle: Handle<{ size?: number }>) {
  return () => {
    let size = handle.props.size ?? 14
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 3l5 5-5 5" />
      </svg>
    )
  }
}

export function Close(handle: Handle<{ size?: number }>) {
  return () => {
    let size = handle.props.size ?? 16
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
        <path d="M3 3l10 10M13 3L3 13" />
      </svg>
    )
  }
}
