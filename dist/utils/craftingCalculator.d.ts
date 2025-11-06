import { CraftingMethod, CraftingCost, CraftingMethodType, ProfitabilityAnalysis, CraftingMaterial } from '../types/crafting';
/**
 * Fetches current market prices for crafting materials
 */
export declare function getMaterialPrices(materials: string[], league?: string): Promise<Map<string, number>>;
/**
 * Calculates the total cost of a crafting method
 */
export declare function calculateCraftingCost(method: CraftingMethod, methodType: CraftingMethodType, baseItemCost?: number, league?: string): Promise<CraftingCost>;
/**
 * Calculates crafting costs for multiple methods
 */
export declare function calculateAllCraftingCosts(methods: Array<{
    method: CraftingMethod;
    type: CraftingMethodType;
}>, baseItemCost?: number, league?: string): Promise<CraftingCost[]>;
/**
 * Analyzes profitability of crafting vs buying
 */
export declare function analyzeProfitability(targetItemName: string, craftingMethods: Array<{
    method: CraftingMethod;
    type: CraftingMethodType;
}>, baseItemCost?: number, league?: string): Promise<ProfitabilityAnalysis>;
/**
 * Helper to create common crafting method instances
 */
export declare function createCraftingMethod(type: CraftingMethodType, materials: CraftingMaterial[], averageAttempts?: number, description?: string): CraftingMethod;
/**
 * Quick method builders for common crafting scenarios
 */
export declare const CraftingMethodBuilders: {
    altSpam: (attempts?: number) => CraftingMethod;
    essenceSpam: (essenceName: string, attempts?: number) => CraftingMethod;
    fossilCraft: (fossils: string[], resonator: string, attempts?: number) => CraftingMethod;
    chaosSpam: (attempts?: number) => CraftingMethod;
    recombinator: (baseItem1Cost: number, baseItem2Cost: number) => CraftingMethod;
    harvestReforge: (lifeforceType: string, lifeforceAmount?: number, attempts?: number) => CraftingMethod;
    veiledChaos: (attempts?: number) => CraftingMethod;
};
