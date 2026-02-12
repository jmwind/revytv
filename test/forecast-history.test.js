const fs = require('fs');
const path = require('path');
const { extractForecast, dayNameToDateKey } = require('../api/snow-report');

const duplicateHtml = fs.readFileSync(
    path.join(__dirname, 'fixtures/forecast-duplicates.html'), 'utf8'
);

// --- dayNameToDateKey ---

describe('dayNameToDateKey', () => {
    // Use a fixed reference: Friday 2026-02-13
    const friday = new Date('2026-02-13T12:00:00Z');

    test('maps Today to current date with :day suffix', () => {
        const result = dayNameToDateKey('Today', friday);
        expect(result.date).toBe('2026-02-13');
        expect(result.key).toBe('2026-02-13:day');
    });

    test('maps Tonight to current date with :night suffix', () => {
        const result = dayNameToDateKey('Tonight', friday);
        expect(result.date).toBe('2026-02-13');
        expect(result.key).toBe('2026-02-13:night');
    });

    test('maps next day name to correct date', () => {
        // Friday -> next Saturday = Feb 14
        const result = dayNameToDateKey('Saturday', friday);
        expect(result.date).toBe('2026-02-14');
        expect(result.key).toBe('2026-02-14');
    });

    test('maps same day name to next week', () => {
        // Friday -> next Friday = Feb 20
        const result = dayNameToDateKey('Friday', friday);
        expect(result.date).toBe('2026-02-20');
    });

    test('weekOffset=1 adds 7 days for duplicate day names', () => {
        // Saturday with offset 0 = Feb 14
        const first = dayNameToDateKey('Saturday', friday, 0);
        expect(first.date).toBe('2026-02-14');

        // Saturday with offset 1 = Feb 21 (next week)
        const second = dayNameToDateKey('Saturday', friday, 1);
        expect(second.date).toBe('2026-02-21');
    });

    test('weekOffset=1 on Today/Tonight adds 7 days', () => {
        const today = dayNameToDateKey('Today', friday, 1);
        expect(today.date).toBe('2026-02-20');
        expect(today.key).toBe('2026-02-20:day');

        const tonight = dayNameToDateKey('Tonight', friday, 1);
        expect(tonight.date).toBe('2026-02-20');
        expect(tonight.key).toBe('2026-02-20:night');
    });

    test('returns null for invalid day name', () => {
        expect(dayNameToDateKey('Notaday', friday)).toBeNull();
    });

    test('uses resort local time (Pacific) not UTC for day-of-week calculation', () => {
        // Wednesday Feb 18, 6 PM PST = Thursday Feb 19, 2 AM UTC
        // The resort page shows "Thursday" meaning this coming Thursday (Feb 19)
        // Bug: UTC day is already Thursday, so daysUntil=0 → +7 → maps to Feb 26
        const wedEveningPST = new Date('2026-02-19T02:00:00Z');

        const result = dayNameToDateKey('Thursday', wedEveningPST);
        // Should be Feb 19 (next Thursday from Wednesday local), NOT Feb 26
        expect(result.date).toBe('2026-02-19');
    });

    test('Today/Tonight use resort local date not UTC date', () => {
        // Wednesday Feb 18, 10 PM PST = Thursday Feb 19, 6 AM UTC
        const wedNightPST = new Date('2026-02-19T06:00:00Z');

        const today = dayNameToDateKey('Today', wedNightPST);
        expect(today.date).toBe('2026-02-18');
        expect(today.key).toBe('2026-02-18:day');

        const tonight = dayNameToDateKey('Tonight', wedNightPST);
        expect(tonight.date).toBe('2026-02-18');
        expect(tonight.key).toBe('2026-02-18:night');
    });

    // --- Comprehensive day-of-week mapping ---

    test('maps every weekday correctly from a Monday reference', () => {
        // Monday Feb 16, 2026 at noon PST (8 PM UTC)
        const monday = new Date('2026-02-16T20:00:00Z');

        // Same day name → next week
        expect(dayNameToDateKey('Monday', monday).date).toBe('2026-02-23');
        // Future days this week
        expect(dayNameToDateKey('Tuesday', monday).date).toBe('2026-02-17');
        expect(dayNameToDateKey('Wednesday', monday).date).toBe('2026-02-18');
        expect(dayNameToDateKey('Thursday', monday).date).toBe('2026-02-19');
        expect(dayNameToDateKey('Friday', monday).date).toBe('2026-02-20');
        expect(dayNameToDateKey('Saturday', monday).date).toBe('2026-02-21');
        expect(dayNameToDateKey('Sunday', monday).date).toBe('2026-02-22');
    });

    test('maps every weekday correctly from a Sunday reference', () => {
        // Sunday Feb 15, 2026 at noon PST (8 PM UTC)
        const sunday = new Date('2026-02-15T20:00:00Z');

        expect(dayNameToDateKey('Monday', sunday).date).toBe('2026-02-16');
        expect(dayNameToDateKey('Tuesday', sunday).date).toBe('2026-02-17');
        expect(dayNameToDateKey('Wednesday', sunday).date).toBe('2026-02-18');
        expect(dayNameToDateKey('Thursday', sunday).date).toBe('2026-02-19');
        expect(dayNameToDateKey('Friday', sunday).date).toBe('2026-02-20');
        expect(dayNameToDateKey('Saturday', sunday).date).toBe('2026-02-21');
        // Same day → next week
        expect(dayNameToDateKey('Sunday', sunday).date).toBe('2026-02-22');
    });

    // --- Pacific midnight boundaries ---

    test('just before Pacific midnight stays on current local date', () => {
        // Feb 18, 11:59 PM PST = Feb 19, 07:59 UTC
        const justBeforeMidnight = new Date('2026-02-19T07:59:00Z');

        // Local day is still Wednesday Feb 18
        const result = dayNameToDateKey('Today', justBeforeMidnight);
        expect(result.date).toBe('2026-02-18');

        // Thursday should be tomorrow (Feb 19)
        expect(dayNameToDateKey('Thursday', justBeforeMidnight).date).toBe('2026-02-19');
    });

    test('at Pacific midnight rolls to next local date', () => {
        // Feb 19, 12:00 AM PST = Feb 19, 08:00 UTC
        const atMidnight = new Date('2026-02-19T08:00:00Z');

        // Local day is now Thursday Feb 19
        const result = dayNameToDateKey('Today', atMidnight);
        expect(result.date).toBe('2026-02-19');

        // Thursday (same day) should be next week
        expect(dayNameToDateKey('Thursday', atMidnight).date).toBe('2026-02-26');
        // Friday should be tomorrow
        expect(dayNameToDateKey('Friday', atMidnight).date).toBe('2026-02-20');
    });

    // --- DST transitions ---

    test('spring forward: PST→PDT midnight boundary shifts to UTC-7', () => {
        // DST 2026: March 8 at 2 AM PST → 3 AM PDT
        // After DST, Pacific midnight = UTC 07:00 (not 08:00)

        // March 8, 11 PM PDT = March 9, 06:00 UTC (still March 8 locally)
        const duringDST = new Date('2026-03-09T06:00:00Z');
        expect(dayNameToDateKey('Today', duringDST).date).toBe('2026-03-08');

        // March 9, 12 AM PDT = March 9, 07:00 UTC (now March 9 locally)
        const afterMidnightPDT = new Date('2026-03-09T07:00:00Z');
        expect(dayNameToDateKey('Today', afterMidnightPDT).date).toBe('2026-03-09');
    });

    test('fall back: PDT→PST midnight boundary shifts to UTC-8', () => {
        // DST 2026: November 1 at 2 AM PDT → 1 AM PST
        // After DST ends, Pacific midnight = UTC 08:00 (not 07:00)

        // Nov 1, 11 PM PST = Nov 2, 07:00 UTC (still Nov 1 locally)
        const afterFallBack = new Date('2026-11-02T07:00:00Z');
        expect(dayNameToDateKey('Today', afterFallBack).date).toBe('2026-11-01');

        // Nov 2, 12 AM PST = Nov 2, 08:00 UTC
        const nextDayPST = new Date('2026-11-02T08:00:00Z');
        expect(dayNameToDateKey('Today', nextDayPST).date).toBe('2026-11-02');
    });

    // --- Month and year boundary crossings ---

    test('forecast crosses month boundary (Feb → March)', () => {
        // Saturday Feb 28, 2026 at noon PST
        const feb28 = new Date('2026-02-28T20:00:00Z');

        // Sunday = tomorrow = March 1
        expect(dayNameToDateKey('Sunday', feb28).date).toBe('2026-03-01');
        // Monday = March 2
        expect(dayNameToDateKey('Monday', feb28).date).toBe('2026-03-02');
        // Saturday (same day) = next week = March 7
        expect(dayNameToDateKey('Saturday', feb28).date).toBe('2026-03-07');
    });

    test('forecast crosses year boundary (Dec → Jan)', () => {
        // Wednesday Dec 30, 2026 at noon PST
        const dec30 = new Date('2026-12-30T20:00:00Z');

        // Dec 30, 2026 is a Wednesday
        expect(dayNameToDateKey('Thursday', dec30).date).toBe('2026-12-31');
        expect(dayNameToDateKey('Friday', dec30).date).toBe('2027-01-01');
        expect(dayNameToDateKey('Saturday', dec30).date).toBe('2027-01-02');
        expect(dayNameToDateKey('Sunday', dec30).date).toBe('2027-01-03');
    });

    // --- Full 10-day forecast simulation ---

    test('full 10-day forecast maps all days to correct dates', () => {
        // Simulate a fetch on Wednesday Feb 11, 2026 at 10 AM PST (6 PM UTC)
        const wed = new Date('2026-02-11T18:00:00Z');

        // Typical forecast order: Today, Tonight, Thu, Fri, Sat, Sun, Mon, Tue, Wed, Thu, Fri
        // (with Wed, Thu, Fri appearing twice → weekOffset 0 then 1)
        const expected = [
            { day: 'Today',     offset: 0, date: '2026-02-11', key: '2026-02-11:day' },
            { day: 'Tonight',   offset: 0, date: '2026-02-11', key: '2026-02-11:night' },
            { day: 'Thursday',  offset: 0, date: '2026-02-12', key: '2026-02-12' },
            { day: 'Friday',    offset: 0, date: '2026-02-13', key: '2026-02-13' },
            { day: 'Saturday',  offset: 0, date: '2026-02-14', key: '2026-02-14' },
            { day: 'Sunday',    offset: 0, date: '2026-02-15', key: '2026-02-15' },
            { day: 'Monday',    offset: 0, date: '2026-02-16', key: '2026-02-16' },
            { day: 'Tuesday',   offset: 0, date: '2026-02-17', key: '2026-02-17' },
            { day: 'Wednesday', offset: 0, date: '2026-02-18', key: '2026-02-18' },
            // Second occurrence of days (weekOffset=1)
            { day: 'Thursday',  offset: 1, date: '2026-02-19', key: '2026-02-19' },
            { day: 'Friday',    offset: 1, date: '2026-02-20', key: '2026-02-20' },
        ];

        for (const { day, offset, date, key } of expected) {
            const result = dayNameToDateKey(day, wed, offset);
            expect(result.date).toBe(date);
            expect(result.key).toBe(key);
        }
    });

    test('full 10-day forecast during the dangerous UTC-ahead window', () => {
        // Wednesday Feb 11, 10 PM PST = Thursday Feb 12, 6 AM UTC
        // UTC thinks it's Thursday, but resort is still on Wednesday
        const dangerousWindow = new Date('2026-02-12T06:00:00Z');

        const expected = [
            { day: 'Today',     offset: 0, date: '2026-02-11', key: '2026-02-11:day' },
            { day: 'Tonight',   offset: 0, date: '2026-02-11', key: '2026-02-11:night' },
            { day: 'Thursday',  offset: 0, date: '2026-02-12', key: '2026-02-12' },
            { day: 'Friday',    offset: 0, date: '2026-02-13', key: '2026-02-13' },
            { day: 'Saturday',  offset: 0, date: '2026-02-14', key: '2026-02-14' },
            { day: 'Sunday',    offset: 0, date: '2026-02-15', key: '2026-02-15' },
            { day: 'Monday',    offset: 0, date: '2026-02-16', key: '2026-02-16' },
            { day: 'Tuesday',   offset: 0, date: '2026-02-17', key: '2026-02-17' },
            { day: 'Wednesday', offset: 0, date: '2026-02-18', key: '2026-02-18' },
            { day: 'Thursday',  offset: 1, date: '2026-02-19', key: '2026-02-19' },
        ];

        for (const { day, offset, date, key } of expected) {
            const result = dayNameToDateKey(day, dangerousWindow, offset);
            expect(result.date).toBe(date);
            expect(result.key).toBe(key);
        }
    });
});

// --- extractForecast with duplicates ---

describe('extractForecast with 10-day forecast', () => {
    const forecast = extractForecast(duplicateHtml);

    test('extracts all entries including duplicates', () => {
        expect(forecast.length).toBe(11); // 9 unique + 2 duplicate
    });

    test('Saturday appears twice with different values', () => {
        const saturdays = forecast.filter(f => f.day === 'Saturday');
        expect(saturdays.length).toBe(2);
        expect(saturdays[0].amount).toBe(8);
        expect(saturdays[0].freezingLevel).toBe(1400);
        expect(saturdays[1].amount).toBe(15);
        expect(saturdays[1].freezingLevel).toBe(600);
    });

    test('Sunday appears twice with different values', () => {
        const sundays = forecast.filter(f => f.day === 'Sunday');
        expect(sundays.length).toBe(2);
        expect(sundays[0].amount).toBe(2);
        expect(sundays[1].amount).toBe(12);
    });

    test('does not include valley entries', () => {
        // Valley has a Saturday entry — should not be captured
        const saturdays = forecast.filter(f => f.day === 'Saturday');
        expect(saturdays.length).toBe(2); // only alpine ones
        expect(saturdays.every(s => s.freezingLevel !== null)).toBe(true);
    });
});

// --- Forecast history tracking with mocked storage ---

describe('trackForecastHistory', () => {
    let mockStorage;
    let handler;

    beforeEach(() => {
        // In-memory mock storage
        const store = {};
        mockStorage = {
            get: jest.fn(async (key) => store[key] || null),
            set: jest.fn(async (key, value) => { store[key] = JSON.parse(JSON.stringify(value)); }),
            getWithMock: jest.fn(async (key) => store[key] || null),
            useUpstash: jest.fn(() => false),
            getAllByPrefix: jest.fn(async (prefix) => {
                const results = {};
                for (const [k, v] of Object.entries(store)) {
                    if (k.startsWith(prefix)) results[k] = v;
                }
                return results;
            }),
            _store: store,
        };

        // Re-require with mocked storage
        jest.resetModules();
        jest.doMock('../api/lib/storage.js', () => mockStorage);
        handler = require('../api/snow-report');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    async function callHandler(html, fetchedAt) {
        // Mock fetch to return our HTML
        const originalFetch = global.fetch;
        global.fetch = jest.fn(async () => ({
            ok: true,
            text: async () => html,
        }));

        // Mock Date for consistent fetchedAt
        const originalDate = global.Date;
        const mockNow = new Date(fetchedAt);
        const OrigDate = Date;
        jest.spyOn(global, 'Date').mockImplementation((...args) => {
            if (args.length === 0) return mockNow;
            return new OrigDate(...args);
        });
        global.Date.prototype = OrigDate.prototype;
        global.Date.now = () => mockNow.getTime();

        const result = {};
        const req = { method: 'GET' };
        const res = {
            setHeader: jest.fn(),
            status: jest.fn(() => res),
            json: jest.fn((data) => { Object.assign(result, data); return res; }),
            end: jest.fn(),
        };

        await handler(req, res);

        global.fetch = originalFetch;
        jest.restoreAllMocks();

        return result;
    }

    test('duplicate day names get different date keys', async () => {
        // Simulate fetching on Friday 2026-02-13
        const result = await callHandler(duplicateHtml, '2026-02-13T12:00:00Z');

        const saturdays = result.forecast.filter(f => f.day === 'Saturday');
        expect(saturdays.length).toBe(2);

        // First Saturday = Feb 14, second Saturday = Feb 21
        expect(saturdays[0].actualDate).toBe('2026-02-14');
        expect(saturdays[1].actualDate).toBe('2026-02-21');
    });

    test('duplicate day names get separate storage records', async () => {
        await callHandler(duplicateHtml, '2026-02-13T12:00:00Z');

        // Check storage was written to different keys
        const feb14 = mockStorage._store['forecast:2026-02-14'];
        const feb21 = mockStorage._store['forecast:2026-02-21'];

        expect(feb14).toBeDefined();
        expect(feb21).toBeDefined();
        expect(feb14.history[0].amount).toBe(8);   // first Saturday
        expect(feb21.history[0].amount).toBe(15);  // second Saturday
    });

    test('repeated fetches with same data do not create duplicate history entries', async () => {
        // First fetch
        await callHandler(duplicateHtml, '2026-02-13T12:00:00Z');

        // Clear cache so it re-fetches
        delete mockStorage._store['snow-report:cache'];

        // Second fetch 20 minutes later — same forecast data
        await callHandler(duplicateHtml, '2026-02-13T12:20:00Z');

        // Saturday Feb 14 should still have exactly 1 history entry (data unchanged)
        const feb14 = mockStorage._store['forecast:2026-02-14'];
        expect(feb14.history.length).toBe(1);

        // Saturday Feb 21 also just 1 entry
        const feb21 = mockStorage._store['forecast:2026-02-21'];
        expect(feb21.history.length).toBe(1);
    });

    test('forecast change creates exactly one new history entry', async () => {
        // First fetch: Saturday = 8cm
        await callHandler(duplicateHtml, '2026-02-13T12:00:00Z');
        delete mockStorage._store['snow-report:cache'];

        // Updated HTML: Saturday changes from 8cm to 12cm
        const updatedHtml = duplicateHtml.replace(
            '<li>Snow: 8 cm</li><li>Freezing level: 1400 metres.</li>',
            '<li>Snow: 12 cm</li><li>Freezing level: 1400 metres.</li>'
        );

        await callHandler(updatedHtml, '2026-02-13T12:20:00Z');

        const feb14 = mockStorage._store['forecast:2026-02-14'];
        expect(feb14.history.length).toBe(2);
        expect(feb14.history[0].amount).toBe(8);
        expect(feb14.history[0].firstSeen).toBe('2026-02-13T12:00:00.000Z');
        expect(feb14.history[1].amount).toBe(12);
        expect(feb14.history[1].firstSeen).toBe('2026-02-13T12:20:00.000Z');
    });

    test('Today and Tonight get separate histories that do not cross-contaminate', async () => {
        await callHandler(duplicateHtml, '2026-02-13T12:00:00Z');

        const result = await callHandler(duplicateHtml, '2026-02-13T12:00:00Z');
        const today = result.forecast.find(f => f.day === 'Today');
        const tonight = result.forecast.find(f => f.day === 'Tonight');

        // Today's history should only contain the 3cm entry
        expect(today.history.every(h => h.amount === 3)).toBe(true);
        // Tonight's history should only contain the 5cm entry
        expect(tonight.history.every(h => h.amount === 5)).toBe(true);
    });

    test('no entries share the same firstSeen timestamp within a single key', async () => {
        // Fetch multiple times
        await callHandler(duplicateHtml, '2026-02-13T12:00:00Z');
        delete mockStorage._store['snow-report:cache'];
        await callHandler(duplicateHtml, '2026-02-13T12:20:00Z');
        delete mockStorage._store['snow-report:cache'];
        await callHandler(duplicateHtml, '2026-02-13T12:40:00Z');

        // Check every forecast key — no duplicate timestamps within a single record
        for (const [key, record] of Object.entries(mockStorage._store)) {
            if (!key.startsWith('forecast:') || !record.history) continue;

            const timestamps = record.history.map(h => h.firstSeen);
            const unique = new Set(timestamps);
            expect(unique.size).toBe(timestamps.length,
                `Key ${key} has duplicate timestamps: ${JSON.stringify(timestamps)}`);
        }
    });
});
