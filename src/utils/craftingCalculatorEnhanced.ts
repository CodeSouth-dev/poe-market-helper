/**
 * Enhanced crafting calculator with ilvl, probabilities, and educational features
 */

import {
  ItemBase,
  TargetMod,
  CraftingChain,
  CraftingStepDefinition,
  CraftingStepResult,
  ProbabilityCalculation,
  ModTier,
  COMMON_MOD_POOLS,
  CraftingMethodType,
  CraftingMaterial,
  AdvancedTactic,
} from '../types/craftingEnhanced';
import { searchItem } from '../api/poeNinja';

/**
 * Calculate probability of hitting target mods based on ilvl and weights
 */
export function calculateModProbability(
  targetMods: TargetMod[],
  ilvl: number,
  modPoolType: 'prefix' | 'suffix'
): ProbabilityCalculation {
  const prefixTargets = targetMods.filter(m => m.type === 'prefix');
  const suffixTargets = targetMods.filter(m => m.type === 'suffix');

  // Get available mod pool at this ilvl
  const availableMods = getAvailableModsAtIlvl(ilvl, modPoolType);

  // Calculate total weight of available mods
  const totalWeight = availableMods.reduce((sum, mod) => sum + mod.weight, 0);

  // Calculate weight of target mods
  const targetWeight = targetMods
    .filter(m => m.type === modPoolType)
    .reduce((sum, mod) => sum + (mod.weight || 100), 0);

  const successRate = totalWeight > 0 ? targetWeight / totalWeight : 0;
  const averageAttempts = successRate > 0 ? Math.ceil(1 / successRate) : Infinity;

  let explanation = '';
  if (modPoolType === 'prefix') {
    explanation = `At ilvl ${ilvl}, there are ${availableMods.length} available prefixes with total weight ${totalWeight}. `;
    explanation += `Your target mods have combined weight ${targetWeight}, giving ~${(successRate * 100).toFixed(2)}% chance per attempt. `;
    explanation += `Expected attempts: ${averageAttempts}.`;
  } else {
    explanation = `At ilvl ${ilvl}, there are ${availableMods.length} available suffixes with total weight ${totalWeight}. `;
    explanation += `Your target mods have combined weight ${targetWeight}, giving ~${(successRate * 100).toFixed(2)}% chance per attempt. `;
    explanation += `Expected attempts: ${averageAttempts}.`;
  }

  return {
    targetMods,
    ilvl,
    method: CraftingMethodType.ALT_SPAM, // Default
    successRate,
    averageAttempts,
    modPoolSize: {
      availablePrefixes: modPoolType === 'prefix' ? availableMods.length : 0,
      availableSuffixes: modPoolType === 'suffix' ? availableMods.length : 0,
      targetPrefixes: prefixTargets.length,
      targetSuffixes: suffixTargets.length,
    },
    explanation,
  };
}

/**
 * Get available mods at a specific ilvl
 */
function getAvailableModsAtIlvl(ilvl: number, modType: 'prefix' | 'suffix'): ModTier[] {
  const poolKey = modType === 'prefix' ? 'life_prefix' : 'resistance_suffix';
  const pool = COMMON_MOD_POOLS[poolKey] || [];

  return pool.filter(mod => mod.ilvlRequired <= ilvl);
}

/**
 * Build a crafting chain with cost and probability calculations
 */
export async function buildCraftingChain(
  baseItem: ItemBase,
  targetMods: TargetMod[],
  chainTemplate: string,
  league: string = 'Crucible'
): Promise<CraftingChain> {
  const steps: CraftingStepDefinition[] = [];

  // Define chain based on template
  switch (chainTemplate) {
    case 'alt_regal_multimod':
      steps.push(
        await buildAltSpamStep(baseItem, targetMods, 1),
        await buildRegalStep(baseItem, 2),
        await buildMultimodStep(baseItem, 3)
      );
      break;

    case 'alt_regal_annul':
      steps.push(
        await buildAltSpamStep(baseItem, targetMods, 1),
        await buildRegalStep(baseItem, 2),
        await buildAnnulStep(baseItem, 3)
      );
      break;

    case 'essence_spam':
      steps.push(
        await buildEssenceSpamStep(baseItem, targetMods, 1)
      );
      break;

    case 'fossil_spam':
      steps.push(
        await buildFossilSpamStep(baseItem, targetMods, 1)
      );
      break;

    case 'harvest_reforge':
      steps.push(
        await buildHarvestReforgeStep(baseItem, targetMods, 1)
      );
      break;

    case 'alt_regal_recombinator':
      steps.push(
        await buildAltSpamStep(baseItem, targetMods, 1, 'First base: '),
        await buildAltSpamStep(baseItem, targetMods, 2, 'Second base: '),
        await buildRecombinatorStep(baseItem, 3)
      );
      break;

    case 'eldritch_crafting':
      steps.push(
        await buildEldritchCraftingStep(baseItem, targetMods, 1)
      );
      break;

    case 'metacraft_exalt':
      steps.push(
        await buildMetacraftStep(baseItem, targetMods, 1),
        await buildExaltStep(baseItem, 2)
      );
      break;

    default:
      steps.push(await buildAltSpamStep(baseItem, targetMods, 1));
  }

  // Calculate total cost and success rate
  const totalCost = await calculateChainCost(steps, league);
  const totalSuccessRate = calculateCompoundSuccessRate(steps);

  const educationalNotes = generateEducationalNotes(chainTemplate, baseItem, targetMods);

  return {
    name: chainTemplate.replace(/_/g, ' ').toUpperCase(),
    description: `Multi-step crafting process for ${baseItem.name}`,
    steps,
    totalCost,
    totalSuccessRate,
    educationalNotes,
    difficulty: determineChainDifficulty(chainTemplate),
  };
}

/**
 * Build individual crafting step definitions
 */
async function buildAltSpamStep(
  baseItem: ItemBase,
  targetMods: TargetMod[],
  stepNumber: number,
  prefix: string = ''
): Promise<CraftingStepDefinition> {
  const probability = calculateModProbability(
    targetMods,
    baseItem.ilvl,
    'prefix' // Simplified - would determine based on target mods
  );

  return {
    stepNumber,
    method: CraftingMethodType.ALT_SPAM,
    itemState: 'white',
    targetMods,
    materials: [
      { name: 'Orb of Alteration', quantity: 1, category: 'Currency' },
      { name: 'Orb of Augmentation', quantity: 0.5, category: 'Currency' },
    ],
    expectedAttempts: probability.averageAttempts,
    explanation: `${prefix}Spam Orbs of Alteration until you hit ${targetMods.map(m => m.modName).join(' or ')}. ${probability.explanation}`,
    tips: [
      `At ilvl ${baseItem.ilvl}, you can roll up to T${getHighestTierAtIlvl(baseItem.ilvl)} mods`,
      'Use Orb of Augmentation to add a second mod if needed',
      'Consider your budget - high tier mods can take hundreds of alts',
    ],
  };
}

async function buildRegalStep(baseItem: ItemBase, stepNumber: number): Promise<CraftingStepDefinition> {
  return {
    stepNumber,
    method: CraftingMethodType.REGAL,
    itemState: 'magic',
    targetMods: [],
    materials: [
      { name: 'Regal Orb', quantity: 1, category: 'Currency' },
    ],
    expectedAttempts: 1,
    explanation: 'Use a Regal Orb to upgrade the item from magic to rare, adding one random mod.',
    tips: [
      'Regal always adds exactly one mod (prefix or suffix)',
      'The new mod is completely random from the available pool',
      'If you hit a bad mod, you may need to annul or start over',
    ],
  };
}

async function buildMultimodStep(baseItem: ItemBase, stepNumber: number): Promise<CraftingStepDefinition> {
  return {
    stepNumber,
    method: CraftingMethodType.MULTIMOD,
    itemState: 'rare',
    targetMods: [],
    materials: [
      { name: 'Divine Orb', quantity: 2, category: 'Currency' },
    ],
    expectedAttempts: 1,
    explanation: 'Craft "Can have multiple Crafted Modifiers" from bench (costs 2 Divine Orbs), then craft up to 2 more mods.',
    tips: [
      'Multimod itself takes one affix slot',
      'You can craft 2 additional mods after multimod',
      'Crafted mods are usually weaker than natural rolls',
      'Total cost: 2 divine for multimod + bench costs for other crafts',
    ],
  };
}

async function buildAnnulStep(baseItem: ItemBase, stepNumber: number): Promise<CraftingStepDefinition> {
  return {
    stepNumber,
    method: CraftingMethodType.ANNUL,
    itemState: 'rare',
    targetMods: [],
    materials: [
      { name: 'Orb of Annulment', quantity: 1, category: 'Currency' },
    ],
    expectedAttempts: 3, // Assuming item has 3 mods, need to hit the right one
    explanation: 'Use Orb of Annulment to remove an unwanted mod. This is risky - it can remove any mod.',
    tips: [
      'Annul has equal chance to remove any mod on the item',
      'If item has 3 mods and 1 is bad, you have 33% chance to annul the bad one',
      'Very risky - can brick your item by removing good mods',
      'Consider if it\'s worth the risk vs starting over',
    ],
  };
}

async function buildEssenceSpamStep(
  baseItem: ItemBase,
  targetMods: TargetMod[],
  stepNumber: number
): Promise<CraftingStepDefinition> {
  // Assume using Deafening essence for T1 equivalent
  const essenceMod = targetMods.find(m => m.isRequired);
  const essenceName = getEssenceForMod(essenceMod?.modName || 'life');

  return {
    stepNumber,
    method: CraftingMethodType.ESSENCE,
    itemState: 'white',
    targetMods,
    materials: [
      { name: essenceName, quantity: 1, category: 'Essence' },
    ],
    expectedAttempts: 20, // Simplified - depends on other desired mods
    explanation: `Spam ${essenceName} to guarantee ${essenceMod?.modName || 'your target mod'}, then pray for other good mods.`,
    tips: [
      'Essences guarantee one specific mod at a fixed tier',
      'The other mods are completely random',
      'Deafening essences give T1-equivalent mods',
      'Cheaper than alt-spamming for certain mods',
    ],
  };
}

async function buildFossilSpamStep(
  baseItem: ItemBase,
  targetMods: TargetMod[],
  stepNumber: number
): Promise<CraftingStepDefinition> {
  const fossils = getFossilsForMods(targetMods);

  return {
    stepNumber,
    method: CraftingMethodType.FOSSIL,
    itemState: 'white',
    targetMods,
    materials: [
      ...fossils.map(f => ({ name: f, quantity: 1, category: 'Fossil' })),
      { name: 'Primitive Chaotic Resonator', quantity: 1, category: 'Resonator' },
    ],
    expectedAttempts: 15,
    explanation: `Use ${fossils.join(' + ')} to weight mods in your favor. Fossils modify the mod pool to make certain mods more likely.`,
    tips: [
      'Different fossils modify different mod types',
      'Multiple fossils can be combined in resonators',
      'Check which fossils BLOCK certain mod types',
      'Some fossils make mods more common, others prevent them entirely',
    ],
    fossilMods: fossils,
  };
}

async function buildHarvestReforgeStep(
  baseItem: ItemBase,
  targetMods: TargetMod[],
  stepNumber: number
): Promise<CraftingStepDefinition> {
  const harvestType = getHarvestTypeForMods(targetMods);

  return {
    stepNumber,
    method: CraftingMethodType.HARVEST_REFORGE,
    itemState: 'rare',
    targetMods,
    materials: [
      { name: 'Sacred Crystallised Lifeforce', quantity: 100, category: 'Currency' },
    ],
    expectedAttempts: 25,
    explanation: `Use Harvest "Reforge ${harvestType}" to reroll all mods while guaranteeing at least one ${harvestType} mod.`,
    tips: [
      `"Reforge ${harvestType}" keeps the item rare`,
      'All mods are rerolled, but at least one will have the target tag',
      '"More likely" variants increase chances of high-tier mods',
      'Can be expensive - calculate expected cost vs other methods',
    ],
    harvestCraft: `Reforge ${harvestType}`,
  };
}

async function buildRecombinatorStep(baseItem: ItemBase, stepNumber: number): Promise<CraftingStepDefinition> {
  return {
    stepNumber,
    method: CraftingMethodType.RECOMBINATOR,
    itemState: 'magic',
    targetMods: [],
    materials: [
      { name: 'Recombinator', quantity: 1, category: 'Currency' },
      { name: baseItem.name, quantity: 2, category: 'Base' }, // Two bases needed
    ],
    expectedAttempts: 2, // ~50% to keep each mod
    explanation: 'Combine two bases with desired mods. Each mod has ~50% chance to transfer to the final item.',
    tips: [
      'Recombinators work best when both items have 1-2 mods you want',
      'Can result in combinations impossible to hit otherwise',
      'Can use cheaper white bases instead of expensive influenced bases',
      'Some mods have higher/lower transfer rates',
    ],
  };
}

async function buildEldritchCraftingStep(
  baseItem: ItemBase,
  targetMods: TargetMod[],
  stepNumber: number
): Promise<CraftingStepDefinition> {
  return {
    stepNumber,
    method: CraftingMethodType.ELDRITCH_CHAOS,
    itemState: 'rare',
    targetMods,
    materials: [
      { name: 'Eldritch Chaos Orb', quantity: 1, category: 'Currency' },
    ],
    expectedAttempts: 30,
    explanation: 'Use Eldritch Chaos to reroll all mods EXCEPT Eldritch implicits. Safe for items with expensive implicits.',
    tips: [
      'Only works on Searing Exarch or Eater of Worlds influenced items',
      'Preserves Eldritch implicits while rerolling all other mods',
      'Great for items where you invested in good implicits',
      'Can combine with Eldritch Exalt/Annul for targeted changes',
    ],
  };
}

async function buildMetacraftStep(
  baseItem: ItemBase,
  targetMods: TargetMod[],
  stepNumber: number
): Promise<CraftingStepDefinition> {
  return {
    stepNumber,
    method: CraftingMethodType.PREFIXES_CANNOT_CHANGE,
    itemState: 'rare',
    targetMods,
    materials: [
      { name: 'Divine Orb', quantity: 2, category: 'Currency' },
    ],
    expectedAttempts: 1,
    explanation: 'Craft "Prefixes Cannot Be Changed" to protect your prefixes, then scour to remove all suffixes safely.',
    tips: [
      'Metacrafts cost 2 divine orbs each',
      'They take up a suffix/prefix slot while active',
      'Used to safely modify one type of affix without touching the other',
      'Very expensive but gives deterministic results',
    ],
    prefixBlock: true,
  };
}

async function buildExaltStep(baseItem: ItemBase, stepNumber: number): Promise<CraftingStepDefinition> {
  return {
    stepNumber,
    method: CraftingMethodType.EXALT,
    itemState: 'rare',
    targetMods: [],
    materials: [
      { name: 'Exalted Orb', quantity: 1, category: 'Currency' },
    ],
    expectedAttempts: 1,
    explanation: 'Use Exalted Orb to add one random mod. With metacrafts active, this can be deterministic.',
    tips: [
      'Exalt adds one random mod from available pool',
      'If you have "Prefixes Cannot Be Changed", exalt will only add a prefix',
      'Very expensive - make sure the expected value is worth it',
      'Consider using Harvest augment for cheaper targeted exalts',
    ],
  };
}

/**
 * Helper functions
 */
function getHighestTierAtIlvl(ilvl: number): number {
  if (ilvl >= 86) return 1;
  if (ilvl >= 81) return 2;
  if (ilvl >= 73) return 3;
  if (ilvl >= 64) return 4;
  return 5;
}

function getEssenceForMod(modName: string): string {
  const essenceMap: Record<string, string> = {
    life: 'Deafening Essence of Greed',
    mana: 'Deafening Essence of Woe',
    fire_res: 'Deafening Essence of Hatred',
    cold_res: 'Deafening Essence of Hatred',
    lightning_res: 'Deafening Essence of Wrath',
    attack_speed: 'Deafening Essence of Zeal',
    cast_speed: 'Deafening Essence of Misery',
  };
  return essenceMap[modName] || 'Deafening Essence of Greed';
}

function getFossilsForMods(targetMods: TargetMod[]): string[] {
  const fossils: string[] = [];
  const modTypes = targetMods.map(m => m.tags).flat();

  if (modTypes.includes('life')) fossils.push('Pristine Fossil');
  if (modTypes.includes('defence')) fossils.push('Dense Fossil');
  if (modTypes.includes('physical')) fossils.push('Jagged Fossil');
  if (modTypes.includes('elemental')) fossils.push('Scorched Fossil');
  if (modTypes.includes('attack')) fossils.push('Serrated Fossil');
  if (modTypes.includes('caster')) fossils.push('Metallic Fossil');

  return fossils.slice(0, 2); // Max 2 fossils for simplicity
}

function getHarvestTypeForMods(targetMods: TargetMod[]): string {
  const modTypes = targetMods.map(m => m.tags).flat();

  if (modTypes.includes('life')) return 'Life';
  if (modTypes.includes('defence')) return 'Defence';
  if (modTypes.includes('physical')) return 'Physical';
  if (modTypes.includes('attack')) return 'Attack';
  if (modTypes.includes('caster')) return 'Caster';

  return 'Life';
}

async function calculateChainCost(steps: CraftingStepDefinition[], league: string): Promise<number> {
  let totalCost = 0;

  for (const step of steps) {
    const stepCost = await calculateStepCost(step, league);
    totalCost += stepCost * step.expectedAttempts;
  }

  return totalCost;
}

async function calculateStepCost(step: CraftingStepDefinition, league: string): Promise<number> {
  let cost = 0;

  for (const material of step.materials) {
    try {
      const result = await searchItem(material.name, league);
      const price = result.medianPrice || result.minPrice || 0;
      cost += price * material.quantity;
    } catch (error) {
      // Fallback to estimated prices
      cost += (material.chaosValue || 1) * material.quantity;
    }
  }

  return cost;
}

function calculateCompoundSuccessRate(steps: CraftingStepDefinition[]): number {
  let compoundRate = 1.0;

  for (const step of steps) {
    if (step.expectedAttempts > 1) {
      const stepSuccessRate = 1 / step.expectedAttempts;
      compoundRate *= stepSuccessRate;
    }
  }

  return compoundRate;
}

function generateEducationalNotes(
  chainTemplate: string,
  baseItem: ItemBase,
  targetMods: TargetMod[]
): string[] {
  const notes: string[] = [];

  notes.push(`This crafting chain is designed for ilvl ${baseItem.ilvl} items.`);

  if (baseItem.ilvl < 86) {
    notes.push(`⚠️ At ilvl ${baseItem.ilvl}, you cannot roll T1 mods (require ilvl 86+).`);
  }

  const requiredMods = targetMods.filter(m => m.isRequired);
  if (requiredMods.length > 0) {
    notes.push(`Target mods: ${requiredMods.map(m => m.modName).join(', ')}`);
  }

  notes.push(`💡 Tip: Always check your budget before starting - crafting can be expensive!`);

  return notes;
}

function determineChainDifficulty(chainTemplate: string): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
  const difficultyMap: Record<string, 'beginner' | 'intermediate' | 'advanced' | 'expert'> = {
    essence_spam: 'beginner',
    fossil_spam: 'beginner',
    alt_regal_multimod: 'intermediate',
    alt_regal_annul: 'intermediate',
    harvest_reforge: 'intermediate',
    alt_regal_recombinator: 'advanced',
    eldritch_crafting: 'advanced',
    metacraft_exalt: 'expert',
  };

  return difficultyMap[chainTemplate] || 'intermediate';
}

/**
 * Get advanced crafting tactics
 */
export function getAdvancedTactics(): AdvancedTactic[] {
  return [
    {
      name: 'Mod Blocking',
      description: 'Use crafting bench to block low-tier mods before using Harvest or Exalts',
      whenToUse: 'When you want to force higher tier mods or specific mod types',
      steps: [
        'Craft a low-tier version of your desired mod on the item',
        'Use Harvest reforge or Exalted Orb',
        'The crafted mod blocks that mod type from rolling at low tiers',
        'Either the craft is removed and replaced, or a different mod is added',
      ],
      difficulty: 'advanced',
      estimatedCost: { min: 50, max: 500, average: 200 },
      examples: [
        'Craft +20 life, then Harvest reforge life = blocks T5-T7 life from rolling',
        'Forces T1-T4 life or removes the crafted mod entirely',
      ],
    },
    {
      name: 'Cannot Roll Attack/Caster Mods',
      description: 'Use benchcrafts to block entire mod categories when slamming',
      whenToUse: 'When you want specific mod types from Exalts or Harvest',
      steps: [
        'Craft "Cannot Roll Attack Mods" (costs 1 divine)',
        'Exalt or Harvest reforge',
        'Will only roll caster/generic mods',
        'Remove the craft after',
      ],
      difficulty: 'expert',
      estimatedCost: { min: 150, max: 300, average: 200 },
      examples: [
        'On a wand: Cannot Roll Attack Mods → Exalt = guarantees caster mod',
        'On a ring: Cannot Roll Attack Mods → Harvest augment = caster mod only',
      ],
    },
    {
      name: 'Imprint Alt-Spam',
      description: 'Create imprints of magic items to revert failed regals',
      whenToUse: 'When alt-spamming expensive bases or when regal has low success rate',
      steps: [
        'Alt-spam until you hit your desired mod(s)',
        'Use a Craicic Chimeral beast to create an imprint',
        'Regal the item',
        'If regal fails, use imprint to restore the magic item',
        'Repeat until successful',
      ],
      difficulty: 'advanced',
      estimatedCost: { min: 100, max: 1000, average: 400 },
      examples: [
        'Alt for T1 flat phys on a weapon → imprint → regal for T1 %phys',
        'If regal fails, restore imprint and try again',
      ],
    },
    {
      name: 'Awakener\'s Orb Combo',
      description: 'Combine two influenced items to get both influence mods',
      whenToUse: 'When you need specific mods from two different influence types',
      steps: [
        'Get first influenced item with desired mod',
        'Get second influenced item with other desired mod',
        'Use Awakener\'s Orb to combine them',
        'Result has both influence types and both mods guaranteed',
        'Other mods are random',
      ],
      difficulty: 'expert',
      estimatedCost: { min: 500, max: 5000, average: 2000 },
      examples: [
        'Crusader chest with Explode + Hunter chest with Frenzy on hit',
        'Awakener\'s Orb = chest with both mods + random other mods',
      ],
    },
    {
      name: 'Fracture Fossil Strategy',
      description: 'Permanently lock a mod using Fracture Fossils',
      whenToUse: 'When you have one perfect mod and want to reroll everything else safely',
      steps: [
        'Get item with one amazing mod (e.g., T1 life)',
        'Use Fracture Fossil (1/5 chance to fracture)',
        'If successful, the mod is permanent and cannot be changed',
        'You can now scour, chaos spam, or use any method without losing that mod',
      ],
      difficulty: 'expert',
      estimatedCost: { min: 1000, max: 10000, average: 5000 },
      examples: [
        'Hit T1 life on a ring → Fracture it → Chaos spam for other perfect mods',
        'T1 life is permanently locked and safe',
      ],
    },
  ];
}

/**
 * Simulate a crafting chain and return detailed results
 */
export async function simulateCraftingChain(
  chain: CraftingChain,
  iterations: number = 1000
): Promise<{
  averageCost: number;
  successRate: number;
  costDistribution: { min: number; max: number; median: number };
  stepResults: CraftingStepResult[];
}> {
  const costs: number[] = [];
  let successes = 0;

  // Simplified simulation
  for (let i = 0; i < iterations; i++) {
    let runCost = 0;
    let success = true;

    for (const step of chain.steps) {
      const stepCost = step.materials.reduce((sum, m) => sum + (m.chaosValue || 1) * m.quantity, 0);
      const attempts = Math.ceil(Math.random() * step.expectedAttempts * 2); // Random variance
      runCost += stepCost * attempts;

      if (Math.random() > 0.7) { // 70% success rate per step (simplified)
        success = false;
        break;
      }
    }

    costs.push(runCost);
    if (success) successes++;
  }

  costs.sort((a, b) => a - b);

  const stepResults: CraftingStepResult[] = chain.steps.map((step, idx) => ({
    stepNumber: idx + 1,
    methodName: step.method,
    description: step.explanation,
    cost: step.materials.reduce((sum, m) => sum + (m.chaosValue || 1) * m.quantity, 0),
    successRate: 1 / step.expectedAttempts,
    expectedAttempts: step.expectedAttempts,
    explanation: step.explanation,
  }));

  return {
    averageCost: costs.reduce((a, b) => a + b, 0) / costs.length,
    successRate: successes / iterations,
    costDistribution: {
      min: costs[0],
      max: costs[costs.length - 1],
      median: costs[Math.floor(costs.length / 2)],
    },
    stepResults,
  };
}
