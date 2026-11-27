import { clientEntry, css, ref } from 'remix/component'
import type { Handle } from 'remix/component'

const WINDY_KEY = 'LgEGmQsKdyOlCvJV0if03ay1ZcMEyb83'
const LEAFLET_SRC = 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js'
const LIB_BOOT_SRC = 'https://api.windy.com/assets/map-forecast/libBoot.js'

interface WindyApi {
  map: { scrollWheelZoom: { disable(): void } }
  store: { set(key: string, value: unknown): void }
}

declare global {
  interface Window {
    windyInit?: (options: Record<string, unknown>, ready: (api: WindyApi) => void) => void
  }
}

const style = css({
  overflow: 'hidden',
  position: 'relative',
  '& #windy': { height: 'clamp(360px, 48vw, 620px)', background: 'var(--panel-2)' },
  '& .state': {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    color: 'var(--ink-3)',
    fontSize: '13px',
    pointerEvents: 'none',
  },
})

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

// Windy's forecast map sits at the bottom of the page and pulls in Leaflet, its own
// runtime and a few dozen tiles, so it only boots once the section is nearly in view.
export const WindyMap = clientEntry(import.meta.url, function WindyMap(handle: Handle) {
  let section: HTMLElement | undefined
  let state: 'idle' | 'loading' | 'ready' | 'failed' = 'idle'

  async function boot() {
    if (state !== 'idle') return
    state = 'loading'
    handle.update()
    try {
      await loadScript(LEAFLET_SRC)
      await loadScript(LIB_BOOT_SRC)
      if (!window.windyInit) throw new Error('windyInit is not available')
      window.windyInit(
        { key: WINDY_KEY, lat: 50.9981, lon: -118.1957, zoom: 7, overlay: 'snowAccu', particlesAnim: 'off' },
        (api) => {
          api.map.scrollWheelZoom.disable()
          setTimeout(() => {
            api.store.set('animation', true)
            document.getElementById('playpause')?.click()
          }, 1500)
        },
      )
      state = 'ready'
    } catch (error) {
      console.error('Windy map failed to load', error)
      state = 'failed'
    }
    handle.update()
  }

  handle.queueTask(() => {
    if (handle.signal.aborted || !section) return
    if (!('IntersectionObserver' in window)) {
      void boot()
      return
    }
    let observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        void boot()
      },
      { rootMargin: '300px 0px' },
    )
    observer.observe(section)
    handle.signal.addEventListener('abort', () => observer.disconnect())
  })

  return () => (
    <section
      class="panel"
      aria-label="Windy snow accumulation forecast map"
      mix={[style, ref((node) => (section = node))]}
    >
      <div id="windy"></div>
      {state === 'idle' || state === 'loading' ? <div class="state">Loading the Windy map…</div> : null}
      {state === 'failed' ? <div class="state">The Windy map could not be loaded.</div> : null}
    </section>
  )
})
