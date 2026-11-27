# Product

Truflake ("Revy Snow for Nerds"): a real-time snow dashboard for Revelstoke Mountain Resort, built by one Revelstoke household for itself and for other snow nerds. Facts marked (inferred) come from the owner's written brief and the existing code, not from an interview.

## Platform

web

## Stack

Remix v3 (3.3.0) server-rendered components, TypeScript, Node 24. Hosted on Vercel as a single fetch handler. Upstash Redis for the data store, with a local JSON file fallback for development. Data scraped from revelstokemountainresort.com (snow report, 10-day alpine forecast, historical snowfall tracker), Open-Meteo for summer temperatures, Windy for the snow-forecast map, resort and Ozolio webcams, YouTube for the TV-mode background.

## Users

The owner's household, who keep TV mode running on the living-room TV all season and check the home page from phones several times a day. Beyond them, Revelstoke locals and visiting skiers who want more than the resort's own snow report. (inferred) They already read the Avalanche Canada bulletin, the resort's snow report, and Windy; they compare and cross-reference rather than trust one number.

## Product Purpose

Answer, in one glance, "what did it do, what is it going to do, and how does that compare": today's new snow and base, how the 10-day alpine forecast has shifted since it was first published, what the cameras show right now, and from this redesign onward how this season's accumulation stacks up against every season since 2007-08.

## Positioning

The resort's report is a snapshot. Truflake is the record: it stores every forecast change and every daily total so trends, revisions, and disappointments are visible. Free, no accounts, no paywall (the subscription tier was removed in this redesign). (inferred) Tone is dry and self-aware; the About page is deliberately funny and must stay that way.

## Operating Context

Two scenes. One: a phone or laptop, checked at 6 am in bed and again at the desk, under whatever light the room has, so the dashboard must work in both light and dark. Two: a TV on a wall across a room, running for hours with a muted ski video behind live cameras, forecast, and a ticker; text there must read from the couch. Winter is the main season (resort opens early December, closes mid-April). A summer mode (May through October) swaps snow for base and alpine temperatures and bike videos.

## Capabilities and Constraints

- Scraped source HTML can change without notice; parsers are regex-based and tested against fixtures.
- Serverless: no long-running process, no local disk persistence; all state lives in Redis.
- Forecast history is only as old as the records collected; early seasons of the resort's historical tracker start in December, not November.
- Webcam images are third-party and may be stale or unavailable.
- The Windy embed and the YouTube player are third-party scripts that load after the page.
- Keep it simple to run locally (one command) and to deploy to Vercel.

## Brand Commitments

- Name: Truflake (site title "Revy Snow for Nerds"). Domain truflake.com.
- Mark: the eight-spoke line snowflake, kept as the logo and favicon.
- Information-rich by design; the audience are nerds and want the numbers, the deltas, and the history.
- Must not look like a generic AI-made dashboard. The owner pointed at impeccable.style and uizze.com for taste.

## Evidence on Hand

Live snow report HTML and a captured fixture; the resort's historical snowfall tracker (an ECharts config with one cumulative series per season since 2007-08, Nov 1 to Apr 20); Redis records of forecast revisions, daily season totals, and daily new-snow high-water marks collected since the 2025-26 season; the existing About copy.

## Product Principles

- Show the change, not just the value: every forecast number carries how it moved.
- Compare before you conclude: the current season against the historical range, with the mean and the record years named.
- Label staleness honestly; cached data shows when it was fetched.
- Keep it free and account-less.

## Accessibility & Inclusion

Status never relies on color alone (deltas carry arrows and signed numbers). Body contrast at 4.5:1 or better in both schemes. TV mode is a large-display surface and says so on small screens rather than breaking silently. Keyboard-reachable controls for every clickable card.
