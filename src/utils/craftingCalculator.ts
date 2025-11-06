import {
  CraftingMethod,
  CraftingCost,
  CraftingMethodType,
  ProfitabilityAnalysis,
  CraftingMaterial,
  COMMON_MATERIALS,
} from '../types/crafting';
import { searchItem } from '../api/poeNinja';

/**
 * Fetches current market prices for crafting materials
 */
export async function getMaterialPrices(
  materials: string[],
  league: string = 'Crucible'
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();

  for (const material of materials) {
    try {
      const searchResult = await searchItem(material, league);

      if (searchResult.results.length > 0) {
        // Use median price if available, otherwise use the first result's chaos value
        const price = searchResult.medianPrice || searchResult.results[0].chaosValue;
        priceMap.set(material, price);
      } else {
        // Fallback to predefined prices if available
        const fallback = COMMON_MATERIALS[material as keyof typeof COMMON_MATERIALS];
        if (fallback) {
          priceMap.set(material, fallback.avgChaos);
        } else {
          console.warn(`No price found for ${material}, using 0`);
          priceMap.set(material, 0);
        }
      }
    } catch (error) {
      console.error(`Error fetching price for ${material}:`, error);
      // Use fallback
      const fallback = COMMON_MATERIALS[material as keyof typeof COMMON_MATERIALS];
      priceMap.set(material, fallback?.avgChaos || 0);
    }
  }

  return priceMap;
}

/**
 * Calculates the total cost of a crafting method
 */
export async function calculateCraftingCost(
  method: CraftingMethod,
  methodType: CraftingMethodType,
  baseItemCost: number = 0,
  league: string = 'Crucible'
): Promise<CraftingCost> {
  const materialNames = method.materials.map((m) => m.name);
  const priceMap = await getMaterialPrices(materialNames, league);

  const materialCosts = method.materials.map((material) => {
    const unitCost = priceMap.get(material.name) || 0;
    const quantity = material.quantity * (method.averageAttempts || 1);
    return {
      material: material.name,
      unitCost,
      quantity,
      totalCost: unitCost * quantity,
    };
  });

  const totalMaterialCost = materialCosts.reduce(
    (sum, cost) => sum + cost.totalCost,
    0
  );

  return {
    methodType,
    methodName: method.name,
    totalCost: baseItemCost + totalMaterialCost,
    breakdown: {
      baseCost: baseItemCost,
      materialCosts,
    },
    expectedAttempts: method.averageAttempts,
  };
}

/**
 * Calculates crafting costs for multiple methods
 */
export async function calculateAllCraftingCosts(
  methods: Array<{ method: CraftingMethod; type: CraftingMethodType }>,
  baseItemCost: number = 0,
  league: string = 'Crucible'
): Promise<CraftingCost[]> {
  const costs: CraftingCost[] = [];

  for (const { method, type } of methods) {
    const cost = await calculateCraftingCost(method, type, baseItemCost, league);
    costs.push(cost);
  }

  return costs;
}

/**
 * Analyzes profitability of crafting vs buying
 */
export async function analyzeProfitability(
  targetItemName: string,
  craftingMethods: Array<{ method: CraftingMethod; type: CraftingMethodType }>,
  baseItemCost: number = 0,
  league: string = 'Crucible'
): Promise<ProfitabilityAnalysis> {
  // Get market price for target item
  const marketResults = await searchItem(targetItemName, league);

  let marketPrice = 0;
  if (marketResults.results.length > 0) {
    // Use minimum market price (cheapest listing)
    marketPrice = marketResults.minPrice || marketResults.medianPrice || 0;
  } else {
    throw new Error(`Could not find market price for ${targetItemName}`);
  }

  // Calculate costs for all methods
  const allCosts = await calculateAllCraftingCosts(craftingMethods, baseItemCost, league);

  // Find cheapest method
  const bestMethod = allCosts.reduce((cheapest, current) =>
    current.totalCost < cheapest.totalCost ? current : cheapest
  );

  const profit = marketPrice - bestMethod.totalCost;
  const profitPercentage = (profit / bestMethod.totalCost) * 100;
  const isProfitable = profit > 0;

  return {
    targetItem: targetItemName,
    marketPrice,
    bestCraftingMethod: bestMethod,
    allMethods: allCosts.sort((a, b) => a.totalCost - b.totalCost),
    profit,
    profitPercentage,
    isProfitable,
    recommendation: isProfitable ? 'craft' : 'buy',
  };
}

/**
 * Helper to create common crafting method instances
 */
export function createCraftingMethod(
  type: CraftingMethodType,
  materials: CraftingMaterial[],
  averageAttempts: number = 1,
  description?: string
): CraftingMethod {
  const templates = {
    [CraftingMethodType.ALT_SPAM]: 'Alteration Spam',
    [CraftingMethodType.ESSENCE]: 'Essence Crafting',
    [CraftingMethodType.FOSSIL]: 'Fossil Crafting',
    [CraftingMethodType.CHAOS_SPAM]: 'Chaos Spam',
    [CraftingMethodType.RECOMBINATOR]: 'Recombinator',
    [CraftingMethodType.HARVEST]: 'Harvest Reforge',
    [CraftingMethodType.VEILED_CHAOS]: 'Veiled Chaos',
    [CraftingMethodType.ELDRITCH]: 'Eldritch Crafting',
    [CraftingMethodType.BENCHCRAFT]: 'Benchcraft',
  };

  return {
    name: templates[type],
    description: description || `Craft using ${templates[type]}`,
    materials,
    averageAttempts,
  };
}

/**
 * Quick method builders for common crafting scenarios
 */
export const CraftingMethodBuilders = {
  altSpam: (attempts: number = 50): CraftingMethod =>
    createCraftingMethod(
      CraftingMethodType.ALT_SPAM,
      [
        { name: 'Orb of Alteration', quantity: 1 },
        { name: 'Orb of Augmentation', quantity: 0.5 }, // Not every alt needs an aug
      ],
      attempts,
      'Spam alterations until desired prefix/suffix appears'
    ),

  essenceSpam: (essenceName: string, attempts: number = 10): CraftingMethod =>
    createCraftingMethod(
      CraftingMethodType.ESSENCE,
      [{ name: essenceName, quantity: 1 }],
      attempts,
      `Use ${essenceName} to guarantee specific mod`
    ),

  fossilCraft: (
    fossils: string[],
    resonator: string,
    attempts: number = 15
  ): CraftingMethod =>
    createCraftingMethod(
      CraftingMethodType.FOSSIL,
      [
        ...fossils.map((f) => ({ name: f, quantity: 1 })),
        { name: resonator, quantity: 1 },
      ],
      attempts,
      'Use fossils to weight specific mod types'
    ),

  chaosSpam: (attempts: number = 100): CraftingMethod =>
    createCraftingMethod(
      CraftingMethodType.CHAOS_SPAM,
      [{ name: 'Chaos Orb', quantity: 1 }],
      attempts,
      'Spam Chaos Orbs until desired mods appear'
    ),

  recombinator: (baseItem1Cost: number, baseItem2Cost: number): CraftingMethod => {
    // Note: baseItemCost will be passed separately to calculateCraftingCost
    return createCraftingMethod(
      CraftingMethodType.RECOMBINATOR,
      [
        { name: 'Orb of Scouring', quantity: 2 }, // To clean items if needed
        { name: 'Orb of Alchemy', quantity: 2 }, // To prepare items
      ],
      1,
      `Combine two items (${baseItem1Cost}c + ${baseItem2Cost}c) using recombinator`
    );
  },

  harvestReforge: (
    lifeforceType: string,
    lifeforceAmount: number = 100,
    attempts: number = 20
  ): CraftingMethod =>
    createCraftingMethod(
      CraftingMethodType.HARVEST,
      [{ name: lifeforceType, quantity: lifeforceAmount }],
      attempts,
      `Use ${lifeforceAmount} ${lifeforceType} per attempt`
    ),

  veiledChaos: (attempts: number = 30): CraftingMethod =>
    createCraftingMethod(
      CraftingMethodType.VEILED_CHAOS,
      [{ name: 'Veiled Chaos Orb', quantity: 1 }],
      attempts,
      'Use Veiled Chaos to add veiled mod'
    ),
};
