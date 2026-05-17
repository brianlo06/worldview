import * as THREE from 'three'
import { CATEGORY_LOOKUP, DEFAULT_CATEGORY, type Category } from './categories'

export function colorFor(category: Category | undefined): THREE.Color {
  return new THREE.Color(CATEGORY_LOOKUP[category ?? DEFAULT_CATEGORY].color)
}
