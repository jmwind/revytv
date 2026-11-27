import * as fs from 'node:fs'
import * as path from 'node:path'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { assignForecastDates, dayNameToDateKey } from '../app/server/forecast-dates.ts'
import { createSnowReportService, extractForecast, type ForecastRecord } from '../app/server/snow-report.ts'
import { createMemoryStore } from '../app/server/storage.ts'

// The fixture is forecast-only; the parser now refuses a page without snow stats, so add some.
const duplicateHtml =
  '<div>NEW SNOW 9 CM LAST HOUR 1 CM 24 HOURS 20 CM 48 HOURS 30 CM 7 DAYS 40 CM BASE DEPTH 150 CM SEASON TOTAL 500 CM</div>' +
  fs.readFileSync(path.join(import.meta.dirname, 'fixtures/forecast-duplicates.html'), 'utf8')

function dateOf(day: string, ref: Date, offset = 0): string {
  let result = dayNameToDateKey(day, ref, offset)
  assert.ok(result, `no date for ${day}`)
  return result.date
}

describe('dayNameToDateKey', () => {
  // Fixed reference: Friday 2026-02-13
  const friday = new Date('2026-02-13T12:00:00Z')

  it('maps Today to current date with :day suffix', () => {
    assert.deepEqual(dayNameToDateKey('Today', friday), { date: '2026-02-13', key: '2026-02-13:day' })
  })

  it('maps Tonight to current date with :night suffix', () => {
    assert.deepEqual(dayNameToDateKey('Tonight', friday), { date: '2026-02-13', key: '2026-02-13:night' })
  })

  it('maps next day name to correct date', () => {
    assert.deepEqual(dayNameToDateKey('Saturday', friday), { date: '2026-02-14', key: '2026-02-14' })
  })

  it('maps same day name to next week', () => {
    assert.equal(dateOf('Friday', friday), '2026-02-20')
  })

  it('weekOffset=1 adds 7 days for duplicate day names', () => {
    assert.equal(dateOf('Saturday', friday, 0), '2026-02-14')
    assert.equal(dateOf('Saturday', friday, 1), '2026-02-21')
  })

  it('weekOffset=1 on Today/Tonight adds 7 days', () => {
    assert.deepEqual(dayNameToDateKey('Today', friday, 1), { date: '2026-02-20', key: '2026-02-20:day' })
    assert.deepEqual(dayNameToDateKey('Tonight', friday, 1), { date: '2026-02-20', key: '2026-02-20:night' })
  })

  it('returns null for invalid day name', () => {
    assert.equal(dayNameToDateKey('Notaday', friday), null)
  })

  it('uses resort local time (Pacific) not UTC for day-of-week calculation', () => {
    // Wednesday Feb 18, 6 PM PST = Thursday Feb 19, 2 AM UTC
    const wedEveningPST = new Date('2026-02-19T02:00:00Z')
    assert.equal(dateOf('Thursday', wedEveningPST), '2026-02-19')
  })

  it('Today/Tonight use resort local date not UTC date', () => {
    // Wednesday Feb 18, 10 PM PST = Thursday Feb 19, 6 AM UTC
    const wedNightPST = new Date('2026-02-19T06:00:00Z')
    assert.deepEqual(dayNameToDateKey('Today', wedNightPST), { date: '2026-02-18', key: '2026-02-18:day' })
    assert.deepEqual(dayNameToDateKey('Tonight', wedNightPST), { date: '2026-02-18', key: '2026-02-18:night' })
  })

  it('maps every weekday correctly from a Monday reference', () => {
    const monday = new Date('2026-02-16T20:00:00Z')
    assert.equal(dateOf('Monday', monday), '2026-02-23')
    assert.equal(dateOf('Tuesday', monday), '2026-02-17')
    assert.equal(dateOf('Wednesday', monday), '2026-02-18')
    assert.equal(dateOf('Thursday', monday), '2026-02-19')
    assert.equal(dateOf('Friday', monday), '2026-02-20')
    assert.equal(dateOf('Saturday', monday), '2026-02-21')
    assert.equal(dateOf('Sunday', monday), '2026-02-22')
  })

  it('maps every weekday correctly from a Sunday reference', () => {
    const sunday = new Date('2026-02-15T20:00:00Z')
    assert.equal(dateOf('Monday', sunday), '2026-02-16')
    assert.equal(dateOf('Tuesday', sunday), '2026-02-17')
    assert.equal(dateOf('Wednesday', sunday), '2026-02-18')
    assert.equal(dateOf('Thursday', sunday), '2026-02-19')
    assert.equal(dateOf('Friday', sunday), '2026-02-20')
    assert.equal(dateOf('Saturday', sunday), '2026-02-21')
    assert.equal(dateOf('Sunday', sunday), '2026-02-22')
  })

  it('just before Pacific midnight stays on current local date', () => {
    // Feb 18, 11:59 PM PST = Feb 19, 07:59 UTC
    const justBeforeMidnight = new Date('2026-02-19T07:59:00Z')
    assert.equal(dateOf('Today', justBeforeMidnight), '2026-02-18')
    assert.equal(dateOf('Thursday', justBeforeMidnight), '2026-02-19')
  })

  it('at Pacific midnight rolls to next local date', () => {
    // Feb 19, 12:00 AM PST = Feb 19, 08:00 UTC
    const atMidnight = new Date('2026-02-19T08:00:00Z')
    assert.equal(dateOf('Today', atMidnight), '2026-02-19')
    assert.equal(dateOf('Thursday', atMidnight), '2026-02-26')
    assert.equal(dateOf('Friday', atMidnight), '2026-02-20')
  })

  // Anchored to past DST transitions, which are frozen in the tz database.
  it('spring forward: PST→PDT midnight boundary shifts to UTC-7', () => {
    assert.equal(dateOf('Today', new Date('2023-03-13T06:00:00Z')), '2023-03-12')
    assert.equal(dateOf('Today', new Date('2023-03-13T07:00:00Z')), '2023-03-13')
  })

  it('fall back: PDT→PST midnight boundary shifts to UTC-8', () => {
    assert.equal(dateOf('Today', new Date('2023-11-06T07:00:00Z')), '2023-11-05')
    assert.equal(dateOf('Today', new Date('2023-11-06T08:00:00Z')), '2023-11-06')
  })

  it('forecast crosses month boundary (Feb → March)', () => {
    const feb28 = new Date('2026-02-28T20:00:00Z')
    assert.equal(dateOf('Sunday', feb28), '2026-03-01')
    assert.equal(dateOf('Monday', feb28), '2026-03-02')
    assert.equal(dateOf('Saturday', feb28), '2026-03-07')
  })

  it('forecast crosses year boundary (Dec → Jan)', () => {
    const dec30 = new Date('2026-12-30T20:00:00Z')
    assert.equal(dateOf('Thursday', dec30), '2026-12-31')
    assert.equal(dateOf('Friday', dec30), '2027-01-01')
    assert.equal(dateOf('Saturday', dec30), '2027-01-02')
    assert.equal(dateOf('Sunday', dec30), '2027-01-03')
  })

  const tenDay = [
    { day: 'Today', offset: 0, date: '2026-02-11', key: '2026-02-11:day' },
    { day: 'Tonight', offset: 0, date: '2026-02-11', key: '2026-02-11:night' },
    { day: 'Thursday', offset: 0, date: '2026-02-12', key: '2026-02-12' },
    { day: 'Friday', offset: 0, date: '2026-02-13', key: '2026-02-13' },
    { day: 'Saturday', offset: 0, date: '2026-02-14', key: '2026-02-14' },
    { day: 'Sunday', offset: 0, date: '2026-02-15', key: '2026-02-15' },
    { day: 'Monday', offset: 0, date: '2026-02-16', key: '2026-02-16' },
    { day: 'Tuesday', offset: 0, date: '2026-02-17', key: '2026-02-17' },
    { day: 'Wednesday', offset: 0, date: '2026-02-18', key: '2026-02-18' },
    { day: 'Thursday', offset: 1, date: '2026-02-19', key: '2026-02-19' },
    { day: 'Friday', offset: 1, date: '2026-02-20', key: '2026-02-20' },
  ]

  it('full 10-day forecast maps all days to correct dates', () => {
    const wed = new Date('2026-02-11T18:00:00Z')
    for (let { day, offset, date, key } of tenDay) {
      assert.deepEqual(dayNameToDateKey(day, wed, offset), { date, key })
    }
  })

  it('full 10-day forecast during the dangerous UTC-ahead window', () => {
    // Wednesday Feb 11, 10 PM PST = Thursday Feb 12, 6 AM UTC
    const dangerousWindow = new Date('2026-02-12T06:00:00Z')
    for (let { day, offset, date, key } of tenDay.slice(0, 10)) {
      assert.deepEqual(dayNameToDateKey(day, dangerousWindow, offset), { date, key })
    }
  })
})

describe('extractForecast with 10-day forecast', () => {
  const forecast = extractForecast(duplicateHtml)

  it('extracts all entries including duplicates', () => {
    assert.equal(forecast.length, 11)
  })

  it('Saturday appears twice with different values', () => {
    const saturdays = forecast.filter((f) => f.day === 'Saturday')
    assert.equal(saturdays.length, 2)
    assert.equal(saturdays[0]?.amount, 8)
    assert.equal(saturdays[0]?.freezingLevel, 1400)
    assert.equal(saturdays[1]?.amount, 15)
    assert.equal(saturdays[1]?.freezingLevel, 600)
  })

  it('Sunday appears twice with different values', () => {
    const sundays = forecast.filter((f) => f.day === 'Sunday')
    assert.equal(sundays.length, 2)
    assert.equal(sundays[0]?.amount, 2)
    assert.equal(sundays[1]?.amount, 12)
  })

  it('does not include valley entries', () => {
    const saturdays = forecast.filter((f) => f.day === 'Saturday')
    assert.equal(saturdays.length, 2)
    assert.ok(saturdays.every((s) => s.freezingLevel !== null))
  })
})

describe('trackForecastHistory', () => {
  function setup() {
    let store = createMemoryStore()
    let html = duplicateHtml
    let nowIso = '2026-02-13T12:00:00Z'
    let service = createSnowReportService({
      storage: store,
      fetch: (async () => new Response(html, { status: 200 })) as typeof fetch,
      now: () => new Date(nowIso),
    })
    async function fetchAt(fetchedAt: string, withHtml = duplicateHtml) {
      html = withHtml
      nowIso = fetchedAt
      delete store.data['snow-report:cache']
      return service.getSnowReport()
    }
    let record = (key: string): ForecastRecord => {
      let r = store.data[key] as ForecastRecord | undefined
      assert.ok(r, `missing ${key}`)
      return r
    }
    return { store, fetchAt, record }
  }

  it('duplicate day names get different date keys', async () => {
    let { fetchAt } = setup()
    const result = await fetchAt('2026-02-13T12:00:00Z')
    const saturdays = result.forecast.filter((f) => f.day === 'Saturday')
    assert.equal(saturdays.length, 2)
    assert.equal(saturdays[0]?.actualDate, '2026-02-14')
    assert.equal(saturdays[1]?.actualDate, '2026-02-21')
  })

  it('duplicate day names get separate storage records', async () => {
    let { fetchAt, record } = setup()
    await fetchAt('2026-02-13T12:00:00Z')
    assert.equal(record('forecast:2026-02-14').history[0]?.amount, 8)
    assert.equal(record('forecast:2026-02-21').history[0]?.amount, 15)
  })

  it('repeated fetches with same data do not create duplicate history entries', async () => {
    let { fetchAt, record } = setup()
    await fetchAt('2026-02-13T12:00:00Z')
    await fetchAt('2026-02-13T12:20:00Z')
    assert.equal(record('forecast:2026-02-14').history.length, 1)
    assert.equal(record('forecast:2026-02-21').history.length, 1)
  })

  it('forecast change creates exactly one new history entry', async () => {
    let { fetchAt, record } = setup()
    await fetchAt('2026-02-13T12:00:00Z')
    const updatedHtml = duplicateHtml.replace(
      '<li>Snow: 8 cm</li><li>Freezing level: 1400 metres.</li>',
      '<li>Snow: 12 cm</li><li>Freezing level: 1400 metres.</li>',
    )
    await fetchAt('2026-02-13T12:20:00Z', updatedHtml)
    const feb14 = record('forecast:2026-02-14')
    assert.equal(feb14.history.length, 2)
    assert.equal(feb14.history[0]?.amount, 8)
    assert.equal(feb14.history[0]?.firstSeen, '2026-02-13T12:00:00.000Z')
    assert.equal(feb14.history[1]?.amount, 12)
    assert.equal(feb14.history[1]?.firstSeen, '2026-02-13T12:20:00.000Z')
  })

  it('Today and Tonight get separate histories that do not cross-contaminate', async () => {
    let { fetchAt } = setup()
    await fetchAt('2026-02-13T12:00:00Z')
    const result = await fetchAt('2026-02-13T12:00:00Z')
    const today = result.forecast.find((f) => f.day === 'Today')
    const tonight = result.forecast.find((f) => f.day === 'Tonight')
    assert.ok(today && tonight)
    assert.ok(today.history.every((h) => h.amount === 3))
    assert.ok(tonight.history.every((h) => h.amount === 5))
  })

  it('no entries share the same firstSeen timestamp within a single key', async () => {
    let { store, fetchAt } = setup()
    await fetchAt('2026-02-13T12:00:00Z')
    await fetchAt('2026-02-13T12:20:00Z')
    await fetchAt('2026-02-13T12:40:00Z')
    for (let [key, value] of Object.entries(store.data)) {
      if (!key.startsWith('forecast:')) continue
      let timestamps = (value as ForecastRecord).history.map((h) => h.firstSeen)
      assert.equal(new Set(timestamps).size, timestamps.length, `Key ${key} has duplicate timestamps`)
    }
  })

  it('serves the cached report within the cache window', async () => {
    let { fetchAt, store } = setup()
    let first = await fetchAt('2026-02-13T12:00:00Z')
    assert.equal(first.fromCache, undefined)
    assert.ok(store.data['snow-report:cache'])
    let service = createSnowReportService({ storage: store, fetch: (async () => { throw new Error('should not fetch') }) as typeof fetch })
    let second = await service.getSnowReport()
    assert.equal(second.fromCache, true)
    assert.equal(second.snow.seasonTotal, first.snow.seasonTotal)
  })

  it('records a daily season total and a new-snow high-water mark', async () => {
    let { fetchAt, store } = setup()
    let report = await fetchAt('2026-02-13T12:00:00Z')
    let snowfall = store.data['snowfall:2026-02-13'] as { seasonTotal: number } | undefined
    let newSnow = store.data['newsnow:2026-02-13'] as { newSnow: number } | undefined
    if (report.snow.seasonTotal) assert.equal(snowfall?.seasonTotal, report.snow.seasonTotal)
    assert.equal(newSnow?.newSnow, report.snow.newSnow)
  })
})

describe('assignForecastDates', () => {
  // Thursday 2026-11-26, 04:44 Pacific: the resort page still shows last evening's run.
  let thursdayEarly = new Date('2026-11-26T12:44:00Z')

  it('maps a stale "Tonight" followed by today\'s weekday onto today, not next week', () => {
    let keys = assignForecastDates(['Tonight', 'Thursday', 'Friday', 'Saturday'], thursdayEarly)
    assert.deepEqual(
      keys.map((k) => k?.key),
      ['2026-11-26:night', '2026-11-26', '2026-11-27', '2026-11-28'],
    )
  })

  it('keeps dates monotonic and sends a repeated weekday a week later', () => {
    let friday = new Date('2026-02-13T20:00:00Z')
    let names = ['Today', 'Tonight', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    let dates = assignForecastDates(names, friday).map((k) => k?.date)
    assert.deepEqual(dates, [
      '2026-02-13',
      '2026-02-13',
      '2026-02-14',
      '2026-02-15',
      '2026-02-16',
      '2026-02-17',
      '2026-02-18',
      '2026-02-19',
      '2026-02-20',
      '2026-02-21',
    ])
  })

  it('returns null for an unknown name without moving the cursor', () => {
    let keys = assignForecastDates(['Notaday', 'Friday'], thursdayEarly)
    assert.equal(keys[0], null)
    assert.equal(keys[1]?.date, '2026-11-27')
  })
})
