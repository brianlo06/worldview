import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { DotRecord } from '../globe/dots'
import type { Category } from '../globe/categories'
import type { SignificanceTier } from '../globe/tiers'
import type { ApiAnomaly, MarketSnapshot } from '../api/client'

export interface SearchHit extends DotRecord {
  similarity: number
}

export type LayerId = 'news' | 'quake' | 'weather' | 'social'

export interface SelectedEntity {
  type: 'event' | 'cluster' | 'region'
  id: string
  title?: string
  summary?: string | null
  imageUrl?: string | null
  url?: string | null
  sourceOutlet?: string | null
  occurredAt?: string | null
  category?: string
  countryCode?: string | null
  city?: string | null
  geoPrecision?: 'point' | 'city' | 'state' | 'country' | null
  // Coordinates of the selected entity — used by the share card + deep link.
  lat?: number | null
  lon?: number | null
}

interface AppState {
  // Camera
  cameraTarget: { lat: number; lon: number; zoom: number } | null
  setCameraTarget: (t: AppState['cameraTarget']) => void

  // Layers
  activeLayers: Set<LayerId>
  toggleLayer: (l: LayerId) => void

  // Time
  timeMode: 'live' | 'historical'
  historicalRange: [Date, Date] | null
  setTimeMode: (m: 'live' | 'historical') => void

  // Selection
  selectedEntity: SelectedEntity | null
  setSelectedEntity: (e: SelectedEntity | null) => void

  // Category filters — empty set means everything is visible. Adding a
  // category to the set hides dots in that category from the globe.
  disabledCategories: Set<Category>
  toggleCategory: (c: Category) => void

  // Significance tier — filters globe by importance + cluster size thresholds.
  // 'notable' is the sensible default; cuts long-tail local-news noise.
  significanceTier: SignificanceTier
  setSignificanceTier: (t: SignificanceTier) => void

  // Layer mode — clusters (default) vs raw events
  layerMode: 'clusters' | 'events'
  setLayerMode: (m: 'clusters' | 'events') => void

  // Tour
  tourMode: boolean
  setTourMode: (b: boolean) => void

  // Auto-pulse: ambient breaking pulses on important dots
  autoPulse: boolean
  setAutoPulse: (b: boolean) => void

  // API / realtime status.
  // 'unknown' on first load so the offline UI doesn't flash before the
  // first fetch has had a chance to return.
  apiStatus: 'unknown' | 'connected' | 'offline'
  setApiStatus: (s: AppState['apiStatus']) => void
  eventCount: number
  setEventCount: (n: number) => void
  lastUpdated: number | null
  setLastUpdated: (t: number | null) => void

  // Full event/market dot list (shared between Globe and HUD trending panel)
  dots: DotRecord[]
  setDots: (d: DotRecord[]) => void

  // FlyTo action signal — Globe consumes and resets to null after applying.
  // distance overrides the camera's end-of-flight zoom; marker: false skips
  // the destination selection marker (camera-only moves like the briefing's
  // home reset).
  flyToTarget: {
    lat: number
    lon: number
    id?: string
    durationMs?: number
    distance?: number
    marker?: boolean
  } | null
  setFlyToTarget: (t: AppState['flyToTarget']) => void

  // Anomaly alerts — active region spikes
  anomalies: ApiAnomaly[]
  setAnomalies: (a: ApiAnomaly[]) => void

  // Globe highlight for the active briefing story — rendered as a sonar ring
  // on the anomaly-marker layer while JARVIS narrates it.
  briefingPin: { lat: number; lon: number } | null
  setBriefingPin: (p: AppState['briefingPin']) => void

  // Briefing constellation — arcs connecting the narrated story locations,
  // drawn on the globe during the outro.
  briefingArcs: { lat: number; lon: number }[] | null
  setBriefingArcs: (a: AppState['briefingArcs']) => void

  // True while the briefing overlay is mounted — other HUD surfaces (the
  // anomaly column, which the hologram would cover) step aside for it.
  briefingActive: boolean
  setBriefingActive: (b: boolean) => void

  // Market / currency snapshots — rendered in the right-side HUD panel,
  // not as dots on the globe
  markets: MarketSnapshot[]
  setMarkets: (m: MarketSnapshot[]) => void

  // Live camera telemetry for the HUD readout. Updated from the scene's
  // render loop at ~10 Hz to keep the React tree from re-rendering too hard.
  cameraTelemetry: {
    lat: number
    lon: number
    altitude: number
    azimuth: number
    fps: number
  } | null
  setCameraTelemetry: (t: AppState['cameraTelemetry']) => void

  // Semantic search state
  searchQuery: string
  setSearchQuery: (q: string) => void
  searchResults: SearchHit[] | null
  setSearchResults: (r: SearchHit[] | null) => void
  searchStatus: 'idle' | 'pending' | 'error'
  setSearchStatus: (s: AppState['searchStatus']) => void
  clearSearch: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
  cameraTarget: null,
  setCameraTarget: (t) => set({ cameraTarget: t }),

  activeLayers: new Set<LayerId>(['news']),
  toggleLayer: (l) =>
    set((s) => {
      const next = new Set(s.activeLayers)
      if (next.has(l)) next.delete(l)
      else next.add(l)
      return { activeLayers: next }
    }),

  timeMode: 'live',
  historicalRange: null,
  setTimeMode: (m) => set({ timeMode: m }),

  selectedEntity: null,
  setSelectedEntity: (e) => set({ selectedEntity: e }),

  disabledCategories: new Set<Category>(),
  toggleCategory: (c) =>
    set((s) => {
      const next = new Set(s.disabledCategories)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return { disabledCategories: next }
    }),

  significanceTier: 'major',
  setSignificanceTier: (t) => set({ significanceTier: t }),

  layerMode: 'clusters',
  setLayerMode: (m) => set({ layerMode: m }),

  // Default tour to ON for the first boot — JARVIS doesn't sit still.
  // Persisted via localStorage so user can opt out and the choice sticks.
  tourMode: true,
  setTourMode: (b) => set({ tourMode: b }),

  autoPulse: false,
  setAutoPulse: (b) => set({ autoPulse: b }),

  apiStatus: 'unknown',
  setApiStatus: (s) => set({ apiStatus: s }),
  eventCount: 0,
  setEventCount: (n) => set({ eventCount: n }),
  lastUpdated: null,
  setLastUpdated: (t) => set({ lastUpdated: t }),

  dots: [],
  setDots: (d) => set({ dots: d }),

  flyToTarget: null,
  setFlyToTarget: (t) => set({ flyToTarget: t }),

  anomalies: [],
  setAnomalies: (a) => set({ anomalies: a }),

  briefingPin: null,
  setBriefingPin: (p) => set({ briefingPin: p }),

  briefingArcs: null,
  setBriefingArcs: (a) => set({ briefingArcs: a }),

  briefingActive: false,
  setBriefingActive: (b) => set({ briefingActive: b }),

  markets: [],
  setMarkets: (m) => set({ markets: m }),

  cameraTelemetry: null,
  setCameraTelemetry: (t) => set({ cameraTelemetry: t }),

      searchQuery: '',
      setSearchQuery: (q) => set({ searchQuery: q }),
      searchResults: null,
      setSearchResults: (r) => set({ searchResults: r }),
      searchStatus: 'idle',
      setSearchStatus: (s) => set({ searchStatus: s }),
      clearSearch: () =>
        set({ searchQuery: '', searchResults: null, searchStatus: 'idle' }),
    }),
    {
      // Persist only the UI preferences the user might want to keep across
      // reloads. Live data (dots, anomalies, search results, selection) is
      // always re-fetched / re-derived from a fresh load.
      name: 'worldview:ui',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        disabledCategories: Array.from(state.disabledCategories),
        layerMode: state.layerMode,
        tourMode: state.tourMode,
        autoPulse: state.autoPulse,
        significanceTier: state.significanceTier,
      }),
      // Custom merge so the persisted Array<Category> re-hydrates as Set<Category>
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') return current
        const p = persisted as {
          disabledCategories?: Category[]
          layerMode?: 'clusters' | 'events'
          tourMode?: boolean
          autoPulse?: boolean
          significanceTier?: SignificanceTier
        }
        return {
          ...current,
          disabledCategories: new Set<Category>(p.disabledCategories ?? []),
          layerMode: p.layerMode ?? current.layerMode,
          tourMode: p.tourMode ?? current.tourMode,
          autoPulse: p.autoPulse ?? current.autoPulse,
          significanceTier: p.significanceTier ?? current.significanceTier,
        }
      },
    },
  ),
)
