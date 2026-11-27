import * as fs from 'node:fs'
import * as path from 'node:path'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { extractForecast, parseSnowReport } from '../app/server/snow-report.ts'

const html = fs.readFileSync(path.join(import.meta.dirname, 'fixtures/snow-report.html'), 'utf8')

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
})
