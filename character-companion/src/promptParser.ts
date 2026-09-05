import type { CharacterState, OutfitId, PoseId, HairId, LightingId } from './types'

const COLOR_MAP: Record<string, string> = {
  red: '#c62828',
  blue: '#1565c0',
  black: '#111111',
  white: '#f5f5f5',
  pink: '#ec407a',
  green: '#2e7d32',
  purple: '#6a1b9a',
  yellow: '#f9a825',
  orange: '#ef6c00',
  gold: '#c9a227',
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/** Parse freeform prompt text into a partial character state update. */
export function parsePrompt(text: string, prev: CharacterState): Partial<CharacterState> {
  const t = text.toLowerCase().trim()
  if (!t) return {}

  const next: Partial<CharacterState> = {}

  // Outfit
  if (/\b(remove|take off|no)\b.*\b(clothes|clothing|outfit)\b|\bnude\b|\bundress|\bbare\b/.test(t)) {
    next.outfit = 'bare'
  } else if (/\b(bikini|swimsuit|swimwear)\b/.test(t)) {
    next.outfit = 'swimwear'
  } else if (/\b(thong|lingerie)\b/.test(t)) {
    next.outfit = 'thong'
    next.outfitColor = '#111111'
  } else if (/\b(dress|gown)\b/.test(t)) {
    next.outfit = 'dress'
  } else if (/\b(jeans|hoodie|casual|sweater)\b/.test(t)) {
    next.outfit = 'casual'
  } else if (/\b(athletic|sport|gym|leggings|workout)\b/.test(t)) {
    next.outfit = 'athletic'
  } else if (/\b(put on|wear|change into|clothes)\b/.test(t) && !next.outfit) {
    // generic "put on clothes" → casual
    if (/\bclothes\b/.test(t)) next.outfit = 'casual'
  }

  // Color for dress/casual/swimwear
  for (const [name, hex] of Object.entries(COLOR_MAP)) {
    if (new RegExp(`\\b${name}\\b`).test(t)) {
      next.outfitColor = hex
      if (!next.outfit && (prev.outfit === 'thong' || prev.outfit === 'bare')) {
        if (/\bdress\b/.test(t)) next.outfit = 'dress'
      }
      break
    }
  }

  // Pose
  if (/\b(lie|lying|lay down|lie down)\b/.test(t)) next.pose = 'lie'
  else if (/\b(sit up|sit|sitting)\b/.test(t)) next.pose = 'sit'
  else if (/\b(stand|standing|get up)\b/.test(t)) next.pose = 'stand'
  else if (/\b(wave|waving|hello|hi)\b/.test(t)) next.pose = 'wave'
  else if (/\b(turn around|turn|spin|face away)\b/.test(t)) next.pose = 'turn'

  // Hair
  if (/\b(wet hair|wet)\b/.test(t)) next.hair = 'wet'
  else if (/\b(ponytail|pony tail)\b/.test(t)) next.hair = 'ponytail'
  else if (/\bblonde\b/.test(t)) next.hair = 'blonde'

  // Lighting
  if (/\b(brighter|bright|daylight|well lit)\b/.test(t)) next.lighting = 'bright'
  else if (/\b(sunset|golden hour|dusk)\b/.test(t)) next.lighting = 'sunset'
  else if (/\b(intimate|lamp|dim|mood)\b/.test(t)) next.lighting = 'intimate'

  // Body shape
  let height = prev.height
  let muscle = prev.muscle
  let waist = prev.waist
  let shapeTouched = false

  if (/\b(taller|taller|height up|grow)\b/.test(t)) {
    height = clamp(height + 0.12, 0.85, 1.25)
    shapeTouched = true
  }
  if (/\b(shorter|smaller height)\b/.test(t)) {
    height = clamp(height - 0.12, 0.85, 1.25)
    shapeTouched = true
  }
  if (/\b(more muscular|muscular|buff|toned)\b/.test(t)) {
    muscle = clamp(muscle + 0.2, 0, 1)
    shapeTouched = true
  }
  if (/\b(less muscular|softer)\b/.test(t)) {
    muscle = clamp(muscle - 0.2, 0, 1)
    shapeTouched = true
  }
  if (/\b(slimmer waist|thin waist|smaller waist|slim)\b/.test(t)) {
    waist = clamp(waist - 0.15, 0.25, 1)
    shapeTouched = true
  }
  if (/\b(wider waist|thicker|curvier)\b/.test(t)) {
    waist = clamp(waist + 0.15, 0.25, 1)
    shapeTouched = true
  }
  if (/\b(reset (body|shape)|default (body|shape))\b/.test(t)) {
    height = 1
    muscle = 0.35
    waist = 0.55
    shapeTouched = true
  }

  if (shapeTouched) {
    next.height = height
    next.muscle = muscle
    next.waist = waist
  }

  return next
}

export function mergeState(prev: CharacterState, patch: Partial<CharacterState>): CharacterState {
  return { ...prev, ...patch }
}

export function describeState(s: CharacterState): string {
  const parts = [
    `outfit: ${s.outfit === 'dress' ? `${colorName(s.outfitColor)} dress` : labelOutfit(s.outfit)}`,
    `pose: ${labelPose(s.pose)}`,
    `hair: ${labelHair(s.hair)}`,
    `light: ${labelLight(s.lighting)}`,
  ]
  if (s.height !== 1 || s.muscle !== 0.35 || s.waist !== 0.55) {
    parts.push(`shape: h${s.height.toFixed(2)} m${s.muscle.toFixed(2)} w${s.waist.toFixed(2)}`)
  }
  return parts.join(' · ')
}

function labelOutfit(o: OutfitId) {
  const map: Record<OutfitId, string> = {
    thong: 'black thong',
    bare: 'undressed',
    dress: 'dress',
    casual: 'jeans & hoodie',
    athletic: 'athletic',
    swimwear: 'bikini',
  }
  return map[o]
}

function labelPose(p: PoseId) {
  const map: Record<PoseId, string> = {
    lie: 'lying',
    sit: 'sitting',
    stand: 'standing',
    wave: 'waving',
    turn: 'turned',
  }
  return map[p]
}

function labelHair(h: HairId) {
  const map: Record<HairId, string> = {
    wet: 'wet dark',
    ponytail: 'ponytail',
    blonde: 'blonde',
  }
  return map[h]
}

function labelLight(l: LightingId) {
  const map: Record<LightingId, string> = {
    intimate: 'warm lamp',
    bright: 'bright',
    sunset: 'sunset',
  }
  return map[l]
}

function colorName(hex: string) {
  const entry = Object.entries(COLOR_MAP).find(([, v]) => v.toLowerCase() === hex.toLowerCase())
  return entry?.[0] ?? hex
}
