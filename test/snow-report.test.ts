import * as fs from 'node:fs'
import * as path from 'node:path'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createSnowReportService, extractForecast, parseIssuedAt, parseSnowReport } from '../app/server/snow-report.ts'
import { createMemoryStore } from '../app/server/storage.ts'

const html = fs.readFileSync(path.join(import.meta.dirname, 'fixtures/snow-report.html'), 'utf8')
const otherHtml = fs.readFileSync(path.join(import.meta.dirname, 'fixtures/forecast-duplicates.html'), 'utf8')

describe('extractForecast', () => {
  const forecast = extractForecast(html)

  it('returns forecast entries', () => {
    assert.ok(forecast.length > 0)
  })

  it('first entry is Today or Tonight', () => {
    assert.ok(['Today', 'Tonight'].includes(forecast[0]?.day ?? ''))
  })

  it('each entry has required fields', () => {
    for (let entry of forecast) {
      assert.ok('day' in entry)
      assert.equal(typeof entry.amount, 'number')
      assert.ok('freezingLevel' in entry)
    }
  })

  it('only contains valid day names', () => {
    const validDays = ['Today', 'Tonight', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    for (let entry of forecast) assert.ok(validDays.includes(entry.day), entry.day)
  })

  it('allows duplicate day names for 10+ day forecasts', () => {
    assert.equal(forecast.filter((f) => f.day === 'Saturday').length, 2)
  })

  it('duplicate days have distinct data', () => {
    const saturdays = forecast.filter((f) => f.day === 'Saturday')
    assert.equal(saturdays[0]?.amount, 14)
    assert.equal(saturdays[1]?.amount, 44)
    assert.equal(saturdays[1]?.freezingLevel, 400)
  })

  it('duplicate days appear in document order', () => {
    const dayNames = forecast.map((f) => f.day)
    const firstSatIdx = dayNames.indexOf('Saturday')
    const lastSatIdx = dayNames.lastIndexOf('Saturday')
    const fridayIdx = dayNames.indexOf('Friday')
    assert.ok(firstSatIdx < fridayIdx)
    assert.ok(lastSatIdx > fridayIdx)
  })

  it('does not include valley forecast entries (alpine only)', () => {
    assert.ok(forecast.length <= 12)
  })

  it('entries are in document order (not re-sorted)', () => {
    assert.deepEqual(
      forecast.map((f) => f.day),
      ['Today', 'Tonight', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    )
  })
})

describe('parseSnowReport', () => {
  const data = parseSnowReport(html)

  it('parses snow data', () => {
    assert.equal(typeof data.snow.newSnow, 'number')
    assert.equal(typeof data.snow.seasonTotal, 'number')
    assert.equal(typeof data.snow.baseDepth, 'number')
  })

  it('parses weather data', () => {
    assert.ok(data.weather !== undefined)
  })

  it('forecast is populated', () => {
    assert.ok(data.forecast.length > 0)
  })

  it('reads when Environment Canada issued the forecast, in resort time', () => {
    // The fixture says "Friday February 06, 2026 at 08:00 PST".
    assert.equal(data.forecastIssuedAt, '2026-02-06T16:00:00.000Z')
  })
})

describe('parseIssuedAt', () => {
  it('converts a winter issue time from Pacific standard time', () => {
    assert.equal(parseIssuedAt('Issued by Environment Canada on Friday February 06, 2026 at 01:00 PST.'), '2026-02-06T09:00:00.000Z')
  })

  it('ignores the zone abbreviation and reads the time as resort local time', () => {
    // Whatever the page calls the zone, the time is Revelstoke's clock.
    let iso = parseIssuedAt('Issued by Environment Canada on Friday November 27, 2026 at 01:00 PCT.')
    assert.ok(iso)
    let local = new Date(iso).toLocaleString('en-CA', { timeZone: 'America/Vancouver', hour12: false })
    assert.match(local, /2026-11-27, 01:00/)
  })

  it('converts a summer issue time from Pacific daylight time', () => {
    assert.equal(parseIssuedAt('Issued by Environment Canada on Monday June 15, 2026 at 13:00 PDT.'), '2026-06-15T20:00:00.000Z')
  })

  it('returns null when the page does not say', () => {
    assert.equal(parseIssuedAt('Snow report with no footer'), null)
  })
})

describe('statsChangedAt', () => {
  function service(page: () => string, store = createMemoryStore(), clock = { now: '2026-11-27T10:00:00Z' }) {
    return createSnowReportService({
      storage: store,
      fetch: (async () => new Response(page())) as typeof fetch,
      now: () => new Date(clock.now),
    })
  }

  it('starts at the first fetch and holds while the figures stay the same', async () => {
    let store = createMemoryStore()
    let clock = { now: '2026-11-27T10:00:00Z' }
    let svc = service(() => html, store, clock)
    let first = await svc.getSnowReport()
    assert.equal(first.statsChangedAt, '2026-11-27T10:00:00.000Z')

    await store.del('snow-report:cache')
    clock.now = '2026-11-27T12:00:00Z'
    let second = await svc.getSnowReport()
    assert.equal(second.fetchedAt, '2026-11-27T12:00:00.000Z')
    assert.equal(second.statsChangedAt, '2026-11-27T10:00:00.000Z')
  })

  it('moves to the fetch that saw different figures', async () => {
    let store = createMemoryStore()
    let clock = { now: '2026-11-27T10:00:00Z' }
    let page = html
    let svc = service(() => page, store, clock)
    await svc.getSnowReport()

    await store.del('snow-report:cache')
    clock.now = '2026-11-27T14:00:00Z'
    page = otherHtml
    assert.notDeepEqual(parseSnowReport(otherHtml).snow, parseSnowReport(html).snow)
    let changed = await svc.getSnowReport()
    assert.equal(changed.statsChangedAt, '2026-11-27T14:00:00.000Z')
  })
})
