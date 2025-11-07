/**
 * Shared Probability Calculator
 * Unified probability calculations for all crafting methods
 */

import { DesiredMod, Mod } from '../types/crafting';
import { TargetMod, ModTier } from '../types/craftingEnhanced';
import {
  MOD_LIMITS,
  PROBABILITY_CALCULATION,
  FOSSIL_OPTIMIZATION,
} from '../config/craftingConstants';

export interface ProbabilityResult {
  successRate: number;
  expectedAttempts: number;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
}

export interface ModPoolInfo {
  totalPrefixes: number;
  totalSuffixes: number;
  matchingPrefixes: number;
  matchingSuffixes: number;
  prefixWeight: number;
  suffixWeight: number;
  totalPrefixWeight: number;
  totalSuffixWeight: number;
}

/**
 * Calculate probability of hitting desired mods with simple mod pool
 * Used for chaos spam, alteration spam, etc.
 */
export function calculateSimpleModProbability(
  desiredMods: DesiredMod[],
  availableMods: Mod[],
  itemTags: string[],
  magicItem: boolean = false
): ProbabilityResult {
  const prefixes = desiredMods.filter(m => m.type === 'prefix');
  const suffixes = desiredMods.filter(m => m.type === 'suffix');

  const availablePrefixes = availableMods.filter(m => m.type === 'prefix');
  const availableSuffixes = availableMods.filter(m => m.type === 'suffix');

  if (availablePrefixes.length === 0 && prefixes.length > 0) {
    return {
      successRate: 0,
      expectedAttempts: Infinity,
      confidence: 'high',
      explanation: 'No prefixes available in mod pool',
    };
  }

  if (availableSuffixes.length === 0 && suffixes.length > 0) {
    return {
      successRate: 0,
      expectedAttempts: Infinity,
      confidence: 'high',
      explanation: 'No suffixes available in mod pool',
    };
  }

  // Check mod limits based on item rarity
  const maxPrefixes = magicItem ? MOD_LIMITS.MAGIC.MAX_PREFIXES : MOD_LIMITS.RARE.MAX_PREFIXES;
  const maxSuffixes = magicItem ? MOD_LIMITS.MAGIC.MAX_SUFFIXES : MOD_LIMITS.RARE.MAX_SUFFIXES;

  if (prefixes.length > maxPrefixes || suffixes.length > maxSuffixes) {
    return {
      successRate: 0,
      expectedAttempts: Infinity,
      confidence: 'high',
      explanation: `Too many mods requested: ${prefixes.length} prefixes (max ${maxPrefixes}), ${suffixes.length} suffixes (max ${maxSuffixes})`,
    };
  }

  // Calculate probability for each mod
  let probability = 1;
  let explanation = '';

  for (const prefix of prefixes) {
    const matchingMods = availablePrefixes.filter(m =>
      m.name.toLowerCase().includes(prefix.name.toLowerCase())
    );

    if (matchingMods.length === 0) {
      return {
        successRate: 0,
        expectedAttempts: Infinity,
        confidence: 'high',
        explanation: `Prefix "${prefix.name}" not found in available mod pool`,
      };
    }

    const modProbability = matchingMods.length / availablePrefixes.length;
    probability *= modProbability;
    explanation += `Prefix "${prefix.name}": ${matchingMods.length}/${availablePrefixes.length} = ${(modProbability * 100).toFixed(2)}%. `;
  }

  for (const suffix of suffixes) {
    const matchingMods = availableSuffixes.filter(m =>
      m.name.toLowerCase().includes(suffix.name.toLowerCase())
    );

    if (matchingMods.length === 0) {
      return {
        successRate: 0,
        expectedAttempts: Infinity,
        confidence: 'high',
        explanation: `Suffix "${suffix.name}" not found in available mod pool`,
      };
    }

    const modProbability = matchingMods.length / availableSuffixes.length;
    probability *= modProbability;
    explanation += `Suffix "${suffix.name}": ${matchingMods.length}/${availableSuffixes.length} = ${(modProbability * 100).toFixed(2)}%. `;
  }

  const expectedAttempts = probability > 0 ? Math.ceil(1 / probability) : Infinity;
  explanation += `Overall: ${(probability * 100).toFixed(4)}% per attempt, ~${expectedAttempts} expected attempts.`;

  return {
    successRate: probability,
    expectedAttempts,
    confidence: probability > 0.01 ? 'high' : probability > 0.001 ? 'medium' : 'low',
    explanation,
  };
}

/**
 * Calculate probability with weighted mod pools
 * More accurate calculation considering mod spawn weights
 */
export function calculateWeightedModProbability(
  desiredMods: DesiredMod[],
  availableMods: Mod[],
  itemTags: string[]
): ProbabilityResult {
  const prefixes = desiredMods.filter(m => m.type === 'prefix');
  const suffixes = desiredMods.filter(m => m.type === 'suffix');

  const availablePrefixes = availableMods.filter(m => m.type === 'prefix');
  const availableSuffixes = availableMods.filter(m => m.type === 'suffix');

  // Calculate total weights for each pool
  const totalPrefixWeight = availablePrefixes.reduce((sum, mod) => {
    const weight = getModWeight(mod, itemTags);
    return sum + weight;
  }, 0);

  const totalSuffixWeight = availableSuffixes.reduce((sum, mod) => {
    const weight = getModWeight(mod, itemTags);
    return sum + weight;
  }, 0);

  let probability = 1;
  let explanation = '';

  // Calculate prefix probabilities
  for (const prefix of prefixes) {
    const matchingMods = availablePrefixes.filter(m =>
      m.name.toLowerCase().includes(prefix.name.toLowerCase())
    );

    if (matchingMods.length === 0) {
      return {
        successRate: 0,
        expectedAttempts: Infinity,
        confidence: 'high',
        explanation: `Prefix "${prefix.name}" not found in available mod pool`,
      };
    }

    const matchingWeight = matchingMods.reduce((sum, mod) => {
      return sum + getModWeight(mod, itemTags);
    }, 0);

    const modProbability = totalPrefixWeight > 0 ? matchingWeight / totalPrefixWeight : 0;
    probability *= modProbability;
    explanation += `Prefix "${prefix.name}": weight ${matchingWeight}/${totalPrefixWeight} = ${(modProbability * 100).toFixed(2)}%. `;
  }

  // Calculate suffix probabilities
  for (const suffix of suffixes) {
    const matchingMods = availableSuffixes.filter(m =>
      m.name.toLowerCase().includes(suffix.name.toLowerCase())
    );

    if (matchingMods.length === 0) {
      return {
        successRate: 0,
        expectedAttempts: Infinity,
        confidence: 'high',
        explanation: `Suffix "${suffix.name}" not found in available mod pool`,
      };
    }

    const matchingWeight = matchingMods.reduce((sum, mod) => {
      return sum + getModWeight(mod, itemTags);
    }, 0);

    const modProbability = totalSuffixWeight > 0 ? matchingWeight / totalSuffixWeight : 0;
    probability *= modProbability;
    explanation += `Suffix "${suffix.name}": weight ${matchingWeight}/${totalSuffixWeight} = ${(modProbability * 100).toFixed(2)}%. `;
  }

  const expectedAttempts = probability > 0 ? Math.ceil(1 / probability) : Infinity;
  explanation += `Overall: ${(probability * 100).toFixed(4)}% per attempt, ~${expectedAttempts} expected attempts.`;

  return {
    successRate: probability,
    expectedAttempts,
    confidence: probability > 0.01 ? 'high' : probability > 0.001 ? 'medium' : 'low',
    explanation,
  };
}

/**
 * Calculate probability for ilvl-aware mod pools
 * Used by enhanced crafting calculator
 */
export function calculateIlvlAwareModProbability(
  targetMods: TargetMod[],
  availableMods: ModTier[],
  ilvl: number,
  modPoolType: 'prefix' | 'suffix'
): ProbabilityResult {
  // Filter mods by ilvl requirement
  const validMods = availableMods.filter(mod => mod.ilvlRequired <= ilvl);

  if (validMods.length === 0) {
    return {
      successRate: 0,
      expectedAttempts: Infinity,
      confidence: 'high',
      explanation: `No ${modPoolType}es available at ilvl ${ilvl}`,
    };
  }

  // Calculate total weight
  const totalWeight = validMods.reduce((sum, mod) => sum + mod.weight, 0);

  // Calculate target weight
  const targetWeight = targetMods
    .filter(m => m.type === modPoolType)
    .reduce((sum, mod) => sum + (mod.weight || PROBABILITY_CALCULATION.DEFAULT_MOD_WEIGHT), 0);

  const successRate = totalWeight > 0 ? targetWeight / totalWeight : 0;
  const expectedAttempts = successRate > 0 ? Math.ceil(1 / successRate) : Infinity;

  const explanation = `At ilvl ${ilvl}, there are ${validMods.length} available ${modPoolType}es with total weight ${totalWeight}. ` +
    `Your target mods have combined weight ${targetWeight}, giving ~${(successRate * 100).toFixed(2)}% chance per attempt. ` +
    `Expected attempts: ${expectedAttempts}.`;

  return {
    successRate,
    expectedAttempts,
    confidence: successRate > 0.01 ? 'high' : successRate > 0.001 ? 'medium' : 'low',
    explanation,
  };
}

/**
 * Calculate success rate for fossil combinations
 * Uses base rate with tag-based multipliers
 */
export function calculateFossilSuccessRate(
  fossilTags: string[],
  targetTags: string[]
): ProbabilityResult {
  let baseRate = FOSSIL_OPTIMIZATION.BASE_SUCCESS_RATE;

  // Count matching tags
  let matchingTags = 0;
  for (const fossilTag of fossilTags) {
    if (targetTags.includes(fossilTag)) {
      matchingTags++;
      baseRate *= FOSSIL_OPTIMIZATION.SUCCESS_RATE_MULTIPLIER;
    }
  }

  // Cap at maximum success rate
  const successRate = Math.min(baseRate, FOSSIL_OPTIMIZATION.MAX_SUCCESS_RATE);
  const expectedAttempts = Math.ceil(1 / successRate);

  const explanation = `Fossil combination matches ${matchingTags} target tags. ` +
    `Base rate ${(FOSSIL_OPTIMIZATION.BASE_SUCCESS_RATE * 100).toFixed(2)}% × ${FOSSIL_OPTIMIZATION.SUCCESS_RATE_MULTIPLIER}^${matchingTags} = ${(baseRate * 100).toFixed(2)}%, ` +
    `capped at ${(FOSSIL_OPTIMIZATION.MAX_SUCCESS_RATE * 100).toFixed(2)}%. ` +
    `Expected attempts: ${expectedAttempts}.`;

  return {
    successRate,
    expectedAttempts,
    confidence: 'medium', // Fossil calculations are estimates
    explanation,
  };
}

/**
 * Calculate compound probability for multiple independent events
 */
export function calculateCompoundProbability(
  probabilities: number[]
): ProbabilityResult {
  const combinedProbability = probabilities.reduce((acc, p) => acc * p, 1);
  const expectedAttempts = combinedProbability > 0 ? Math.ceil(1 / combinedProbability) : Infinity;

  const explanation = `Compound probability of ${probabilities.length} independent events: ` +
    probabilities.map((p, i) => `Event ${i + 1}: ${(p * 100).toFixed(2)}%`).join(', ') + '. ' +
    `Overall: ${(combinedProbability * 100).toFixed(4)}%, expected attempts: ${expectedAttempts}.`;

  return {
    successRate: combinedProbability,
    expectedAttempts,
    confidence: combinedProbability > 0.01 ? 'high' : combinedProbability > 0.001 ? 'medium' : 'low',
    explanation,
  };
}

/**
 * Get mod pool information for debugging and display
 */
export function getModPoolInfo(
  desiredMods: DesiredMod[],
  availableMods: Mod[],
  itemTags: string[]
): ModPoolInfo {
  const prefixes = desiredMods.filter(m => m.type === 'prefix');
  const suffixes = desiredMods.filter(m => m.type === 'suffix');

  const availablePrefixes = availableMods.filter(m => m.type === 'prefix');
  const availableSuffixes = availableMods.filter(m => m.type === 'suffix');

  const matchingPrefixes = prefixes.map(p =>
    availablePrefixes.filter(m => m.name.toLowerCase().includes(p.name.toLowerCase()))
  ).flat();

  const matchingSuffixes = suffixes.map(s =>
    availableSuffixes.filter(m => m.name.toLowerCase().includes(s.name.toLowerCase()))
  ).flat();

  const prefixWeight = matchingPrefixes.reduce((sum, mod) => sum + getModWeight(mod, itemTags), 0);
  const suffixWeight = matchingSuffixes.reduce((sum, mod) => sum + getModWeight(mod, itemTags), 0);

  const totalPrefixWeight = availablePrefixes.reduce((sum, mod) => sum + getModWeight(mod, itemTags), 0);
  const totalSuffixWeight = availableSuffixes.reduce((sum, mod) => sum + getModWeight(mod, itemTags), 0);

  return {
    totalPrefixes: availablePrefixes.length,
    totalSuffixes: availableSuffixes.length,
    matchingPrefixes: matchingPrefixes.length,
    matchingSuffixes: matchingSuffixes.length,
    prefixWeight,
    suffixWeight,
    totalPrefixWeight,
    totalSuffixWeight,
  };
}

/**
 * Get mod weight for a given mod and item tags
 * Handles spawn weight calculation based on item tags
 */
function getModWeight(mod: Mod, itemTags: string[]): number {
  // If mod has spawn weights defined, use them
  if (mod.spawn_weights && mod.spawn_weights.length > 0) {
    for (const spawnWeight of mod.spawn_weights) {
      // Check if item has the required tag
      if (itemTags.includes(spawnWeight.tag)) {
        return spawnWeight.weight;
      }
    }
  }

  // Default weight if no spawn weights defined
  return PROBABILITY_CALCULATION.DEFAULT_MOD_WEIGHT;
}

/**
 * Format probability as percentage string
 */
export function formatProbability(probability: number): string {
  if (probability === 0) return '0%';
  if (probability >= 0.01) return `${(probability * 100).toFixed(2)}%`;
  if (probability >= 0.0001) return `${(probability * 100).toFixed(4)}%`;
  return `~${(probability * 100).toExponential(2)}%`;
}

/**
 * Format expected attempts with human-readable format
 */
export function formatExpectedAttempts(attempts: number): string {
  if (attempts === Infinity) return '∞';
  if (attempts >= 1000000) return `~${(attempts / 1000000).toFixed(1)}M`;
  if (attempts >= 1000) return `~${(attempts / 1000).toFixed(1)}K`;
  return attempts.toString();
}
