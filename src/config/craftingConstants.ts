/**
 * Crafting System Constants
 * Centralized configuration for all crafting-related magic numbers
 */

/**
 * Item mod limits based on rarity
 */
export const MOD_LIMITS = {
  MAGIC: {
    MAX_PREFIXES: 1,
    MAX_SUFFIXES: 1,
  },
  RARE: {
    MAX_PREFIXES: 3,
    MAX_SUFFIXES: 3,
  },
} as const;

/**
 * Fossil crafting constants
 */
export const FOSSIL_OPTIMIZATION = {
  BASE_SUCCESS_RATE: 0.01, // 1% base chance
  SUCCESS_RATE_MULTIPLIER: 2, // Doubles for each matching tag
  MAX_SUCCESS_RATE: 0.15, // 15% cap
  MAX_COMBINATIONS: 3, // Maximum fossils to combine
} as const;

/**
 * Currency and material base costs (in chaos)
 * These are fallback values when poe.ninja API is unavailable
 */
export const CURRENCY_COSTS = {
  CHAOS_ORB: 1,
  DIVINE_ORB: 200,
  EXALTED_ORB: 150,
  ORB_OF_ALTERATION: 0.1,
  ORB_OF_AUGMENTATION: 0.05,
  ORB_OF_REGRET: 0.5,
  ORB_OF_SCOURING: 0.5,
  VEILED_CHAOS_ORB: 15,
  ORB_OF_ANNULMENT: 20,
  ETERNAL_ORB: 5000,
} as const;

/**
 * Resonator base costs (in chaos)
 */
export const RESONATOR_COSTS = {
  PRIMITIVE_CHAOTIC_RESONATOR: 1, // 1 socket
  POTENT_CHAOTIC_RESONATOR: 2, // 2 sockets
  POWERFUL_CHAOTIC_RESONATOR: 4, // 3 sockets
  PRIME_CHAOTIC_RESONATOR: 8, // 4 sockets
} as const;

/**
 * Harvest craft base costs (in chaos)
 */
export const HARVEST_COSTS = {
  REFORGE_COMMON: 5,
  REFORGE_UNCOMMON: 10,
  REFORGE_RARE: 20,
  REFORGE_MORE_LIKELY: 30,
  AUGMENT: 50,
  REMOVE_ADD: 100,
} as const;

/**
 * Beastcrafting base costs (in chaos)
 */
export const BEAST_COSTS = {
  IMPRINT: 50,
  ASPECT: 30,
  SPLIT: 100,
  CORRUPT: 20,
} as const;

/**
 * Recombinator constants
 */
export const RECOMBINATOR_COSTS = {
  BASE_COST: 50, // Base recombinator cost
  SUCCESS_RATE: 0.5, // 50% success rate estimate
  EXPECTED_ATTEMPTS: 2, // 1 / SUCCESS_RATE
} as const;

/**
 * Multi-mod crafting bench costs
 */
export const CRAFTING_BENCH_COSTS = {
  CAN_HAVE_MULTIPLE_CRAFTED_MODIFIERS: 2,
  PREFIXES_CANNOT_BE_CHANGED: 2,
  SUFFIXES_CANNOT_BE_CHANGED: 2,
  CANNOT_ROLL_ATTACK_MODS: 1,
  CANNOT_ROLL_CASTER_MODS: 1,
} as const;

/**
 * Web scraper rate limiting configuration
 */
export const SCRAPER_RATE_LIMITS = {
  MAX_REQUESTS_PER_WINDOW: 5,
  WINDOW_MS: 60000, // 1 minute
  MIN_DELAY_MS: 3000, // 3 seconds between requests
} as const;

/**
 * Cache duration settings (in milliseconds)
 */
export const CACHE_DURATIONS = {
  CURRENCY_PRICES: 5 * 60 * 1000, // 5 minutes
  FOSSIL_DATA: 24 * 60 * 60 * 1000, // 24 hours
  CRAFTING_GUIDES: 7 * 24 * 60 * 60 * 1000, // 7 days
  REPOE_DATA: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

/**
 * Probability calculation constants
 */
export const PROBABILITY_CALCULATION = {
  MIN_MOD_POOL_SIZE: 1,
  DEFAULT_MOD_WEIGHT: 100,
  WEIGHT_MULTIPLIER_MORE: 10, // Fossil "more" tag multiplier
  WEIGHT_MULTIPLIER_LESS: 0.1, // Fossil "less" tag multiplier
} as const;

/**
 * Item level (ilvl) constraints
 */
export const ILVL_CONSTRAINTS = {
  MIN: 1,
  MAX: 86,
  COMMON_THRESHOLDS: {
    T1_MODS: 86,
    T2_MODS: 81,
    EARLY_GAME: 68,
  },
} as const;

/**
 * Crafting method scoring weights
 * Rebalanced to prioritize both cost efficiency AND success probability
 */
export const METHOD_SCORING_WEIGHTS = {
  BUDGET_ALIGNMENT: 0.25,        // 25% - Cost per attempt matters
  SUCCESS_RATE: 0.35,            // 35% - High success rate is CRITICAL
  EXPECTED_COST_EFFICIENCY: 0.2, // 20% - Real cost = cost / successRate
  DIFFICULTY_FIT: 0.1,           // 10% - User skill level consideration
  SOURCE_CREDIBILITY: 0.05,      // 5%  - Trust in data source
  MOD_TARGETING: 0.05,           // 5%  - Method targets desired mods
} as const;

/**
 * Difficulty scoring modifiers
 */
export const DIFFICULTY_SCORES = {
  BEGINNER: 10,
  INTERMEDIATE: 0,
  ADVANCED: -10,
  EXPERT: -20,
} as const;

/**
 * Source credibility scores
 */
export const SOURCE_SCORES = {
  POHX: 15,
  MAXROLL: 10,
  BUILT_IN: 5,
} as const;

/**
 * Budget tier thresholds (in chaos)
 */
export const BUDGET_TIERS = {
  LOW: 500,
  MEDIUM: 2000,
  HIGH: 10000,
} as const;
