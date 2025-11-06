/**
 * Enhanced crafting system with ilvl, mod probabilities, and crafting chains
 */

export interface ModTier {
  tier: number; // T1, T2, etc (1 is highest)
  ilvlRequired: number;
  modName: string;
  modValue: string; // e.g., "80-89 maximum life"
  weight: number; // Higher = more common
  tags: string[]; // e.g., ["life", "defence"]
}

export interface ModPool {
  prefix: ModTier[];
  suffix: ModTier[];
}

export interface ItemBase {
  name: string;
  baseType: string; // e.g., "Body Armour", "Ring", "Weapon"
  ilvl: number;
  influenceType?: 'shaper' | 'elder' | 'crusader' | 'redeemer' | 'hunter' | 'warlord' | 'none';
  implicitMods?: string[];
}

export interface TargetMod {
  modName: string;
  tier: number; // Desired tier (T1, T2, etc)
  type: 'prefix' | 'suffix';
  isRequired: boolean; // Must have vs nice to have
  ilvlRequired: number;
  weight: number; // From mod pool
}

export interface CraftingStepResult {
  stepNumber: number;
  methodName: string;
  description: string;
  cost: number;
  successRate: number; // 0-1
  expectedAttempts: number;
  explanation: string; // Educational explanation of why this step
}

export interface CraftingChain {
  name: string;
  description: string;
  steps: CraftingStepDefinition[];
  totalCost: number;
  totalSuccessRate: number; // Compound probability
  educationalNotes: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface CraftingStepDefinition {
  stepNumber: number;
  method: CraftingMethodType;
  itemState: 'white' | 'magic' | 'rare'; // State before this step
  targetMods: TargetMod[];
  materials: CraftingMaterial[];
  expectedAttempts: number;
  explanation: string;
  tips?: string[];
  // Advanced options
  prefixBlock?: boolean; // Using metacraft to block prefixes
  suffixBlock?: boolean; // Using metacraft to block suffixes
  fossilMods?: string[]; // Which fossils to use
  harvestCraft?: string; // Specific harvest craft
}

export enum CraftingMethodType {
  // Basic methods
  ALT_SPAM = 'alt_spam',
  REGAL = 'regal',
  CHAOS_SPAM = 'chaos_spam',
  SCOUR = 'scour',

  // Advanced currency
  ESSENCE = 'essence',
  FOSSIL = 'fossil',
  VEILED_CHAOS = 'veiled_chaos',
  EXALT = 'exalted_orb',
  ANNUL = 'annulment',

  // Harvest
  HARVEST_REFORGE = 'harvest_reforge',
  HARVEST_AUGMENT = 'harvest_augment',
  HARVEST_REMOVE = 'harvest_remove',
  HARVEST_REFORGE_MORE_LIKELY = 'harvest_reforge_more',

  // Special methods
  RECOMBINATOR = 'recombinator',
  AISLING = 'aisling',
  ELDRITCH_CHAOS = 'eldritch_chaos',
  ELDRITCH_EXALT = 'eldritch_exalt',
  ELDRITCH_ANNUL = 'eldritch_annul',

  // Crafting bench
  BENCHCRAFT = 'benchcraft',
  MULTIMOD = 'multimod',
  CANNOT_ROLL_ATTACK = 'cannot_roll_attack',
  CANNOT_ROLL_CASTER = 'cannot_roll_caster',
  PREFIXES_CANNOT_CHANGE = 'prefixes_cannot_change',
  SUFFIXES_CANNOT_CHANGE = 'suffixes_cannot_change',
}

export interface CraftingMaterial {
  name: string;
  quantity: number;
  chaosValue?: number;
  category?: string;
}

export interface ProbabilityCalculation {
  targetMods: TargetMod[];
  ilvl: number;
  method: CraftingMethodType;
  successRate: number; // 0-1
  averageAttempts: number;
  modPoolSize: {
    availablePrefixes: number;
    availableSuffixes: number;
    targetPrefixes: number;
    targetSuffixes: number;
  };
  explanation: string;
}

export interface AdvancedTactic {
  name: string;
  description: string;
  whenToUse: string;
  steps: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  estimatedCost: {
    min: number;
    max: number;
    average: number;
  };
  examples: string[];
}

// Common mod pools (simplified - in production would fetch from API or database)
export const COMMON_MOD_POOLS: Record<string, ModTier[]> = {
  life_prefix: [
    { tier: 1, ilvlRequired: 86, modName: 'Rapturous', modValue: '100-109 to maximum Life', weight: 100, tags: ['life'] },
    { tier: 2, ilvlRequired: 81, modName: 'Fecund', modValue: '90-99 to maximum Life', weight: 200, tags: ['life'] },
    { tier: 3, ilvlRequired: 73, modName: 'Athlete\'s', modValue: '80-89 to maximum Life', weight: 300, tags: ['life'] },
    { tier: 4, ilvlRequired: 64, modName: 'Vigorous', modValue: '70-79 to maximum Life', weight: 400, tags: ['life'] },
    { tier: 5, ilvlRequired: 54, modName: 'Sanguine', modValue: '60-69 to maximum Life', weight: 500, tags: ['life'] },
  ],
  resistance_suffix: [
    { tier: 1, ilvlRequired: 84, modName: 'of the Kalandra', modValue: '46-48% to Fire/Cold/Lightning Resistance', weight: 100, tags: ['resistance'] },
    { tier: 2, ilvlRequired: 72, modName: 'of the Rainbow', modValue: '42-45% to Fire/Cold/Lightning Resistance', weight: 200, tags: ['resistance'] },
    { tier: 3, ilvlRequired: 60, modName: 'of the Vivid', modValue: '36-41% to Fire/Cold/Lightning Resistance', weight: 300, tags: ['resistance'] },
  ],
};

// Pre-defined crafting chains
export const CRAFTING_CHAIN_TEMPLATES: Record<string, Omit<CraftingChain, 'totalCost' | 'totalSuccessRate'>> = {
  alt_regal_annul: {
    name: 'Alt-Regal-Annul',
    description: 'Spam alts for desired mod, regal for second mod, annul unwanted mods',
    difficulty: 'intermediate',
    educationalNotes: [
      'Alt spam is best for targeting 1-2 specific mods on magic items',
      'Regal adds a random mod - you might need to annul afterwards',
      'This method works well when you need specific prefix or suffix',
      'Consider blocking unwanted mods with crafting bench before regal',
    ],
    steps: [],
  },
  alt_regal_multimod: {
    name: 'Alt-Regal-Multimod',
    description: 'Alt for one mod, regal, then use multimod to craft the rest',
    difficulty: 'beginner',
    educationalNotes: [
      'Multimod costs 2 divine orbs and allows crafting multiple mods',
      'Best when one mod is hard to roll but others can be crafted',
      'Leaves you with at least 3 open mod slots after multimod',
      'Benchcrafted mods are usually weaker than natural rolls',
    ],
    steps: [],
  },
  fossil_spam: {
    name: 'Fossil Spam',
    description: 'Use fossils to weight certain mod types',
    difficulty: 'beginner',
    educationalNotes: [
      'Fossils modify the mod pool - some mods become more likely',
      'Multiple fossils can stack their effects',
      'Pristine = more life, Serrated = more physical damage, etc.',
      'Check which fossils block unwanted mod types',
    ],
    steps: [],
  },
  essence_spam: {
    name: 'Essence Spam',
    description: 'Use essences to guarantee one specific mod',
    difficulty: 'beginner',
    educationalNotes: [
      'Essences guarantee one mod at a fixed tier',
      'Deafening essences give T1-equivalent mods',
      'Good for getting one important mod cheaply',
      'Can essence spam until you hit other desired mods',
    ],
    steps: [],
  },
  harvest_reforge: {
    name: 'Harvest Reforge',
    description: 'Use harvest crafts to reforge with specific mod types',
    difficulty: 'intermediate',
    educationalNotes: [
      'Harvest reforges guarantee mods with specific tags',
      '"More likely" variants increase chances of better tiers',
      'Life reforge on body armour is very strong',
      'Can be expensive - calculate expected attempts',
    ],
    steps: [],
  },
  alt_regal_recombinator: {
    name: 'Alt-Regal-Recombinator',
    description: 'Alt spam two bases, then recombine them',
    difficulty: 'advanced',
    educationalNotes: [
      'Recombinators can combine mods from two items',
      'Alt spam desired mods on two separate bases',
      'Recombinator has 50% chance to keep each mod',
      'Can result in items with 2 T1 mods that are hard to hit together',
      'Good for expensive bases - can use cheaper bases to recombine',
    ],
    steps: [],
  },
  eldritch_crafting: {
    name: 'Eldritch Crafting',
    description: 'Use Eldritch currency on influenced items',
    difficulty: 'advanced',
    educationalNotes: [
      'Eldritch currency only works on Searing Exarch/Eater of Worlds items',
      'Eldritch Chaos rerolls without affecting influenced mods',
      'Eldritch Exalt adds mod without affecting influenced mods',
      'Eldritch Annul removes mod without affecting influenced mods',
      'Allows you to safely modify items with expensive influenced mods',
    ],
    steps: [],
  },
  metacraft_exalt: {
    name: 'Metacraft-Exalt',
    description: 'Use metacrafts to block unwanted mods, then exalt slam',
    difficulty: 'expert',
    educationalNotes: [
      'Prefixes/Suffixes Cannot Be Changed costs 2 divine orbs',
      'Allows you to safely exalt without hitting unwanted mod types',
      'Example: If item has 3 good prefixes, use "Suffixes Cannot Be Changed" then scour (removes prefixes only)',
      'Very expensive but gives deterministic results',
      'Calculate if the cost is worth it vs other methods',
    ],
    steps: [],
  },
};

export interface CraftingEducation {
  concept: string;
  explanation: string;
  examples: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export const CRAFTING_CONCEPTS: CraftingEducation[] = [
  {
    concept: 'Item Level (ilvl)',
    explanation: 'Item level determines which tier mods can roll. Higher ilvl = access to higher tier (better) mods. T1 life requires ilvl 86, while T3 life only needs ilvl 73.',
    examples: [
      'ilvl 86 body armour can roll T1 life (100-109)',
      'ilvl 73 body armour can only roll up to T3 life (80-89)',
      'Always check required ilvl for your target mods!',
    ],
    difficulty: 'beginner',
  },
  {
    concept: 'Mod Weighting',
    explanation: 'Each mod has a weight that determines how likely it is to roll. Lower weight = rarer mod. T1 mods usually have lower weight (100-200) than T3+ mods (300-500).',
    examples: [
      'T1 life has weight 100, T3 life has weight 300',
      'If you alt spam for T1 life, expect 3x more attempts than for T3',
      'Fossils can modify weights to make mods more or less common',
    ],
    difficulty: 'intermediate',
  },
  {
    concept: 'Prefix vs Suffix',
    explanation: 'Mods are divided into prefixes and suffixes. An item can have max 3 prefixes and 3 suffixes. Life, damage, and ES are usually prefixes. Resistances and attributes are usually suffixes.',
    examples: [
      'Life = prefix, Fire Resistance = suffix',
      'Magic items have 1-2 mods total (1 prefix and/or 1 suffix)',
      'Rare items can have up to 6 mods (3 prefix + 3 suffix)',
    ],
    difficulty: 'beginner',
  },
  {
    concept: 'Blocking Mods',
    explanation: 'You can use the crafting bench to "block" certain mods, preventing them from rolling. Useful when slamming exalts or using harvest crafts.',
    examples: [
      'Craft life on an item before harvest reforge life = blocks low tier life from rolling',
      'This forces the harvest craft to either remove the crafted mod or add a better life roll',
      'Metacrafts like "Cannot Roll Attack Mods" block entire categories',
    ],
    difficulty: 'advanced',
  },
  {
    concept: 'Crafting Chains',
    explanation: 'Multi-step processes where you prepare an item through several stages. Each step has a purpose and builds toward the final result.',
    examples: [
      'Alt spam → Regal → Annul → Multimod',
      'Essence spam → Harvest reforge → Exalt slam',
      'Alt spam on two bases → Recombinator',
    ],
    difficulty: 'intermediate',
  },
];
