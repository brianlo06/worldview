// No Three import here on purpose: this file is consumed by the HUD/store
// (non-3D code), so importing Three would drag the whole 600 KB three.js
// bundle into the main chunk. Color-to-THREE.Color lives in colorFor.ts.
export type Category =
  | 'breaking'
  | 'politics'
  | 'conflict'
  | 'business'
  | 'weather'
  | 'quake'
  | 'social'
  | 'markets'

export interface CategoryDef {
  id: Category
  label: string
  color: string
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'breaking', label: 'Breaking', color: '#ff5a4a' },
  { id: 'politics', label: 'Politics', color: '#ffd166' },
  { id: 'conflict', label: 'Conflict', color: '#ff8e5a' },
  { id: 'business', label: 'Business', color: '#7ee5a3' },
  { id: 'weather', label: 'Weather', color: '#7fb8ff' },
  { id: 'quake', label: 'Quake', color: '#c79bff' },
  { id: 'social', label: 'Social', color: '#9eecff' },
  // 'markets' kept in the Category union for backwards-compat (old persisted
  // disabledCategories sets may include it) but no longer surfaced in the legend
  // — markets render in their own HUD panel, not as dots on the globe.
]

export const CATEGORY_LOOKUP: Record<Category, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<Category, CategoryDef>

export const DEFAULT_CATEGORY: Category = 'business'
