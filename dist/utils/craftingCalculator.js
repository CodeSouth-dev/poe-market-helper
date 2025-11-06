"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CraftingMethodBuilders = void 0;
exports.getMaterialPrices = getMaterialPrices;
exports.calculateCraftingCost = calculateCraftingCost;
exports.calculateAllCraftingCosts = calculateAllCraftingCosts;
exports.analyzeProfitability = analyzeProfitability;
exports.createCraftingMethod = createCraftingMethod;
const crafting_1 = require("../types/crafting");
const poeNinja_1 = require("../api/poeNinja");
/**
 * Fetches current market prices for crafting materials
 */
async function getMaterialPrices(materials, league = 'Crucible') {
    const priceMap = new Map();
    for (const material of materials) {
        try {
            const searchResult = await (0, poeNinja_1.searchItem)(material, league);
            if (searchResult.results.length > 0) {
                // Use median price if available, otherwise use the first result's chaos value
                const price = searchResult.medianPrice || searchResult.results[0].chaosValue;
                priceMap.set(material, price);
            }
            else {
                // Fallback to predefined prices if available
                const fallback = crafting_1.COMMON_MATERIALS[material];
                if (fallback) {
                    priceMap.set(material, fallback.avgChaos);
                }
                else {
                    console.warn(`No price found for ${material}, using 0`);
                    priceMap.set(material, 0);
                }
            }
        }
        catch (error) {
            console.error(`Error fetching price for ${material}:`, error);
            // Use fallback
            const fallback = crafting_1.COMMON_MATERIALS[material];
            priceMap.set(material, fallback?.avgChaos || 0);
        }
    }
    return priceMap;
}
/**
 * Calculates the total cost of a crafting method
 */
async function calculateCraftingCost(method, methodType, baseItemCost = 0, league = 'Crucible') {
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
    const totalMaterialCost = materialCosts.reduce((sum, cost) => sum + cost.totalCost, 0);
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
async function calculateAllCraftingCosts(methods, baseItemCost = 0, league = 'Crucible') {
    const costs = [];
    for (const { method, type } of methods) {
        const cost = await calculateCraftingCost(method, type, baseItemCost, league);
        costs.push(cost);
    }
    return costs;
}
/**
 * Analyzes profitability of crafting vs buying
 */
async function analyzeProfitability(targetItemName, craftingMethods, baseItemCost = 0, league = 'Crucible') {
    // Get market price for target item
    const marketResults = await (0, poeNinja_1.searchItem)(targetItemName, league);
    let marketPrice = 0;
    if (marketResults.results.length > 0) {
        // Use minimum market price (cheapest listing)
        marketPrice = marketResults.minPrice || marketResults.medianPrice || 0;
    }
    else {
        throw new Error(`Could not find market price for ${targetItemName}`);
    }
    // Calculate costs for all methods
    const allCosts = await calculateAllCraftingCosts(craftingMethods, baseItemCost, league);
    // Find cheapest method
    const bestMethod = allCosts.reduce((cheapest, current) => current.totalCost < cheapest.totalCost ? current : cheapest);
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
function createCraftingMethod(type, materials, averageAttempts = 1, description) {
    const templates = {
        [crafting_1.CraftingMethodType.ALT_SPAM]: 'Alteration Spam',
        [crafting_1.CraftingMethodType.ESSENCE]: 'Essence Crafting',
        [crafting_1.CraftingMethodType.FOSSIL]: 'Fossil Crafting',
        [crafting_1.CraftingMethodType.CHAOS_SPAM]: 'Chaos Spam',
        [crafting_1.CraftingMethodType.RECOMBINATOR]: 'Recombinator',
        [crafting_1.CraftingMethodType.HARVEST]: 'Harvest Reforge',
        [crafting_1.CraftingMethodType.VEILED_CHAOS]: 'Veiled Chaos',
        [crafting_1.CraftingMethodType.ELDRITCH]: 'Eldritch Crafting',
        [crafting_1.CraftingMethodType.BENCHCRAFT]: 'Benchcraft',
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
exports.CraftingMethodBuilders = {
    altSpam: (attempts = 50) => createCraftingMethod(crafting_1.CraftingMethodType.ALT_SPAM, [
        { name: 'Orb of Alteration', quantity: 1 },
        { name: 'Orb of Augmentation', quantity: 0.5 }, // Not every alt needs an aug
    ], attempts, 'Spam alterations until desired prefix/suffix appears'),
    essenceSpam: (essenceName, attempts = 10) => createCraftingMethod(crafting_1.CraftingMethodType.ESSENCE, [{ name: essenceName, quantity: 1 }], attempts, `Use ${essenceName} to guarantee specific mod`),
    fossilCraft: (fossils, resonator, attempts = 15) => createCraftingMethod(crafting_1.CraftingMethodType.FOSSIL, [
        ...fossils.map((f) => ({ name: f, quantity: 1 })),
        { name: resonator, quantity: 1 },
    ], attempts, 'Use fossils to weight specific mod types'),
    chaosSpam: (attempts = 100) => createCraftingMethod(crafting_1.CraftingMethodType.CHAOS_SPAM, [{ name: 'Chaos Orb', quantity: 1 }], attempts, 'Spam Chaos Orbs until desired mods appear'),
    recombinator: (baseItem1Cost, baseItem2Cost) => {
        // Note: baseItemCost will be passed separately to calculateCraftingCost
        return createCraftingMethod(crafting_1.CraftingMethodType.RECOMBINATOR, [
            { name: 'Orb of Scouring', quantity: 2 }, // To clean items if needed
            { name: 'Orb of Alchemy', quantity: 2 }, // To prepare items
        ], 1, `Combine two items (${baseItem1Cost}c + ${baseItem2Cost}c) using recombinator`);
    },
    harvestReforge: (lifeforceType, lifeforceAmount = 100, attempts = 20) => createCraftingMethod(crafting_1.CraftingMethodType.HARVEST, [{ name: lifeforceType, quantity: lifeforceAmount }], attempts, `Use ${lifeforceAmount} ${lifeforceType} per attempt`),
    veiledChaos: (attempts = 30) => createCraftingMethod(crafting_1.CraftingMethodType.VEILED_CHAOS, [{ name: 'Veiled Chaos Orb', quantity: 1 }], attempts, 'Use Veiled Chaos to add veiled mod'),
};
//# sourceMappingURL=craftingCalculator.js.map