// Key/value storage: Upstash Redis in production, a JSON file locally.
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Redis } from '@upstash/redis'

export type StorageMode = 'upstash-redis' | 'local-json'

export interface KeyValueStore {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown, ttlSeconds?: number | null): Promise<void>
  del(key: string): Promise<void>
  getAllByPrefix<T>(prefix: string): Promise<Record<string, T>>
  getWithMock<T>(key: string, currentAmount?: number, date?: string): Promise<T | null>
  useUpstash(): boolean
  storageMode(): StorageMode
}

export interface ForecastRevision {
  firstSeen: string
  amount: number
  freezingLevel: number | 'valley bottom' | null
}

interface MockRecord {
  date: string
  history: ForecastRevision[]
  _isMock: true
}

const LOCAL_STORAGE_PATH = path.join(process.cwd(), 'data', 'forecast-history.json')

export function useUpstash(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

export function storageMode(): StorageMode {
  return useUpstash() ? 'upstash-redis' : 'local-json'
}

let redis: Redis | null = null
function getRedis(): Redis {
  if (!redis) redis = Redis.fromEnv()
  return redis
}

// Fake history around the current amount so sparklines have something to show locally.
function generateMockHistory(currentAmount: number): ForecastRevision[] {
  let history: ForecastRevision[] = []
  let numEntries = 3 + Math.floor(Math.random() * 5)
  let now = new Date()

  for (let i = numEntries - 1; i >= 0; i--) {
    let timestamp = new Date(now)
    timestamp.setDate(timestamp.getDate() - i)
    timestamp.setHours(8 + Math.floor(Math.random() * 4), 0, 0, 0)

    let amount = currentAmount
    if (i !== 0) {
      let variation = Math.floor(Math.random() * 11) - 5
      amount = Math.max(0, currentAmount + variation)
    }

    history.push({
      firstSeen: timestamp.toISOString(),
      amount,
      freezingLevel: 1200 + Math.floor(Math.random() * 5) * 100,
    })
  }

  return history
}

type LocalData = Record<string, unknown>

function ensureLocalStorage(): void {
  let dir = path.dirname(LOCAL_STORAGE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(LOCAL_STORAGE_PATH)) fs.writeFileSync(LOCAL_STORAGE_PATH, '{}')
}

function readLocal(): LocalData {
  ensureLocalStorage()
  try {
    let parsed: unknown = JSON.parse(fs.readFileSync(LOCAL_STORAGE_PATH, 'utf8'))
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeLocal(data: LocalData): void {
  ensureLocalStorage()
  fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(data, null, 2))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function localGet<T>(key: string): T | null {
  let value = readLocal()[key]
  return value === undefined ? null : (value as T)
}

function localGetWithMock<T>(key: string, currentAmount?: number, date?: string): T | null {
  let existing = localGet<{ history?: unknown[] }>(key)
  if (existing && Array.isArray(existing.history) && existing.history.length > 1) {
    return existing as T
  }

  if (currentAmount !== undefined && date) {
    let targetDate = new Date(date)
    let today = new Date()
    today.setHours(0, 0, 0, 0)
    let daysOut = Math.floor((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    // Dates 5+ days out have no history yet, like a freshly published forecast.
    if (daysOut >= 5) {
      let record: MockRecord = {
        date,
        history: [{ firstSeen: new Date().toISOString(), amount: currentAmount, freezingLevel: 1400 }],
        _isMock: true,
      }
      return record as T
    }

    let record: MockRecord = { date, history: generateMockHistory(currentAmount), _isMock: true }
    return record as T
  }

  return existing as T | null
}

export async function get<T>(key: string): Promise<T | null> {
  if (useUpstash()) {
    let result = await getRedis().get<T>(key)
    return result ?? null
  }
  return localGet<T>(key)
}

export async function set(key: string, value: unknown, ttlSeconds: number | null = null): Promise<void> {
  if (useUpstash()) {
    if (ttlSeconds) {
      await getRedis().set(key, value, { ex: ttlSeconds })
    } else {
      await getRedis().set(key, value)
    }
    return
  }
  let data = readLocal()
  data[key] = value
  writeLocal(data)
}

export async function del(key: string): Promise<void> {
  if (useUpstash()) {
    await getRedis().del(key)
    return
  }
  let data = readLocal()
  delete data[key]
  writeLocal(data)
}

export async function getAllByPrefix<T>(prefix: string): Promise<Record<string, T>> {
  let results: Record<string, T> = {}
  if (useUpstash()) {
    let client = getRedis()
    let keys = await client.keys(`${prefix}*`)
    for (let key of keys) {
      let value = await client.get<T>(key)
      if (value !== null && value !== undefined) results[key] = value
    }
    return results
  }
  for (let [key, value] of Object.entries(readLocal())) {
    if (key.startsWith(prefix)) results[key] = value as T
  }
  return results
}

// Like get(), but locally invents history so sparklines render during development.
export async function getWithMock<T>(key: string, currentAmount?: number, date?: string): Promise<T | null> {
  if (useUpstash()) return get<T>(key)
  return localGetWithMock<T>(key, currentAmount, date)
}

export const storage: KeyValueStore = { get, set, del, getAllByPrefix, getWithMock, useUpstash, storageMode }

// In-memory store for tests and one-off scripts.
export function createMemoryStore(initial: Record<string, unknown> = {}): KeyValueStore & { data: Record<string, unknown> } {
  let data: Record<string, unknown> = { ...initial }
  let clone = <T>(value: unknown): T => JSON.parse(JSON.stringify(value)) as T
  return {
    data,
    async get<T>(key: string) {
      return key in data ? clone<T>(data[key]) : null
    },
    async set(key, value) {
      data[key] = clone(value)
    },
    async del(key) {
      delete data[key]
    },
    async getAllByPrefix<T>(prefix: string) {
      let results: Record<string, T> = {}
      for (let [key, value] of Object.entries(data)) {
        if (key.startsWith(prefix)) results[key] = clone<T>(value)
      }
      return results
    },
    async getWithMock<T>(key: string) {
      return key in data ? clone<T>(data[key]) : null
    },
    useUpstash: () => false,
    storageMode: () => 'local-json',
  }
}
