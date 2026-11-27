import { clientEntry, css, ref } from 'remix/component'
import type { Handle } from 'remix/component'

export interface WeatherSceneProps {
  condition: string | undefined
  newSnow: number
  last24: number
  windSpeed: number | undefined
  windDirection: string | undefined
}

type Kind = 'snow' | 'rain' | 'calm'

const style = css({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  // Theme colours resolve through these properties, since canvas cannot read light-dark().
  color: 'var(--flake)',
  borderColor: 'var(--drift)',
  caretColor: 'var(--rain)',
})

interface Flake {
  x: number
  y: number
  r: number
  vy: number
  sway: number
  phase: number
}

function kindFor(condition: string | undefined, newSnow: number): Kind {
  let c = (condition ?? '').toLowerCase()
  if (/snow|flurr|blizzard/.test(c)) return 'snow'
  if (/rain|shower|drizzle/.test(c)) return 'rain'
  if (!c && newSnow > 0) return 'snow'
  return 'calm'
}

// Westerlies push the fall to the right, easterlies to the left; anything else barely drifts.
function windDrift(speed: number | undefined, direction: string | undefined): number {
  let s = Math.min(speed ?? 0, 60) / 60
  let d = (direction ?? '').toUpperCase()
  let sign = d.includes('W') ? 1 : d.includes('E') ? -1 : 0.25
  return sign * s
}

// Snow, rain or nothing, drawn behind the overnight figure. Flake density follows the
// 24-hour total and what lands piles up along the bottom edge of the card.
export const WeatherScene = clientEntry(import.meta.url, function WeatherScene(handle: Handle<WeatherSceneProps>) {
  let canvas: HTMLCanvasElement | undefined

  handle.queueTask(() => {
    if (handle.signal.aborted || !canvas) return
    let ctx = canvas.getContext('2d')
    if (!ctx) return

    let { condition, newSnow, last24, windSpeed, windDirection } = handle.props
    let kind = kindFor(condition, newSnow)
    if (kind === 'calm') return

    let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let flakes: Flake[] = []
    let columns: number[] = []
    let columnWidth = 4
    let targetDepth = 0
    let drift = windDrift(windSpeed, windDirection)
    let colors = { flake: 'rgba(255,255,255,0.85)', drift: 'rgba(160,180,205,0.35)', rain: 'rgba(150,190,255,0.5)' }
    let running = false
    let frame = 0
    let last = 0

    function readColors() {
      if (!canvas) return
      let computed = getComputedStyle(canvas)
      colors = { flake: computed.color, drift: computed.borderTopColor, rain: computed.caretColor }
    }

    function resize() {
      if (!canvas) return
      let rect = canvas.getBoundingClientRect()
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
      columns = new Array<number>(Math.ceil(width / columnWidth) + 1).fill(0)
      // A big day buries a fifth of the card; a dusting leaves a rim.
      targetDepth = kind === 'snow' ? height * Math.min(0.22, 0.05 + last24 / 160) : 0
      seed()
    }

    function seed() {
      let perThousandPx = kind === 'snow' ? 0.5 + Math.min(last24, 50) * 0.12 : 1.2
      let count = Math.round((width * height) / 1000 * perThousandPx)
      count = Math.max(12, Math.min(count, 320))
      flakes = []
      for (let i = 0; i < count; i++) flakes.push(spawn(true))
    }

    function spawn(anywhere: boolean): Flake {
      let r = kind === 'snow' ? 0.8 + Math.random() * 2.1 : 0.6
      return {
        x: Math.random() * width,
        y: anywhere ? Math.random() * height : -4 - Math.random() * 20,
        r,
        vy: kind === 'snow' ? 14 + r * 12 + Math.random() * 10 : 220 + Math.random() * 120,
        sway: kind === 'snow' ? 0.4 + Math.random() * 0.9 : 0,
        phase: Math.random() * Math.PI * 2,
      }
    }

    function surfaceAt(x: number): number {
      let i = Math.max(0, Math.min(columns.length - 1, Math.round(x / columnWidth)))
      return height - (columns[i] ?? 0)
    }

    function land(x: number, r: number) {
      if (targetDepth <= 0) return
      let center = Math.round(x / columnWidth)
      for (let k = -2; k <= 2; k++) {
        let i = center + k
        if (i < 0 || i >= columns.length) continue
        let current = columns[i] ?? 0
        if (current >= targetDepth) continue
        let add = r * 0.45 * (1 - Math.abs(k) / 3)
        columns[i] = Math.min(targetDepth, current + add)
      }
    }

    function smooth() {
      for (let i = 1; i < columns.length - 1; i++) {
        let a = columns[i - 1] ?? 0
        let b = columns[i] ?? 0
        let c = columns[i + 1] ?? 0
        columns[i] = b * 0.6 + (a + c) * 0.2
      }
    }

    function drawDrift() {
      if (targetDepth <= 0 || !ctx) return
      ctx.beginPath()
      ctx.moveTo(0, height + 2)
      ctx.lineTo(0, surfaceAt(0))
      for (let i = 1; i < columns.length; i++) {
        let x0 = (i - 1) * columnWidth
        let x1 = i * columnWidth
        let y0 = height - (columns[i - 1] ?? 0)
        let y1 = height - (columns[i] ?? 0)
        ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      }
      ctx.lineTo(width, height + 2)
      ctx.closePath()
      ctx.fillStyle = colors.drift
      ctx.fill()
      // A brighter rim along the surface so the pile reads as snow, not a shadow.
      ctx.beginPath()
      ctx.moveTo(0, surfaceAt(0))
      for (let i = 1; i < columns.length; i++) {
        let x0 = (i - 1) * columnWidth
        let x1 = i * columnWidth
        let y0 = height - (columns[i - 1] ?? 0)
        let y1 = height - (columns[i] ?? 0)
        ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      }
      ctx.strokeStyle = colors.flake
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    function draw(dt: number, t: number) {
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)
      drawDrift()
      ctx.fillStyle = colors.flake
      ctx.strokeStyle = colors.rain
      ctx.lineWidth = 1
      for (let f of flakes) {
        if (kind === 'snow') {
          f.y += f.vy * dt
          f.x += (Math.sin(t * f.sway + f.phase) * 10 + drift * 40) * dt
          if (f.x < -4) f.x += width + 8
          if (f.x > width + 4) f.x -= width + 8
          if (f.y >= surfaceAt(f.x) - f.r) {
            land(f.x, f.r)
            Object.assign(f, spawn(false))
            continue
          }
          ctx.beginPath()
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
          ctx.fill()
        } else {
          f.y += f.vy * dt
          f.x += drift * 60 * dt
          if (f.y > height + 6) Object.assign(f, spawn(false))
          ctx.beginPath()
          ctx.moveTo(f.x, f.y)
          ctx.lineTo(f.x + drift * 1.5, f.y + 9)
          ctx.stroke()
        }
      }
    }

    function tick(now: number) {
      if (!running) return
      let dt = Math.min(0.05, (now - last) / 1000 || 0.016)
      last = now
      if (frame++ % 6 === 0) smooth()
      draw(dt, now / 1000)
      requestAnimationFrame(tick)
    }

    function start() {
      if (running || reduced) return
      running = true
      last = performance.now()
      requestAnimationFrame(tick)
    }

    function stop() {
      running = false
    }

    function drawStill() {
      // Reduced motion: the finished scene, no movement.
      for (let i = 0; i < columns.length; i++) columns[i] = targetDepth * (0.75 + 0.25 * Math.sin(i * 0.35))
      draw(0, 0)
    }

    readColors()
    resize()

    let resizeObserver = new ResizeObserver(() => {
      resize()
      if (reduced) drawStill()
    })
    resizeObserver.observe(canvas)

    let scheme = window.matchMedia('(prefers-color-scheme: dark)')
    let onScheme = () => readColors()
    scheme.addEventListener('change', onScheme)

    let onVisibility = () => (document.visibilityState === 'visible' ? start() : stop())
    document.addEventListener('visibilitychange', onVisibility)

    let intersection = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) start()
      else stop()
    })
    intersection.observe(canvas)

    if (reduced) drawStill()

    handle.signal.addEventListener('abort', () => {
      stop()
      resizeObserver.disconnect()
      intersection.disconnect()
      scheme.removeEventListener('change', onScheme)
      document.removeEventListener('visibilitychange', onVisibility)
    })
  })

  return () => <canvas aria-hidden="true" mix={[style, ref((node) => (canvas = node))]}></canvas>
})
