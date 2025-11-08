/**
 * Input Validation Utilities
 * Comprehensive validation for all crafting-related inputs
 */

import { DesiredMod, BaseItem } from '../types/crafting';
import { CraftingGoal } from '../smartCraftingOptimizer';
import { ILVL_CONSTRAINTS, BUDGET_TIERS } from '../config/craftingConstants';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate CraftingGoal input
 */
export function validateCraftingGoal(goal: CraftingGoal): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate base item
  if (!goal.baseItem || goal.baseItem.trim() === '') {
    errors.push('Base item name is required');
  } else if (goal.baseItem.length < 3) {
    warnings.push('Base item name seems very short - verify it is correct');
  }

  // Validate item level
  if (goal.itemLevel === undefined || goal.itemLevel === null) {
    errors.push('Item level is required');
  } else if (goal.itemLevel < ILVL_CONSTRAINTS.MIN) {
    errors.push(`Item level must be at least ${ILVL_CONSTRAINTS.MIN}`);
  } else if (goal.itemLevel > ILVL_CONSTRAINTS.MAX) {
    errors.push(`Item level cannot exceed ${ILVL_CONSTRAINTS.MAX}`);
  } else if (goal.itemLevel < 68) {
    warnings.push('Item level is below 68 - some high-tier mods may not be available');
  }

  // Validate item class
  if (!goal.itemClass || goal.itemClass.trim() === '') {
    errors.push('Item class is required');
  }

  // Validate desired mods
  if (!goal.desiredMods || goal.desiredMods.length === 0) {
    errors.push('At least one desired mod is required');
  } else {
    if (goal.desiredMods.length > 6) {
      errors.push('Cannot have more than 6 mods (3 prefixes + 3 suffixes maximum)');
    }

    // Check for empty mod names
    const emptyMods = goal.desiredMods.filter(mod => !mod || mod.trim() === '');
    if (emptyMods.length > 0) {
      errors.push(`Found ${emptyMods.length} empty mod name(s)`);
    }

    // Check for duplicates
    const uniqueMods = new Set(goal.desiredMods.map(m => m.toLowerCase().trim()));
    if (uniqueMods.size < goal.desiredMods.length) {
      warnings.push('Duplicate mods detected in desired mods list');
    }
  }

  // Validate budget
  if (goal.budget === undefined || goal.budget === null) {
    errors.push('Budget is required');
  } else if (goal.budget < 0) {
    errors.push('Budget cannot be negative');
  } else if (goal.budget === 0) {
    warnings.push('Budget is 0 - only free crafting methods will be available');
  } else if (goal.budget < 10) {
    warnings.push('Budget is very low - crafting options will be extremely limited');
  } else if (goal.budget > 1000000) {
    warnings.push('Budget is very high - ensure this is intentional');
  }

  // Validate league
  if (!goal.league || goal.league.trim() === '') {
    errors.push('League name is required');
  } else if (goal.league.length < 3) {
    warnings.push('League name seems very short - verify it is correct');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate DesiredMod array
 */
export function validateDesiredMods(mods: DesiredMod[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!mods || mods.length === 0) {
    errors.push('At least one desired mod is required');
    return { isValid: false, errors, warnings };
  }

  // Check total count
  if (mods.length > 6) {
    errors.push('Cannot have more than 6 mods total (3 prefixes + 3 suffixes maximum)');
  }

  // Count prefixes and suffixes
  const prefixes = mods.filter(m => m.type === 'prefix');
  const suffixes = mods.filter(m => m.type === 'suffix');

  if (prefixes.length > 3) {
    errors.push(`Too many prefixes: ${prefixes.length} (maximum 3)`);
  }

  if (suffixes.length > 3) {
    errors.push(`Too many suffixes: ${suffixes.length} (maximum 3)`);
  }

  // Validate each mod
  mods.forEach((mod, index) => {
    if (!mod.name || mod.name.trim() === '') {
      errors.push(`Mod at index ${index} has empty name`);
    }

    if (mod.type !== 'prefix' && mod.type !== 'suffix') {
      errors.push(`Mod "${mod.name}" has invalid type: "${mod.type}" (must be "prefix" or "suffix")`);
    }

    if (mod.tier !== undefined && (mod.tier < 1 || mod.tier > 10)) {
      warnings.push(`Mod "${mod.name}" has unusual tier: ${mod.tier} (typically 1-10)`);
    }

    if (mod.weight !== undefined && mod.weight < 0) {
      errors.push(`Mod "${mod.name}" has negative weight: ${mod.weight}`);
    }
  });

  // Check for duplicates
  const modNames = mods.map(m => m.name.toLowerCase().trim());
  const uniqueNames = new Set(modNames);
  if (uniqueNames.size < modNames.length) {
    warnings.push('Duplicate mod names detected');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate item level
 */
export function validateItemLevel(ilvl: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (ilvl === undefined || ilvl === null || typeof ilvl !== 'number') {
    errors.push('Item level must be a number');
  } else if (!Number.isInteger(ilvl)) {
    errors.push('Item level must be an integer');
  } else if (ilvl < ILVL_CONSTRAINTS.MIN) {
    errors.push(`Item level must be at least ${ILVL_CONSTRAINTS.MIN}`);
  } else if (ilvl > ILVL_CONSTRAINTS.MAX) {
    errors.push(`Item level cannot exceed ${ILVL_CONSTRAINTS.MAX}`);
  } else {
    // Warnings for specific thresholds
    if (ilvl < ILVL_CONSTRAINTS.COMMON_THRESHOLDS.EARLY_GAME) {
      warnings.push('Item level is below 68 - some high-tier mods may not be available');
    } else if (ilvl < ILVL_CONSTRAINTS.COMMON_THRESHOLDS.T2_MODS) {
      warnings.push('Item level is below 81 - T1 mods will not be available');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate budget
 */
export function validateBudget(budget: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (budget === undefined || budget === null || typeof budget !== 'number') {
    errors.push('Budget must be a number');
  } else if (budget < 0) {
    errors.push('Budget cannot be negative');
  } else if (!Number.isFinite(budget)) {
    errors.push('Budget must be a finite number');
  } else {
    if (budget === 0) {
      warnings.push('Budget is 0 - only free crafting methods will be available');
    } else if (budget < 10) {
      warnings.push('Budget is very low (< 10 chaos) - crafting options will be extremely limited');
    } else if (budget < BUDGET_TIERS.LOW) {
      warnings.push(`Budget is low (< ${BUDGET_TIERS.LOW} chaos) - consider increasing for more options`);
    } else if (budget > 1000000) {
      warnings.push('Budget is very high (> 1M chaos) - ensure this is intentional');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate league name
 */
export function validateLeague(league: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!league || typeof league !== 'string') {
    errors.push('League name must be a string');
  } else if (league.trim() === '') {
    errors.push('League name cannot be empty');
  } else if (league.length < 3) {
    warnings.push('League name seems very short - verify it is correct');
  } else if (league.length > 50) {
    errors.push('League name is too long (maximum 50 characters)');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate base item name
 */
export function validateBaseItem(baseItem: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!baseItem || typeof baseItem !== 'string') {
    errors.push('Base item name must be a string');
  } else if (baseItem.trim() === '') {
    errors.push('Base item name cannot be empty');
  } else if (baseItem.length < 3) {
    warnings.push('Base item name seems very short - verify it is correct');
  } else if (baseItem.length > 100) {
    errors.push('Base item name is too long (maximum 100 characters)');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate item class
 */
export function validateItemClass(itemClass: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const validClasses = [
    'Body Armour',
    'Helmet',
    'Gloves',
    'Boots',
    'Belt',
    'Ring',
    'Amulet',
    'Weapon',
    'Shield',
    'Quiver',
    'One Hand Sword',
    'Two Hand Sword',
    'One Hand Axe',
    'Two Hand Axe',
    'One Hand Mace',
    'Two Hand Mace',
    'Bow',
    'Staff',
    'Wand',
    'Dagger',
    'Claw',
    'Sceptre',
    'Jewel',
    'Flask',
  ];

  if (!itemClass || typeof itemClass !== 'string') {
    errors.push('Item class must be a string');
  } else if (itemClass.trim() === '') {
    errors.push('Item class cannot be empty');
  } else {
    // Check if it matches a known class (case-insensitive)
    const normalized = itemClass.toLowerCase().trim();
    const isKnownClass = validClasses.some(c => c.toLowerCase() === normalized);

    if (!isKnownClass) {
      warnings.push(`Item class "${itemClass}" is not a standard PoE item class - verify it is correct`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Combine multiple validation results
 */
export function combineValidationResults(...results: ValidationResult[]): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  for (const result of results) {
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Format validation result as a human-readable string
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.isValid) {
    lines.push('✓ Validation passed');
  } else {
    lines.push('✗ Validation failed');
  }

  if (result.errors.length > 0) {
    lines.push('\nErrors:');
    result.errors.forEach(error => lines.push(`  • ${error}`));
  }

  if (result.warnings.length > 0) {
    lines.push('\nWarnings:');
    result.warnings.forEach(warning => lines.push(`  • ${warning}`));
  }

  return lines.join('\n');
}

/**
 * Sanitize string input by trimming whitespace
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  return input.trim();
}

/**
 * Sanitize number input
 */
export function sanitizeNumber(input: any, defaultValue: number = 0): number {
  const num = Number(input);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return defaultValue;
  }
  return num;
}

/**
 * Sanitize DesiredMod array
 */
export function sanitizeDesiredMods(mods: any[]): DesiredMod[] {
  if (!Array.isArray(mods)) return [];

  return mods
    .filter(mod => mod && typeof mod === 'object')
    .map(mod => ({
      name: sanitizeString(mod.name),
      type: (mod.type === 'prefix' || mod.type === 'suffix') ? mod.type : 'prefix',
      tier: mod.tier !== undefined ? sanitizeNumber(mod.tier, 1) : undefined,
      weight: mod.weight !== undefined ? sanitizeNumber(mod.weight, 1) : undefined,
    }))
    .filter(mod => mod.name !== ''); // Remove mods with empty names
}

/**
 * Sanitize and validate CraftingGoal
 */
export function sanitizeAndValidateCraftingGoal(goal: any): {
  sanitized: CraftingGoal | null;
  validation: ValidationResult;
} {
  if (!goal || typeof goal !== 'object') {
    return {
      sanitized: null,
      validation: {
        isValid: false,
        errors: ['Crafting goal must be an object'],
        warnings: [],
      },
    };
  }

  const sanitized: CraftingGoal = {
    baseItem: sanitizeString(goal.baseItem),
    itemLevel: sanitizeNumber(goal.itemLevel, 1),
    itemClass: sanitizeString(goal.itemClass),
    desiredMods: Array.isArray(goal.desiredMods)
      ? goal.desiredMods.map(mod => sanitizeString(mod)).filter(m => m !== '')
      : [],
    budget: sanitizeNumber(goal.budget, 0),
    league: sanitizeString(goal.league),
    riskMode: Boolean(goal.riskMode),
  };

  const validation = validateCraftingGoal(sanitized);

  return {
    sanitized: validation.isValid ? sanitized : null,
    validation,
  };
}
