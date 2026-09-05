export type OutfitId =
  | 'thong'
  | 'bare'
  | 'dress'
  | 'casual'
  | 'athletic'
  | 'swimwear'

export type PoseId = 'lie' | 'sit' | 'stand' | 'wave' | 'turn'

export type HairId = 'wet' | 'ponytail' | 'blonde'

export type LightingId = 'intimate' | 'bright' | 'sunset'

export interface CharacterState {
  outfit: OutfitId
  outfitColor: string
  pose: PoseId
  hair: HairId
  lighting: LightingId
  height: number
  muscle: number
  waist: number
}

export const DEFAULT_STATE: CharacterState = {
  outfit: 'thong',
  outfitColor: '#111111',
  pose: 'lie',
  hair: 'wet',
  lighting: 'intimate',
  height: 1,
  muscle: 0.35,
  waist: 0.55,
}

export const OUTFIT_LABELS: Record<OutfitId, string> = {
  thong: 'black thong',
  bare: 'undressed',
  dress: 'dress',
  casual: 'jeans & hoodie',
  athletic: 'athletic wear',
  swimwear: 'bikini',
}

export const POSE_LABELS: Record<PoseId, string> = {
  lie: 'lying down',
  sit: 'sitting',
  stand: 'standing',
  wave: 'waving',
  turn: 'turned around',
}

export const HAIR_LABELS: Record<HairId, string> = {
  wet: 'wet dark hair',
  ponytail: 'ponytail',
  blonde: 'blonde',
}

export const LIGHTING_LABELS: Record<LightingId, string> = {
  intimate: 'warm lamp',
  bright: 'brighter',
  sunset: 'sunset',
}
