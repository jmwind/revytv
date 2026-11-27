import * as fs from 'node:fs'
import * as path from 'node:path'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  alignResortSeries,
  createHistoricalService,
  fillForward,
  mergeCurrentSeason,
  parseHistoricalSnowData,
  summarizeSeason,
  type ParsedHistoricalData,
} from '../app/server/historical.ts'
import {
  clampSeasonIndex,
  dayOfSeasonIndex,
  isSummerSeason,
  seasonIndexToDate,
  seasonLabel,
  seasonStartYear,
} from '../app/server/season.ts'
import { createMemoryStore } from '../app/server/storage.ts'

const html = fs.readFileSync(path.join(import.meta.dirname, 'fixtures/historical-snow-data.html'), 'utf8')

describe('parseHistoricalSnowData', () => {
  const data = parseHistoricalSnowData(html)
  const season = (label: string) => {
    let s = data.seasons.find((x) => x.label === label)
    assert.ok(s, `missing season ${label}`)
    return s
  }

  it('reads the Nov 1 to Apr 20 axis', () => {
    assert.equal(data.dates.length, 171)
    assert.equal(data.dates[0], '01-Nov')
    assert.equal(data.dates[170], '20-Apr')
  })

  it('reads every season since 2007-08', () => {
    assert.equal(data.seasons.length, 20)
    assert.equal(data.seasons[0]?.label, '07-08')
    assert.equal(data.seasons[0]?.startYear, 2007)
    assert.equal(data.seasons[19]?.label, '26-27')
    assert.equal(data.seasons[19]?.startYear, 2026)
  })

  it('normalizes every series to the axis length', () => {
    for (let s of data.seasons) assert.equal(s.values.length, 171, s.label)
  })

  it('reads season totals from the last non-null value', () => {
    assert.equal(season('07-08').total, 963)
    assert.equal(season('07-08').lastIndex, 170)
    assert.equal(season('26-27').total, 220)
    assert.equal(season('26-27').lastIndex, 36)
    assert.equal(season('26-27').values.filter((v) => v !== null).length, 37)
  })

  it('keeps leading nulls for seasons that started reporting late', () => {
    let s = season('08-09')
    for (let i = 0; i < 26; i++) assert.equal(s.values[i], null)
    assert.ok(typeof s.values[26] === 'number')
  })

  it('rejects html without the chart', () => {
    assert.throws(() => parseHistoricalSnowData('<html></html>'))
  })
})

describe('fillForward', () => {
  it('carries the last value over gaps and leaves leading nulls', () => {
    assert.deepEqual(fillForward([null, 1, null, null, 4, null]), [null, 1, 1, 1, 4, 4])
  })
})

describe('summarizeSeason', () => {
  // Three past seasons on a 5-day axis plus the current one.
  const data: ParsedHistoricalData = {
    dates: ['01-Nov', '02-Nov', '03-Nov', '04-Nov', '05-Nov'],
    seasons: [
      { label: 'A', startYear: 2001, values: [10, 20, 30, 40, 50], total: 50, lastIndex: 4 },
      { label: 'B', startYear: 2002, values: [null, null, 60, 80, 100], total: 100, lastIndex: 4 },
      { label: 'C', startYear: 2003, values: [5, 5, null, null, 25], total: 25, lastIndex: 4 },
      { label: 'CUR', startYear: 2004, values: [7, 9, null, null, null], total: 9, lastIndex: 1 },
    ],
  }

  it('compares the current total against past seasons on the same day', () => {
    let s = summarizeSeason(data, { currentLabel: 'CUR', index: 1, currentTotal: 15 })
    assert.equal(s.dateLabel, '02-Nov')
    assert.equal(s.comparedCount, 2) // B has no data yet on day 1
    assert.equal(s.mean, 13) // (20 + 5) / 2 = 12.5 -> 13
    assert.equal(s.median, 13)
    assert.deepEqual(s.max, { label: 'A', value: 20 })
    assert.deepEqual(s.min, { label: 'C', value: 5 })
    assert.equal(s.rank, 2)
    assert.equal(s.pctOfMean, 115)
    assert.deepEqual(s.seasons, [{ label: 'A', value: 20 }, { label: 'C', value: 5 }])
  })

  it('carries past values forward across gaps', () => {
    let s = summarizeSeason(data, { currentLabel: 'CUR', index: 3, currentTotal: 50 })
    assert.equal(s.comparedCount, 3)
    assert.deepEqual(s.seasons, [{ label: 'B', value: 80 }, { label: 'A', value: 40 }, { label: 'C', value: 5 }])
    assert.equal(s.rank, 2)
  })

  it('projects the end of season from the mean remaining snowfall', () => {
    let s = summarizeSeason(data, { currentLabel: 'CUR', index: 1, currentTotal: 15 })
    // remaining: A 50-20=30, C 25-5=20 -> mean 25 -> 40
    assert.equal(s.projectedTotal, 40)
    assert.equal(s.endOfSeason.mean, 58) // (50+100+25)/3 = 58.33
    assert.deepEqual(s.endOfSeason.max, { label: 'B', value: 100 })
    assert.deepEqual(s.endOfSeason.min, { label: 'C', value: 25 })
  })

  it('builds a min/max/mean band over past seasons', () => {
    let s = summarizeSeason(data, { currentLabel: 'CUR', index: 0, currentTotal: null })
    assert.deepEqual(s.band.min, [5, 5, 5, 5, 25])
    assert.deepEqual(s.band.max, [10, 20, 60, 80, 100])
    assert.deepEqual(s.band.mean, [8, 13, 32, 42, 58])
    assert.equal(s.rank, null)
    assert.equal(s.pctOfMean, null)
    assert.equal(s.projectedTotal, null)
  })

  it('clamps the index to the axis', () => {
    assert.equal(summarizeSeason(data, { currentLabel: 'CUR', index: 99, currentTotal: 1 }).index, 4)
    assert.equal(summarizeSeason(data, { currentLabel: 'CUR', index: -3, currentTotal: 1 }).index, 0)
  })
})

describe('season helpers', () => {
  it('indexes days from Nov 1 in resort time', () => {
    assert.equal(dayOfSeasonIndex(new Date('2026-11-26T20:00:00Z')), 25)
    assert.equal(dayOfSeasonIndex(new Date('2026-11-01T20:00:00Z')), 0)
    assert.equal(dayOfSeasonIndex(new Date('2027-04-20T20:00:00Z')), 170)
    assert.ok(dayOfSeasonIndex(new Date('2026-10-20T20:00:00Z')) < 0)
    assert.ok(dayOfSeasonIndex(new Date('2027-05-01T20:00:00Z')) > 170)
    // Nov 1 at 1 AM UTC is still Oct 31 in Revelstoke.
    assert.equal(dayOfSeasonIndex(new Date('2026-11-01T01:00:00Z')), -1)
  })

  it('labels seasons by their start year', () => {
    assert.equal(seasonLabel(new Date('2026-11-26T20:00:00Z')), '26-27')
    assert.equal(seasonLabel(new Date('2026-07-15T20:00:00Z')), '26-27')
    assert.equal(seasonLabel(new Date('2027-04-20T20:00:00Z')), '26-27')
    assert.equal(seasonLabel(new Date('2027-06-30T20:00:00Z')), '26-27')
    assert.equal(seasonLabel(new Date('2027-07-01T20:00:00Z')), '27-28')
    assert.equal(seasonStartYear(new Date('2026-02-01T20:00:00Z')), 2025)
  })

  it('knows summer', () => {
    assert.equal(isSummerSeason(new Date('2026-05-01T20:00:00Z')), true)
    assert.equal(isSummerSeason(new Date('2026-10-31T20:00:00Z')), true)
    assert.equal(isSummerSeason(new Date('2026-11-01T20:00:00Z')), false)
    assert.equal(isSummerSeason(new Date('2026-04-30T20:00:00Z')), false)
  })

  it('maps indexes back to dates and clamps', () => {
    assert.equal(seasonIndexToDate(2026, 0), '2026-11-01')
    assert.equal(seasonIndexToDate(2026, 170), '2027-04-20')
    assert.equal(clampSeasonIndex(-5), 0)
    assert.equal(clampSeasonIndex(500), 170)
  })
})

describe('historical service', () => {
  it('fetches, caches, and serves from cache within 12 hours', async () => {
    let store = createMemoryStore()
    let calls = 0
    let service = createHistoricalService({
      storage: store,
      fetch: (async () => {
        calls++
        return new Response(html, { status: 200 })
      }) as typeof fetch,
    })
    let t0 = new Date('2026-11-26T12:00:00Z')
    let first = await service.getHistoricalSnowData(t0)
    assert.equal(first.fromCache, false)
    assert.equal(first.seasons.length, 20)
    let second = await service.getHistoricalSnowData(new Date(t0.getTime() + 60_000))
    assert.equal(second.fromCache, true)
    assert.equal(calls, 1)
    await service.getHistoricalSnowData(new Date(t0.getTime() + 13 * 3600_000))
    assert.equal(calls, 2)
  })

  it('serves stale cache when the refetch fails', async () => {
    let store = createMemoryStore()
    let ok = true
    let service = createHistoricalService({
      storage: store,
      fetch: (async () => (ok ? new Response(html) : new Response('nope', { status: 500 }))) as typeof fetch,
    })
    let t0 = new Date('2026-11-26T12:00:00Z')
    await service.getHistoricalSnowData(t0)
    ok = false
    let stale = await service.getHistoricalSnowData(new Date(t0.getTime() + 24 * 3600_000))
    assert.equal(stale.fromCache, true)
    assert.equal(stale.seasons.length, 20)
  })

  it('places our daily season totals on the season axis', async () => {
    let store = createMemoryStore({
      'snowfall:2026-10-30': { date: '2026-10-30', seasonTotal: 5, recordedAt: 'x' },
      'snowfall:2026-11-01': { date: '2026-11-01', seasonTotal: 10, recordedAt: 'x' },
      'snowfall:2026-11-26': { date: '2026-11-26', seasonTotal: 220, recordedAt: 'x' },
      'snowfall:2027-04-20': { date: '2027-04-20', seasonTotal: 900, recordedAt: 'x' },
      'snowfall:2027-04-21': { date: '2027-04-21', seasonTotal: 901, recordedAt: 'x' },
    })
    let service = createHistoricalService({ storage: store })
    let values = await service.getCurrentSeasonSeries(2026)
    assert.equal(values.length, 171)
    assert.equal(values[0], 10)
    assert.equal(values[25], 220)
    assert.equal(values[170], 900)
    assert.equal(values[1], null)
  })
})

describe('alignResortSeries', () => {
  let pad = (values: Array<number | null>): Array<number | null> => [...values, ...new Array(171 - values.length).fill(null)]

  it('leaves a series that ends on or before today where it is', () => {
    let aligned = alignResortSeries(pad([0, 4, 7, 14]), 25, 30)
    assert.deepEqual(aligned.slice(0, 5), [0, 4, 7, 14, null])
  })

  it('slides a series that runs past today so it ends yesterday when the live total has moved on', () => {
    // 36 points on Nov 26 (index 25): the resort counts from the day it started logging.
    let values = pad(new Array(36).fill(0).map((_, i) => i * 6))
    let aligned = alignResortSeries(values, 25, 255)
    assert.equal(aligned[24], 210)
    assert.equal(aligned[25], null)
    assert.equal(aligned[0], 66) // the 10 points before Nov 1 fall off the axis
    assert.equal(aligned.filter((v) => v != null).length, 25)
  })

  it('ends on today when the live total matches the last point', () => {
    let values = pad(new Array(36).fill(0).map((_, i) => i * 6))
    let aligned = alignResortSeries(values, 25, 210)
    assert.equal(aligned[25], 210)
    assert.equal(aligned[26], null)
  })

  it('returns an empty axis for an empty series', () => {
    assert.ok(alignResortSeries(pad([]), 25, 100).every((v) => v == null))
  })
})

describe('mergeCurrentSeason', () => {
  it('fills days before our first record from the resort, then lets our records win', () => {
    let resort = new Array<number | null>(171).fill(null)
    resort[0] = 10
    resort[1] = 20
    resort[2] = 30
    let own = new Array<number | null>(171).fill(null)
    own[2] = 33
    let merged = mergeCurrentSeason(resort, own, 4)
    assert.deepEqual(merged.slice(0, 6), [10, 20, 33, 33, 33, null])
  })

  it('works with no resort series at all', () => {
    let own = new Array<number | null>(171).fill(null)
    own[3] = 50
    let merged = mergeCurrentSeason(undefined, own, 5)
    assert.deepEqual(merged.slice(0, 7), [null, null, null, 50, 50, 50, null])
  })
})
