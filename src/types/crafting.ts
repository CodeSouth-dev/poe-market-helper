// Type definitions for crafting data from RePoE

export interface ModWeight {
  tag: string;
  weight: number;
}

export interface Fossil {
  name: string;
  added_mods: string[];
  allowed_tags: string[];
  forbidden_tags: string[];
  forced_mods: string[];
  positive_mod_weights: ModWeight[];
  negative_mod_weights: ModWeight[];
  blocked_descriptions: string[];
  descriptions: string[];
  corrupted_essence_chance: number;
  rolls_lucky: boolean;
  rolls_white_sockets: boolean;
}

export interface Essence {
  name: string;
  level: number;
  item_level_restriction: number | null;
  spawn_level_min: number;
  spawn_level_max: number;
  mods: Record<string, string>; // item_class -> mod_id
  type: {
    tier: number;
    is_corruption_only: boolean;
  };
}

export interface ModSpawnWeight {
  tag: string;
  weight: number;
}

export interface ModStat {
  id: string;
  min: number;
  max: number;
}

export interface Mod {
  name: string;
  domain: string;
  generation_type: string;
  required_level: number;
  type: string; // "prefix" | "suffix"
  spawn_weights: ModSpawnWeight[];
  adds_tags: string[];
  stats: ModStat[];
  is_essence_only?: boolean;
}

export interface BaseItem {
  name: string;
  item_class: string;
  tags: string[];
  domain: string;
  release_state: string;
  drop_enabled: boolean;
  required_level?: number;
  implicits?: string[];
}

export interface CraftingBenchOption {
  id: string;
  name: string;
  item_classes: string[];
  mod_id: string;
  cost: Array<{
    name: string;
    amount: number;
  }>;
  required_level: number;
  is_suffix?: boolean;
  is_prefix?: boolean;
}

// Crafting calculation types

export interface DesiredMod {
  name: string;
  type: 'prefix' | 'suffix';
  tier?: number; // optional tier requirement
  weight?: number; // importance weight for optimization
}

export interface CraftingMethod {
  method: 'chaos' | 'fossil' | 'essence' | 'alteration' | 'bench' | 'harvest' | 'veiled';
  name: string;
  description: string;
  probability: number; // chance to hit desired mods
  averageCost: number; // in chaos orbs
  currencyUsed: Record<string, number>; // currency_name -> average_amount
  steps: string[]; // step-by-step instructions
  expectedAttempts: number;
}

export interface FossilCombination {
  fossils: string[]; // fossil names
  resonator: string; // resonator type (1-socket, 2-socket, etc.)
  probability: number;
  averageCost: number;
}

export interface BaseRecommendation {
  baseType: string; // "normal", "rare", "unique", "fractured", "influenced"
  itemName: string;
  reason: string;
  averageCost: number; // cost to purchase
  savings?: number; // savings vs crafting from scratch
  searchQuery?: string; // for poe.ninja or trade site
}

export interface CraftingResult {
  desiredMods: DesiredMod[];
  baseItem: string;
  itemClass: string;
  league: string;
  methods: CraftingMethod[];
  bestMethod: CraftingMethod;
  baseRecommendation: BaseRecommendation;
  alternativeBases?: BaseRecommendation[];
  warnings?: string[];
  totalCostChaos: number;
  totalCostDivine?: number;
  preferredCurrency: 'chaos' | 'divine';
}

export interface CurrencyPrice {
  name: string;
  chaosValue: number;
  divineValue?: number;
  count?: number;
  listingCount?: number;
}

// UI display types

export interface CraftingStep {
  stepNumber: number;
  action: string;
  cost: string;
  probability?: string;
}

export interface CraftingMethodDisplay {
  method: string;
  totalCost: string;
  successRate: string;
  steps: CraftingStep[];
  isRecommended: boolean;
}
