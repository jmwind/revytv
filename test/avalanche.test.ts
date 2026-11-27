import * as fs from 'node:fs'
import * as path from 'node:path'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createAvalancheService, htmlToParagraphs, parseAvalancheProduct } from '../app/server/avalanche.ts'
import { createMemoryStore } from '../app/server/storage.ts'

const json: unknown = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/avalanche-point.json'), 'utf8'))

describe('parseAvalancheProduct', () => {
  const f = parseAvalancheProduct(json)

  it('reads three days of danger ratings by elevation band', () => {
    assert.equal(f.days.length, 3)
    assert.equal(f.days[0]?.label, 'Friday')
    assert.deepEqual(f.days[0]?.alp, { level: 2, label: 'Moderate' })
    assert.deepEqual(f.days[0]?.btl, { level: 1, label: 'Low' })
    assert.deepEqual(f.days[1]?.tln, { level: 1, label: 'Low' })
  })

  it('reads the highlights as plain paragraphs', () => {
    assert.equal(f.highlights.length, 2)
    assert.match(f.highlights[0] ?? '', /^While it's exciting/)
    assert.ok(!/</.test(f.highlights.join('')))
  })

  it('reads confidence with its statements', () => {
    assert.equal(f.confidence.label, 'Moderate')
    assert.equal(f.confidence.statements.length, 2)
  })

  it('reads problems with their elevations', () => {
    assert.equal(f.problems[0]?.type, 'Storm Slab')
    assert.deepEqual(f.problems[0]?.elevations, ['Alpine', 'Treeline'])
  })

  it('keeps the link to the forecast page and its dates', () => {
    assert.match(f.url, /^https:\/\/avalanche\.ca\/forecasts\//)
    assert.equal(f.dateIssued, '2026-11-26T23:00:00Z')
    assert.equal(f.validUntil, '2026-11-27T23:00:00Z')
  })

  it('refuses a response without ratings', () => {
    assert.throws(() => parseAvalancheProduct({ report: { dateIssued: 'x', dangerRatings: [] } }), /no danger ratings/)
    assert.throws(() => parseAvalancheProduct({}), /no report/)
  })
})

describe('htmlToParagraphs', () => {
  it('splits paragraphs, drops tags and decodes entities', () => {
    assert.deepEqual(htmlToParagraphs('<p>One &amp; <a href="x">two</a>.</p><p>Three<br>four</p>'), ['One & two.', 'Three four'])
  })
})

describe('getAvalancheForecast', () => {
  function service(ok: () => boolean) {
    let store = createMemoryStore()
    let svc = createAvalancheService({
      storage: store,
      fetch: (async () => (ok() ? new Response(JSON.stringify(json)) : new Response('nope', { status: 503 }))) as typeof fetch,
    })
    return svc
  }

  it('caches for an hour, then refreshes', async () => {
    let ok = true
    let svc = service(() => ok)
    let t0 = new Date('2026-11-27T10:00:00Z')
    let first = await svc.getAvalancheForecast(t0)
    assert.equal(first.fromCache, false)
    let second = await svc.getAvalancheForecast(new Date(t0.getTime() + 30 * 60_000))
    assert.equal(second.fromCache, true)
    let third = await svc.getAvalancheForecast(new Date(t0.getTime() + 90 * 60_000))
    assert.equal(third.fromCache, false)
  })

  it('serves the stale copy when the refresh fails', async () => {
    let ok = true
    let svc = service(() => ok)
    let t0 = new Date('2026-11-27T10:00:00Z')
    await svc.getAvalancheForecast(t0)
    ok = false
    let stale = await svc.getAvalancheForecast(new Date(t0.getTime() + 2 * 3600_000))
    assert.equal(stale.fromCache, true)
    assert.equal(stale.days.length, 3)
  })
})
