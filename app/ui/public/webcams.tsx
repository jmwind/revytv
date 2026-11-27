import { clientEntry, css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

import { Close } from './icons.tsx'

export interface Webcam {
  id: string
  name: string
  url: string
}

export const WEBCAMS: Webcam[] = [
  { id: 'gnorm', name: 'Gnorm the Powder Gnome', url: 'https://www.revelstokemountainresort.com/uploads/gnorm/gnorm.jpg' },
  { id: 'kpmc', name: 'Mackenzie Outpost', url: 'https://relay.ozolio.com/pub.api?cmd=poster&oid=EMB_KPMC000010BF' },
  { id: 'ripper', name: 'Ripper', url: 'https://www.revelstokemountainresort.com/uploads/ripper/ripper-medium.jpg' },
  { id: 'pvwk', name: 'Village', url: 'https://relay.ozolio.com/pub.api?cmd=poster&oid=EMB_PVWK000010B0' },
]

export const REFRESH_MS = 10 * 60 * 1000

export function bustCache(url: string, stamp: number): string {
  return `${url}${url.includes('?') ? '&' : '?'}t=${stamp}`
}

const gridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '1px',
  background: 'var(--rule)',
  border: '1px solid var(--rule)',
  borderRadius: 'var(--radius-m)',
  overflow: 'hidden',
  '& figure': {
    margin: 0,
    position: 'relative',
    background: 'var(--panel-2)',
    aspectRatio: '16 / 10',
    cursor: 'zoom-in',
  },
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0,
    transition: 'opacity 300ms var(--ease-out)',
  },
  '& figure.loaded img': { opacity: 1 },
  '& figcaption': {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: '18px 10px 8px',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
    textShadow: '0 1px 2px rgb(0 0 0 / 0.6)',
    background: 'linear-gradient(to top, rgb(0 0 0 / 0.55), transparent)',
    pointerEvents: 'none',
  },
  '& figure.failed figcaption::after': { content: '" · unavailable"', fontWeight: 400 },
  '& figure button': {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    appearance: 'none',
    background: 'none',
    border: 0,
    cursor: 'zoom-in',
    color: 'transparent',
  },
  '& figure button:focus-visible': { outlineOffset: '-3px' },
  '@media (max-width: 900px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
})

const lightboxStyle = css({
  padding: 0,
  border: 0,
  background: 'transparent',
  maxWidth: 'min(96vw, 1400px)',
  maxHeight: '96vh',
  '&::backdrop': { background: 'var(--scrim)', backdropFilter: 'blur(2px)' },
  '& img': { maxHeight: '88vh', width: 'auto', borderRadius: 'var(--radius-m)' },
  '& .bar': {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#fff',
    padding: '10px 2px',
    fontWeight: 600,
  },
  '& .bar button': {
    marginLeft: 'auto',
    appearance: 'none',
    background: 'rgb(255 255 255 / 0.14)',
    border: 0,
    borderRadius: 'var(--radius-s)',
    color: '#fff',
    width: '32px',
    height: '32px',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
})

export const WebcamGrid = clientEntry(import.meta.url, function WebcamGrid(handle: Handle<{ cams: Webcam[] }>) {
  let stamp = Date.now()
  let loaded = new Set<string>()
  let failed = new Set<string>()
  let open: Webcam | null = null
  let dialog: HTMLDialogElement | undefined

  handle.queueTask(() => {
    if (handle.signal.aborted) return
    let timer = setInterval(() => {
      stamp = Date.now()
      loaded.clear()
      failed.clear()
      handle.update()
    }, REFRESH_MS)
    handle.signal.addEventListener('abort', () => clearInterval(timer))
  })

  let show = (cam: Webcam) => {
    open = cam
    handle.update()
    handle.queueTask(() => dialog?.showModal())
  }
  let hide = () => {
    dialog?.close()
    open = null
    handle.update()
  }

  return () => (
    <>
      <div class="webcams" mix={gridStyle}>
        {handle.props.cams.map((cam) => {
          let cls = ['', loaded.has(cam.id) ? 'loaded' : '', failed.has(cam.id) ? 'failed loaded' : ''].join(' ').trim()
          return (
            <figure key={cam.id} class={cls || undefined}>
              <img
                src={bustCache(cam.url, stamp)}
                alt={`${cam.name} webcam`}
                loading="lazy"
                mix={[
                  on('load', () => {
                    loaded.add(cam.id)
                    handle.update()
                  }),
                  on('error', () => {
                    failed.add(cam.id)
                    handle.update()
                  }),
                ]}
              />
              <figcaption>{cam.name}</figcaption>
              <button type="button" mix={on('click', () => show(cam))}>
                Enlarge {cam.name}
              </button>
            </figure>
          )
        })}
      </div>
      <dialog
        mix={[
          lightboxStyle,
          ref((node) => (dialog = node)),
          on('click', (event) => {
            if (event.target === event.currentTarget) hide()
          }),
          on('close', () => {
            if (open) {
              open = null
              handle.update()
            }
          }),
        ]}
        aria-label={open ? `${open.name} webcam, enlarged` : 'Webcam'}
      >
        {open ? (
          <>
            <div class="bar">
              <span>{open.name}</span>
              <button type="button" aria-label="Close" mix={on('click', hide)}>
                <Close />
              </button>
            </div>
            <img src={bustCache(open.url, stamp)} alt={`${open.name} webcam, enlarged`} />
          </>
        ) : null}
      </dialog>
    </>
  )
})
