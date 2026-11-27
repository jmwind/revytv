import { clientEntry, css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

export interface Video {
  id: string
  title: string
}

export const WINTER_PLAYLIST: Video[] = [
  { id: 'spJ5dqXi6ro', title: 'Big mountain' },
  { id: 'BsbMhTEoQiM', title: 'Famillia Fernie 2010' },
  { id: 'TPND631Dh-I', title: 'Famillia Spring Break 2010' },
  { id: 'IRwZN2JvtYc', title: 'Famillia Heli NZ 2013' },
]

// Summer (May through October): Revelstoke freeride and big jumps.
export const SUMMER_PLAYLIST: Video[] = [
  { id: 'CPd9T_cZj7U', title: 'Best Jumps — Casey Brown' },
  { id: '8Eh8XRvs1Kc', title: 'All Jump Trails POV' },
  { id: 'AccoQ7NqSF8', title: 'Doomsday Jump Line' },
  { id: 'hHgRi2iDS1w', title: 'Ultimate Frisbee POV' },
]

const TICKER_KEY = 'truflake-tv-ticker'

interface YTPlayer {
  mute(): void
  setLoop(loop: boolean): void
  playVideo(): void
  loadPlaylist(options: { playlist: string[]; index: number }): void
  unloadModule(name: string): void
}

interface YTNamespace {
  Player: new (
    el: string | HTMLElement,
    options: {
      host?: string
      width?: string
      height?: string
      videoId?: string
      playerVars?: Record<string, string | number>
      events?: Record<string, (event: { target: YTPlayer }) => void>
    },
  ) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

const style = css({
  position: 'absolute',
  inset: 0,
  '& .frame': { position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' },
  '& .frame iframe, & .frame > div': {
    position: 'absolute',
    top: '50%',
    left: '50%',
    // Oversized ~12% so YouTube's title bar and bottom chrome sit outside the viewport.
    width: '112vw',
    height: '63vw',
    minHeight: '112vh',
    minWidth: '199vh',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  },
  '& .menu': { position: 'absolute', top: '16px', right: '16px', zIndex: 20 },
  '& .menu > button': {
    appearance: 'none',
    width: '36px',
    height: '36px',
    border: '1px solid rgb(255 255 255 / 0.25)',
    borderRadius: 'var(--radius-s)',
    background: 'rgb(0 0 0 / 0.45)',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    opacity: 0.55,
    transition: 'opacity 150ms var(--ease-out)',
  },
  '& .menu > button:hover, & .menu > button:focus-visible, & .menu[data-open] > button': { opacity: 1 },
  '& .list': {
    position: 'absolute',
    top: '44px',
    right: 0,
    minWidth: '260px',
    background: 'rgb(12 16 22 / 0.94)',
    border: '1px solid rgb(255 255 255 / 0.14)',
    borderRadius: 'var(--radius-m)',
    padding: '6px',
    color: '#e8ebef',
    fontSize: '14px',
    display: 'none',
  },
  '& .menu[data-open] .list': { display: 'block' },
  '& .list button, & .list a': {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '8px 10px',
    appearance: 'none',
    background: 'none',
    border: 0,
    borderRadius: 'var(--radius-s)',
    color: 'inherit',
    textAlign: 'left',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  '& .list button:hover, & .list a:hover': { background: 'rgb(255 255 255 / 0.08)' },
  '& .list button[aria-current="true"]': { color: 'var(--route)' },
  '& .list button[aria-current="true"] .n': { background: 'var(--route)', color: '#0f141c' },
  '& .list .n': {
    width: '20px',
    height: '20px',
    borderRadius: 'var(--radius-s)',
    background: 'rgb(255 255 255 / 0.12)',
    display: 'grid',
    placeItems: 'center',
    fontSize: '11px',
    fontWeight: 600,
  },
  '& .list hr': { border: 0, borderTop: '1px solid rgb(255 255 255 / 0.12)', margin: '6px 0' },
  '& .list .group': { padding: '6px 10px 2px', fontSize: '11px', color: 'rgb(255 255 255 / 0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' },
})

export const TvPlayer = clientEntry(import.meta.url, function TvPlayer(handle: Handle<{ playlist: Video[] }>) {
  let player: YTPlayer | null = null
  let current = 0
  let menuOpen = false
  let tickerHidden = false
  let frame: HTMLDivElement | undefined

  let ids = (start: number) => {
    let all = handle.props.playlist.map((v) => v.id)
    return [...all.slice(start), ...all.slice(0, start)]
  }

  // The captions module loads after playback starts, so this runs on every state change.
  let hideCaptions = () => {
    try {
      player?.unloadModule('captions')
      player?.unloadModule('cc')
    } catch {}
  }

  let createPlayer = () => {
    if (!window.YT || !frame) return
    let list = ids(current)
    let host = document.createElement('div')
    frame.replaceChildren(host)
    player = new window.YT.Player(host, {
      host: 'https://www.youtube-nocookie.com',
      width: '100%',
      height: '100%',
      videoId: list[0],
      playerVars: {
        autoplay: 1,
        mute: 1,
        controls: 0,
        loop: 1,
        cc_load_policy: 0,
        iv_load_policy: 3,
        rel: 0,
        playsinline: 1,
        playlist: list.slice(1).join(','),
      },
      events: {
        onReady: (e) => {
          e.target.mute()
          e.target.setLoop(true)
          hideCaptions()
          e.target.playVideo()
        },
        onApiChange: hideCaptions,
        onStateChange: hideCaptions,
      },
    })
  }

  let applyTicker = () => {
    document.body.dataset.ticker = tickerHidden ? 'hidden' : 'show'
  }

  handle.queueTask(() => {
    if (handle.signal.aborted) return
    try {
      tickerHidden = localStorage.getItem(TICKER_KEY) === 'hidden'
    } catch {}
    applyTicker()
    handle.update()

    if (window.YT?.Player) {
      createPlayer()
    } else {
      window.onYouTubeIframeAPIReady = createPlayer
      if (!document.getElementById('youtube-iframe-api')) {
        let tag = document.createElement('script')
        tag.id = 'youtube-iframe-api'
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
      }
    }

    document.addEventListener(
      'click',
      (event) => {
        if (menuOpen && !(event.target instanceof Node && event.currentTarget instanceof Node && menuEl?.contains(event.target))) {
          menuOpen = false
          handle.update()
        }
      },
      { signal: handle.signal },
    )
  })

  let menuEl: HTMLDivElement | undefined

  let play = (index: number) => {
    current = index
    player?.loadPlaylist({ playlist: ids(index), index: 0 })
    player?.setLoop(true)
    player?.mute()
    hideCaptions()
    menuOpen = false
    handle.update()
  }

  return () => (
    <div mix={style}>
      <div class="frame" aria-hidden="true" mix={ref((node) => (frame = node))}></div>
      <div class="menu" data-open={menuOpen ? '' : undefined} mix={ref((node) => (menuEl = node))}>
        <button
          type="button"
          aria-label="TV menu"
          aria-expanded={menuOpen}
          mix={on('click', (event) => {
            event.stopPropagation()
            menuOpen = !menuOpen
            handle.update()
          })}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <div class="list" role="menu">
          <div class="group">Video</div>
          {handle.props.playlist.map((video, i) => (
            <button key={video.id} type="button" role="menuitem" aria-current={i === current ? 'true' : undefined} mix={on('click', () => play(i))}>
              <span class="n">{i + 1}</span>
              {video.title}
            </button>
          ))}
          <hr />
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={!tickerHidden}
            mix={on('click', () => {
              tickerHidden = !tickerHidden
              try {
                localStorage.setItem(TICKER_KEY, tickerHidden ? 'hidden' : 'show')
              } catch {}
              applyTicker()
              handle.update()
            })}
          >
            <span class="n">{tickerHidden ? '' : '✓'}</span>
            Show ticker
          </button>
          <a href="/" role="menuitem">
            <span class="n">↩</span>
            Back to the dashboard
          </a>
        </div>
      </div>
    </div>
  )
})
