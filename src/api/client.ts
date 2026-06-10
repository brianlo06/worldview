import type { DotRecord } from '../globe/dots'
import type { Category } from '../globe/categories'
import type { SignificanceTier } from '../globe/tiers'

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://127.0.0.1:8088'

const DEFAULT_TIMEOUT_MS = 8000

// fetch() only aborts on the caller's signal — a backend that accepts the
// socket but never responds would hang forever, freezing boot with no SEED
// fallback (the offline path only triggers on rejection). Race every request
// against a timeout so a dead/slow API degrades instead of stalling.
async function timedFetch(
  url: string,
  init: RequestInit & { signal?: AbortSignal } = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController()
  const onCallerAbort = () => ctrl.abort(init.signal?.reason)
  if (init.signal) {
    if (init.signal.aborted) ctrl.abort(init.signal.reason)
    else init.signal.addEventListener('abort', onCallerAbort, { once: true })
  }
  const timer = setTimeout(
    () => ctrl.abort(new DOMException('Request timed out', 'TimeoutError')),
    timeoutMs,
  )
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
    init.signal?.removeEventListener('abort', onCallerAbort)
  }
}

type GeoPrecision = 'point' | 'city' | 'state' | 'country'

interface ApiEvent {
  id: string
  title: string
  summary: string | null
  url: string | null
  image_url: string | null
  source_outlet: string | null
  occurred_at: string
  lat: number
  lon: number
  country_code: string | null
  city: string | null
  categories: string[]
  importance: number | null
  breaking: boolean
  geo_precision: GeoPrecision | null
}

const VALID_CATEGORIES: ReadonlySet<Category> = new Set<Category>([
  'breaking',
  'politics',
  'conflict',
  'business',
  'weather',
  'quake',
  'social',
])

function isCategory(s: string): s is Category {
  return VALID_CATEGORIES.has(s as Category)
}

function toDot(e: ApiEvent): DotRecord {
  // Prefer a non-breaking category as the primary (color); use breaking only as the flag.
  const nonBreaking = e.categories.filter((c) => c !== 'breaking')
  const primary = nonBreaking.find(isCategory) ?? 'business'
  return {
    id: e.id,
    lat: e.lat,
    lon: e.lon,
    title: e.title,
    importance: e.importance ?? 0.5,
    category: primary,
    breaking: e.breaking,
    summary: e.summary,
    imageUrl: e.image_url,
    url: e.url,
    sourceOutlet: e.source_outlet,
    occurredAt: e.occurred_at,
    countryCode: e.country_code,
    city: e.city,
    geoPrecision: e.geo_precision,
  }
}

export interface FetchEventsOptions {
  hours?: number
  limit?: number
  minImportance?: number
  signal?: AbortSignal
}

export async function fetchRecentEvents(
  opts: FetchEventsOptions = {},
): Promise<DotRecord[]> {
  const params = new URLSearchParams()
  if (opts.hours !== undefined) params.set('hours', String(opts.hours))
  if (opts.limit !== undefined) params.set('limit', String(opts.limit))
  if (opts.minImportance !== undefined)
    params.set('min_importance', String(opts.minImportance))

  const url = `${API_BASE}/events/recent?${params}`
  const res = await timedFetch(url, { signal: opts.signal })
  if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}`)
  const events = (await res.json()) as ApiEvent[]
  return events.map(toDot)
}

interface ApiCluster {
  id: string
  title: string
  summary: string | null
  url: string | null
  image_url: string | null
  source_outlet: string | null
  first_seen: string
  last_seen: string
  event_count: number
  lat: number | null
  lon: number | null
  country_code: string | null
  city: string | null
  category: string | null
  importance: number | null
  breaking: boolean
  geo_precision: GeoPrecision | null
}

function clusterToDot(c: ApiCluster): DotRecord | null {
  if (c.lat === null || c.lon === null) return null
  const category =
    c.category && isCategory(c.category) ? c.category : 'business'
  // If multiple sources cover this story, label e.g. "fox13seattle.com · +18 more"
  const sourceLabel =
    c.event_count > 1
      ? `${c.source_outlet ?? 'source'} · +${c.event_count - 1} more`
      : c.source_outlet ?? undefined
  return {
    id: `cl:${c.id}`,
    lat: c.lat,
    lon: c.lon,
    title: c.title,
    summary: c.summary,
    imageUrl: c.image_url,
    url: c.url,
    sourceOutlet: sourceLabel,
    importance: c.importance ?? 0.5,
    category,
    breaking: c.breaking,
    occurredAt: c.last_seen,
    eventCount: c.event_count,
    countryCode: c.country_code,
    city: c.city,
    geoPrecision: c.geo_precision,
  }
}

export interface ApiAnomaly {
  id: string
  region_code: string
  started_at: string
  last_seen_at: string
  peak_rate: number
  baseline_rate: number
  sigma_above: number
  pulse_lat: number | null
  pulse_lon: number | null
  driver_titles: string[]
}

export async function fetchAnomalies(signal?: AbortSignal): Promise<ApiAnomaly[]> {
  const res = await timedFetch(`${API_BASE}/anomalies`, { signal })
  if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}`)
  return (await res.json()) as ApiAnomaly[]
}


interface ApiSearchResult {
  cluster_id: string
  title: string
  summary: string | null
  url: string | null
  image_url: string | null
  source_outlet: string | null
  lat: number | null
  lon: number | null
  country_code: string | null
  city: string | null
  event_count: number
  category: string | null
  importance: number | null
  similarity: number
  breaking: boolean
  geo_precision: GeoPrecision | null
}

export interface SearchHit extends DotRecord {
  similarity: number
}

export async function searchClusters(
  query: string,
  opts: { hours?: number; limit?: number; minSimilarity?: number; signal?: AbortSignal } = {},
): Promise<SearchHit[]> {
  const res = await timedFetch(
    `${API_BASE}/search`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: opts.signal,
      body: JSON.stringify({
        query,
        hours: opts.hours ?? 48,
        limit: opts.limit ?? 30,
        min_similarity: opts.minSimilarity ?? 0.45,
      }),
    },
    // Search runs an embedding inference + pgvector scan — allow more headroom.
    15000,
  )
  if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}`)
  const results = (await res.json()) as ApiSearchResult[]
  const hits: SearchHit[] = []
  for (const r of results) {
    if (r.lat === null || r.lon === null) continue
    const category =
      r.category && isCategory(r.category) ? r.category : 'business'
    const sourceLabel =
      r.event_count > 1
        ? `${r.source_outlet ?? 'source'} · +${r.event_count - 1} more`
        : r.source_outlet ?? undefined
    hits.push({
      id: `cl:${r.cluster_id}`,
      lat: r.lat,
      lon: r.lon,
      title: r.title,
      summary: r.summary,
      imageUrl: r.image_url,
      url: r.url,
      sourceOutlet: sourceLabel,
      importance: r.importance ?? 0.5,
      category,
      breaking: r.breaking,
      eventCount: r.event_count,
      similarity: r.similarity,
      countryCode: r.country_code,
      city: r.city,
      geoPrecision: r.geo_precision,
    })
  }
  return hits
}

// --- Ask the globe -------------------------------------------------------- //

export interface AskResultItem {
  id: string | null
  title: string
  summary: string | null
  lat: number | null
  lon: number | null
  place: string | null
  sourceOutlet: string | null
  imageUrl: string | null
  countryCode: string | null
  city: string | null
}

export interface AskAnswer {
  answer: string
  place: string | null
  flyLat: number | null
  flyLon: number | null
  clusterRefs: string[]
  results: AskResultItem[]
  stats: Record<string, unknown>
  source: string // 'live' | 'cache' | 'prebaked' | 'degraded'
}

export async function askGlobe(
  question: string,
  opts: { lat?: number; lon?: number; signal?: AbortSignal } = {},
): Promise<AskAnswer> {
  const res = await timedFetch(
    `${API_BASE}/ask`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: opts.signal,
      body: JSON.stringify({
        question,
        lat: opts.lat ?? null,
        lon: opts.lon ?? null,
      }),
    },
    // /ask may run an embedding + a synthesis call on a cold cache.
    15000,
  )
  if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}`)
  interface ApiAskResult {
    id: string | null
    title: string
    summary: string | null
    lat: number | null
    lon: number | null
    place: string | null
    source_outlet: string | null
    image_url: string | null
    country_code: string | null
    city: string | null
  }
  const j = (await res.json()) as {
    answer: string
    place: string | null
    fly_lat: number | null
    fly_lon: number | null
    cluster_refs: string[]
    results: ApiAskResult[]
    stats: Record<string, unknown>
    source: string
  }
  return {
    answer: j.answer,
    place: j.place ?? null,
    flyLat: j.fly_lat ?? null,
    flyLon: j.fly_lon ?? null,
    clusterRefs: j.cluster_refs ?? [],
    results: (j.results ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      lat: r.lat,
      lon: r.lon,
      place: r.place,
      sourceOutlet: r.source_outlet,
      imageUrl: r.image_url,
      countryCode: r.country_code,
      city: r.city,
    })),
    stats: j.stats ?? {},
    source: j.source ?? 'live',
  }
}

// --- Share ----------------------------------------------------------------- //

export interface ShareCreated {
  id: string
  url: string
}

export async function createShare(payload: {
  kind: 'ask' | 'city' | 'cluster' | 'view'
  params?: Record<string, string>
  title?: string | null
  place?: string | null
  question?: string | null
  answer?: string | null
  flyLat?: number | null
  flyLon?: number | null
  stats?: Record<string, unknown>
}): Promise<ShareCreated> {
  const res = await timedFetch(`${API_BASE}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: payload.kind,
      params: payload.params ?? {},
      title: payload.title ?? null,
      place: payload.place ?? null,
      question: payload.question ?? null,
      answer: payload.answer ?? null,
      fly_lat: payload.flyLat ?? null,
      fly_lon: payload.flyLon ?? null,
      stats: payload.stats ?? {},
    }),
  })
  if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}`)
  const j = (await res.json()) as { id: string; url: string }
  return { id: j.id, url: j.url }
}

// Fetch a single cluster (for ?cluster=<id> deep-link hydration). Returns a
// DotRecord-shaped value or null if missing/stale.
export async function fetchCluster(
  id: string,
  signal?: AbortSignal,
): Promise<DotRecord | null> {
  try {
    const res = await timedFetch(`${API_BASE}/clusters/${id}`, { signal })
    if (!res.ok) return null
    const c = (await res.json()) as ApiCluster
    return clusterToDot(c)
  } catch {
    return null
  }
}

export async function fetchClusters(opts: {
  hours?: number
  minEvents?: number
  limit?: number
  tier?: SignificanceTier
  signal?: AbortSignal
} = {}): Promise<DotRecord[]> {
  const params = new URLSearchParams()
  if (opts.hours !== undefined) params.set('hours', String(opts.hours))
  if (opts.minEvents !== undefined) params.set('min_events', String(opts.minEvents))
  if (opts.limit !== undefined) params.set('limit', String(opts.limit))
  if (opts.tier !== undefined) params.set('tier', opts.tier)
  const url = `${API_BASE}/clusters?${params}`
  const res = await timedFetch(url, { signal: opts.signal })
  if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}`)
  const clusters = (await res.json()) as ApiCluster[]
  return clusters
    .map(clusterToDot)
    .filter((d): d is DotRecord => d !== null)
}

// --- Top-stories briefing -------------------------------------------------- //

interface ApiBriefingStory {
  cluster_id: string
  narration: string
  title: string
  summary: string | null
  url: string | null
  image_url: string | null
  source_outlet: string | null
  lat: number | null
  lon: number | null
  country_code: string | null
  city: string | null
  category: string | null
  occurred_at: string | null
}

interface ApiBriefing {
  intro: string
  stories: ApiBriefingStory[]
  outro: string
  source: string
}

// A briefing story = the spoken narration plus a DotRecord the briefing can
// fly to and push into the selection card (same shape clusters use elsewhere).
export interface BriefingStory {
  dot: DotRecord
  narration: string
}

export interface BriefingScript {
  intro: string
  stories: BriefingStory[]
  outro: string
  source: 'llm' | 'fallback'
}

// Fetch the server-narrated top-stories briefing. The server always returns a
// playable script (it degrades to cleaned-up text internally rather than
// erroring), so a thrown error here means the endpoint itself was unreachable.
export async function fetchBriefing(signal?: AbortSignal): Promise<BriefingScript> {
  // Allow longer than the default: the server may spend up to its LLM timeout
  // (~8s) synthesizing the script before responding.
  const res = await timedFetch(
    `${API_BASE}/briefing`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal },
    12000,
  )
  if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}`)
  const j = (await res.json()) as ApiBriefing
  const stories: BriefingStory[] = []
  for (const s of j.stories ?? []) {
    if (s.lat === null || s.lon === null) continue
    const category = s.category && isCategory(s.category) ? s.category : 'business'
    stories.push({
      narration: s.narration,
      dot: {
        id: `cl:${s.cluster_id}`,
        lat: s.lat,
        lon: s.lon,
        title: s.title,
        summary: s.summary,
        imageUrl: s.image_url,
        url: s.url,
        sourceOutlet: s.source_outlet ?? undefined,
        importance: 0.5,
        category,
        occurredAt: s.occurred_at,
        countryCode: s.country_code,
        city: s.city,
      },
    })
  }
  return {
    intro: j.intro ?? '',
    stories,
    outro: j.outro ?? '',
    source: j.source === 'llm' ? 'llm' : 'fallback',
  }
}

export async function apiHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await timedFetch(`${API_BASE}/health`, { signal }, 4000)
    return res.ok
  } catch {
    return false
  }
}

interface ApiMarket {
  symbol: string
  name: string
  city: string
  country_code: string | null
  lat: number
  lon: number
  price: number | null
  prev_close: number | null
  change_pct: number | null
  currency: string | null
  updated_at: string
}

export interface MarketSnapshot {
  symbol: string
  name: string
  city: string
  countryCode: string | null
  lat: number
  lon: number
  price: number | null
  prevClose: number | null
  changePct: number | null
  currency: string | null
  updatedAt: string
  isCurrency: boolean
}

export async function fetchMarkets(signal?: AbortSignal): Promise<MarketSnapshot[]> {
  const res = await timedFetch(`${API_BASE}/markets`, { signal })
  if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}`)
  const markets = (await res.json()) as ApiMarket[]
  return markets.map((m) => ({
    symbol: m.symbol,
    name: m.name,
    city: m.city,
    countryCode: m.country_code,
    lat: m.lat,
    lon: m.lon,
    price: m.price,
    prevClose: m.prev_close,
    changePct: m.change_pct,
    currency: m.currency,
    updatedAt: m.updated_at,
    isCurrency: m.symbol.startsWith('FX:'),
  }))
}
