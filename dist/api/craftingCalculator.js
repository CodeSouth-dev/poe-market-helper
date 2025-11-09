"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CraftingCalculator = void 0;
const poedbScraper_1 = require("../poedbScraper");
const craftOfExileScraper_1 = require("../craftOfExileScraper");
const poeNinja_1 = require("./poeNinja");
const currencyPriceService_1 = require("../services/currencyPriceService");
const craftingConstants_1 = require("../config/craftingConstants");
/**
 * Core crafting calculation engine
 * Calculates probabilities and costs for different crafting methods
 * Now uses live PoEDB scraping and CraftOfExile simulator for accurate probabilities
 */
class CraftingCalculator {
    constructor() {
        this.currencyService = (0, currencyPriceService_1.getCurrencyPriceService)();
        this.poeNinja = new poeNinja_1.PoeNinjaAPI();
    }
    /**
     * Initialize the calculator by loading data
     */
    async initialize(league) {
        await this.currencyService.loadPrices(league);
    }
    /**
     * Main method: Calculate best crafting method for desired mods
     */
    async calculateBestMethod(desiredMods, baseItemName, itemClass, league) {
        await this.initialize(league);
        // Get base item data from PoEDB
        const baseItems = await poedbScraper_1.poedbScraper.scrapeBaseItems(itemClass);
        const baseItem = baseItems.find(item => item.name.toLowerCase() === baseItemName.toLowerCase());
        const itemLevelData = await poedbScraper_1.poedbScraper.getBestIlvlForMods(itemClass, desiredMods.map(m => m.name));
        const itemLevel = itemLevelData.recommendedIlvl;
        console.log(`\n🎲 Running CraftOfExile simulations for ${baseItemName} (ilvl ${itemLevel})...`);
        // Use CraftOfExile simulator to get accurate probabilities
        const methods = [];
        const modNames = desiredMods.map(m => m.name);
        try {
            // Run ALL crafting method calculations in parallel for maximum efficiency
            const [chaosSimulation, altRegalSimulation, fossilSimulation, essenceSimulation, fossilMethod, essenceMethod, harvestMethod, veiledMethod, beastMethod] = await Promise.all([
                // CraftOfExile simulations
                craftOfExileScraper_1.craftOfExileScraper.simulateCrafting(baseItemName, itemLevel, modNames, 'chaos'),
                craftOfExileScraper_1.craftOfExileScraper.simulateCrafting(baseItemName, itemLevel, modNames, 'alt-regal'),
                craftOfExileScraper_1.craftOfExileScraper.simulateCrafting(baseItemName, itemLevel, modNames, 'fossil'),
                craftOfExileScraper_1.craftOfExileScraper.simulateCrafting(baseItemName, itemLevel, modNames, 'essence'),
                // Advanced crafting methods
                this.calculateFossilCrafting(desiredMods, baseItemName, itemLevel, itemClass, league),
                this.calculateEssenceCrafting(desiredMods, baseItemName, itemLevel, itemClass, league),
                this.calculateHarvestReforge(desiredMods, baseItemName, itemLevel, itemClass, league),
                this.calculateVeiledChaos(desiredMods, baseItemName, itemLevel, itemClass, league),
                this.calculateBeastcrafting(desiredMods, baseItemName, itemLevel, itemClass, league)
            ]);
            // Add basic CraftOfExile methods
            if (chaosSimulation.cheapestMethod) {
                methods.push({
                    method: 'chaos',
                    name: chaosSimulation.cheapestMethod.name,
                    description: chaosSimulation.cheapestMethod.description || 'Spam Chaos Orbs until desired mods appear',
                    probability: chaosSimulation.cheapestMethod.successRate,
                    averageCost: chaosSimulation.cheapestMethod.averageCost,
                    currencyUsed: { 'Chaos Orb': chaosSimulation.cheapestMethod.averageAttempts },
                    steps: [
                        `Spam Chaos Orbs on ${baseItemName} (ilvl ${itemLevel})`,
                        'Stop when you hit desired mods',
                        `Expected attempts: ${chaosSimulation.cheapestMethod.averageAttempts}`,
                        `Success rate: ${(chaosSimulation.cheapestMethod.successRate * 100).toFixed(2)}%`
                    ],
                    expectedAttempts: chaosSimulation.cheapestMethod.averageAttempts
                });
            }
            if (altRegalSimulation.cheapestMethod) {
                methods.push({
                    method: 'alteration',
                    name: altRegalSimulation.cheapestMethod.name,
                    description: altRegalSimulation.cheapestMethod.description || 'Alt spam for desired mods, then regal',
                    probability: altRegalSimulation.cheapestMethod.successRate,
                    averageCost: altRegalSimulation.cheapestMethod.averageCost,
                    currencyUsed: {
                        'Orb of Alteration': altRegalSimulation.cheapestMethod.averageAttempts,
                        'Regal Orb': 1
                    },
                    steps: [
                        `Spam Orbs of Alteration on ${baseItemName} (ilvl ${itemLevel})`,
                        'When you hit desired mods, use Regal Orb',
                        `Expected attempts: ${altRegalSimulation.cheapestMethod.averageAttempts}`,
                        `Success rate: ${(altRegalSimulation.cheapestMethod.successRate * 100).toFixed(2)}%`,
                        'Craft remaining affixes on bench'
                    ],
                    expectedAttempts: altRegalSimulation.cheapestMethod.averageAttempts
                });
            }
            // Add advanced methods (these are more detailed than basic CraftOfExile results)
            if (fossilMethod)
                methods.push(fossilMethod);
            if (essenceMethod)
                methods.push(essenceMethod);
            if (harvestMethod)
                methods.push(harvestMethod);
            if (veiledMethod)
                methods.push(veiledMethod);
            if (beastMethod)
                methods.push(beastMethod);
            console.log(`✅ Simulations complete. Found ${methods.length} crafting methods.`);
        }
        catch (error) {
            console.error(`⚠️ CraftOfExile simulation failed, using fallback estimates:`, error.message);
            // Fallback to simple estimates if CraftOfExile fails
            const chaosPrice = this.currencyService.getPrice('Chaos Orb');
            methods.push({
                method: 'chaos',
                name: 'Chaos Spam (Estimated)',
                description: 'Spam Chaos Orbs until desired mods appear',
                probability: 0.1,
                averageCost: 150 * chaosPrice,
                currencyUsed: { 'Chaos Orb': 150 },
                steps: [
                    `Spam Chaos Orbs on ${baseItemName}`,
                    'Stop when you hit desired mods'
                ],
                expectedAttempts: 150
            });
        }
        // Sort by cost
        methods.sort((a, b) => a.averageCost - b.averageCost);
        const bestMethod = methods[0];
        const baseRecommendation = await this.recommendBaseType(desiredMods, baseItemName, itemClass, league, bestMethod);
        const totalCostChaos = baseRecommendation.averageCost + bestMethod.averageCost;
        const divinePrice = this.currencyService.getPrice('Divine Orb');
        const totalCostDivine = totalCostChaos / divinePrice;
        return {
            desiredMods,
            baseItem: baseItemName,
            itemClass,
            league,
            methods,
            bestMethod,
            baseRecommendation,
            totalCostChaos,
            totalCostDivine,
            preferredCurrency: totalCostChaos >= divinePrice * 2 ? 'divine' : 'chaos'
        };
    }
    // ============================================================================
    // Advanced Crafting Methods - Using Live PoEDB + CraftOfExile
    // ============================================================================
    /**
     * Calculate fossil crafting method with CraftOfExile simulator
     */
    async calculateFossilCrafting(desiredMods, baseItemName, itemLevel, itemClass, league) {
        try {
            const modNames = desiredMods.map(m => m.name);
            const simulation = await craftOfExileScraper_1.craftOfExileScraper.simulateCrafting(baseItemName, itemLevel, modNames, 'fossil');
            if (!simulation.cheapestMethod || simulation.cheapestMethod.averageCost === 0) {
                return null;
            }
            const fossilPrice = this.currencyService.getPrice('Fossil') || 5; // Avg fossil price
            const resonatorPrice = this.currencyService.getPrice('Resonator') || 2;
            const totalCost = (simulation.cheapestMethod.averageAttempts * fossilPrice) + resonatorPrice;
            return {
                method: 'fossil',
                name: 'Fossil Crafting',
                description: 'Use targeted fossils to force desired mods with weighted probabilities',
                probability: simulation.cheapestMethod.successRate,
                averageCost: totalCost,
                currencyUsed: {
                    'Fossils': simulation.cheapestMethod.averageAttempts,
                    'Resonator': 1
                },
                steps: [
                    'Identify which fossils weight your desired mods positively',
                    'Purchase fossils and appropriate resonator for mod count',
                    `Spam fossils on ${baseItemName} (ilvl ${itemLevel})`,
                    `Expected attempts: ${Math.round(simulation.cheapestMethod.averageAttempts)}`,
                    `Success rate: ${(simulation.cheapestMethod.successRate * 100).toFixed(2)}%`,
                    'Finish with bench crafts or continue rolling'
                ],
                expectedAttempts: Math.round(simulation.cheapestMethod.averageAttempts)
            };
        }
        catch (error) {
            console.error('Failed to calculate fossil crafting:', error.message);
            return null;
        }
    }
    /**
     * Calculate essence crafting method
     */
    async calculateEssenceCrafting(desiredMods, baseItemName, itemLevel, itemClass, league) {
        try {
            const modNames = desiredMods.map(m => m.name);
            const simulation = await craftOfExileScraper_1.craftOfExileScraper.simulateCrafting(baseItemName, itemLevel, modNames, 'essence');
            if (!simulation.cheapestMethod || simulation.cheapestMethod.averageCost === 0) {
                return null;
            }
            // Find which essence guarantees one of our desired mods
            const essenceDatabase = {
                'life': 'Essence of Greed',
                'maximum life': 'Essence of Greed',
                'mana': 'Essence of Woe',
                'energy shield': 'Essence of Spite',
                'fire resistance': 'Essence of Anger',
                'cold resistance': 'Essence of Hatred',
                'lightning resistance': 'Essence of Wrath',
                'strength': 'Essence of Rage',
                'dexterity': 'Essence of Sorrow',
                'intelligence': 'Essence of Doubt',
                'attack speed': 'Essence of Zeal',
                'cast speed': 'Essence of Torment'
            };
            let guaranteedMod = '';
            let essenceName = 'Essence';
            for (const mod of modNames) {
                const modLower = mod.toLowerCase();
                for (const [key, essence] of Object.entries(essenceDatabase)) {
                    if (modLower.includes(key)) {
                        guaranteedMod = mod;
                        essenceName = essence;
                        break;
                    }
                }
                if (guaranteedMod)
                    break;
            }
            const essencePrice = this.currencyService.getPrice(essenceName) || 10;
            const totalCost = simulation.cheapestMethod.averageAttempts * essencePrice;
            return {
                method: 'essence',
                name: 'Essence Crafting',
                description: `Use ${essenceName} to guarantee ${guaranteedMod || 'specific mod'}, then roll for others`,
                probability: simulation.cheapestMethod.successRate,
                averageCost: totalCost,
                currencyUsed: {
                    [essenceName]: simulation.cheapestMethod.averageAttempts
                },
                steps: [
                    `Purchase ${essenceName} (guarantees ${guaranteedMod || 'one desired mod'})`,
                    `Spam ${essenceName} on ${baseItemName} (ilvl ${itemLevel})`,
                    `Expected attempts: ${Math.round(simulation.cheapestMethod.averageAttempts)}`,
                    `Success rate: ${(simulation.cheapestMethod.successRate * 100).toFixed(2)}%`,
                    'Finish with bench crafts for remaining affixes'
                ],
                expectedAttempts: Math.round(simulation.cheapestMethod.averageAttempts)
            };
        }
        catch (error) {
            console.error('Failed to calculate essence crafting:', error.message);
            return null;
        }
    }
    /**
     * Calculate Harvest reforge crafting
     */
    async calculateHarvestReforge(desiredMods, baseItemName, itemLevel, itemClass, league) {
        try {
            // Determine which Harvest reforge type based on desired mods
            const modNames = desiredMods.map(m => m.name.toLowerCase());
            let harvestType = 'Reforge';
            let targetTag = '';
            // Map mod names to harvest tags
            if (modNames.some(m => m.includes('fire') || m.includes('cold') || m.includes('lightning'))) {
                harvestType = 'Reforge with Elemental mod';
                targetTag = 'elemental';
            }
            else if (modNames.some(m => m.includes('life') || m.includes('mana'))) {
                harvestType = 'Reforge with Life mod';
                targetTag = 'life';
            }
            else if (modNames.some(m => m.includes('chaos') || m.includes('poison'))) {
                harvestType = 'Reforge with Chaos mod';
                targetTag = 'chaos';
            }
            else if (modNames.some(m => m.includes('physical') || m.includes('bleed'))) {
                harvestType = 'Reforge with Physical mod';
                targetTag = 'physical';
            }
            else if (modNames.some(m => m.includes('attack') || m.includes('crit'))) {
                harvestType = 'Reforge with Attack mod';
                targetTag = 'attack';
            }
            else if (modNames.some(m => m.includes('cast') || m.includes('spell'))) {
                harvestType = 'Reforge with Caster mod';
                targetTag = 'caster';
            }
            else if (modNames.some(m => m.includes('speed'))) {
                harvestType = 'Reforge with Speed mod';
                targetTag = 'speed';
            }
            else if (modNames.some(m => m.includes('defence') || m.includes('armor') || m.includes('evasion'))) {
                harvestType = 'Reforge with Defence mod';
                targetTag = 'defence';
            }
            const harvestPrice = craftingConstants_1.HARVEST_COSTS[harvestType] || 20;
            // Estimate attempts (Harvest is more targeted, so better success rate)
            const estimatedAttempts = Math.max(20, Math.floor(100 / (desiredMods.length + 1)));
            const probability = 1 / estimatedAttempts;
            const totalCost = estimatedAttempts * harvestPrice;
            return {
                method: 'harvest',
                name: 'Harvest Reforge',
                description: `${harvestType} for targeted crafting`,
                probability,
                averageCost: totalCost,
                currencyUsed: {
                    [harvestType]: estimatedAttempts
                },
                steps: [
                    `Purchase "${harvestType}" from Harvest or TFT`,
                    `Use on ${baseItemName} (ilvl ${itemLevel})`,
                    `Guarantees at least one ${targetTag} mod`,
                    `Expected attempts: ${estimatedAttempts}`,
                    `Avg cost per craft: ${harvestPrice}c`,
                    'Can combine with "Keep Prefix/Suffix" for better control'
                ],
                expectedAttempts: estimatedAttempts
            };
        }
        catch (error) {
            console.error('Failed to calculate harvest reforge:', error.message);
            return null;
        }
    }
    /**
     * Calculate Veiled Chaos (Aisling) crafting
     */
    async calculateVeiledChaos(desiredMods, baseItemName, itemLevel, itemClass, league) {
        // Veiled Chaos is useful for specific veiled mods
        const veiledModKeywords = ['unveiled', 'veiled', 'aisling', 'syndicate'];
        const hasVeiledMod = desiredMods.some(mod => veiledModKeywords.some(keyword => mod.name.toLowerCase().includes(keyword)));
        if (!hasVeiledMod && desiredMods.length > 2) {
            // Only suggest veiled chaos if specifically requested or for 1-2 mod items
            return null;
        }
        try {
            const veiledChaosPrice = this.currencyService.getPrice('Veiled Chaos Orb') || 30;
            const aislingBenchPrice = 100; // Avg price for Aisling bench in TFT
            // Veiled Chaos method: Get item with desired mods, then add veiled mod
            const estimatedAttempts = 5; // Usually get decent unveil in a few tries
            const totalCost = hasVeiledMod ? aislingBenchPrice : (estimatedAttempts * veiledChaosPrice);
            return {
                method: 'veiled',
                name: hasVeiledMod ? 'Aisling Bench (Veiled Mod)' : 'Veiled Chaos Orb',
                description: hasVeiledMod
                    ? 'Use Aisling bench to add veiled mod, then unveil for powerful mods'
                    : 'Add veiled modifier for additional crafting options',
                probability: 0.6, // Good chance to get useful unveil
                averageCost: totalCost,
                currencyUsed: hasVeiledMod
                    ? { 'Aisling Bench (TFT)': 1 }
                    : { 'Veiled Chaos Orb': estimatedAttempts },
                steps: hasVeiledMod
                    ? [
                        `Craft item with desired mods on ${baseItemName}`,
                        'Use Aisling bench from Syndicate (costs ~100c on TFT)',
                        'Unveil the modifier and select desired option',
                        'Has a chance to remove an existing mod - risky!'
                    ]
                    : [
                        `Spam Veiled Chaos on ${baseItemName} (ilvl ${itemLevel})`,
                        'Rerolls item and adds a veiled modifier',
                        'Unveil to choose from 3 powerful mods',
                        `Expected attempts: ${estimatedAttempts}`,
                        'Useful for getting specific high-tier mods'
                    ],
                expectedAttempts: estimatedAttempts
            };
        }
        catch (error) {
            console.error('Failed to calculate veiled chaos:', error.message);
            return null;
        }
    }
    /**
     * Calculate Beastcrafting method
     */
    async calculateBeastcrafting(desiredMods, baseItemName, itemLevel, itemClass, league) {
        try {
            // Common beastcrafting recipes
            const beastRecipes = {
                'prefix': {
                    name: 'Add Prefix, Remove Suffix',
                    cost: 15,
                    description: 'Adds a prefix mod and removes a random suffix'
                },
                'suffix': {
                    name: 'Add Suffix, Remove Prefix',
                    cost: 15,
                    description: 'Adds a suffix mod and removes a random prefix'
                },
                'imprint': {
                    name: 'Create Imprint (Magic item)',
                    cost: 50,
                    description: 'Creates an imprint of a magic item for safe crafting'
                },
                'split': {
                    name: 'Split Item',
                    cost: 80,
                    description: 'Splits item into two (rare league-specific beasts)'
                },
                'corrupt': {
                    name: 'Corrupt with 30% Quality',
                    cost: 25,
                    description: 'Corrupts item but sets quality to 30%'
                }
            };
            // Determine which beast craft is most relevant
            const prefixCount = desiredMods.filter(m => m.type === 'prefix').length;
            const suffixCount = desiredMods.filter(m => m.type === 'suffix').length;
            let bestRecipe = beastRecipes['prefix'];
            if (suffixCount > prefixCount) {
                bestRecipe = beastRecipes['suffix'];
            }
            // For magic items, imprint is very valuable
            if (desiredMods.length <= 2) {
                bestRecipe = beastRecipes['imprint'];
            }
            return {
                method: 'beast',
                name: `Beastcrafting: ${bestRecipe.name}`,
                description: bestRecipe.description,
                probability: 0.8, // Generally reliable
                averageCost: bestRecipe.cost,
                currencyUsed: {
                    'Beast (TFT or catch)': 1
                },
                steps: [
                    `Prepare ${baseItemName} with partial mods`,
                    `Purchase or catch beast for "${bestRecipe.name}"`,
                    `Use beast in Menagerie on your item`,
                    `Cost: ~${bestRecipe.cost}c`,
                    'Can be combined with other methods for advanced crafting'
                ],
                expectedAttempts: 1
            };
        }
        catch (error) {
            console.error('Failed to calculate beastcrafting:', error.message);
            return null;
        }
    }
    /**
     * Recommend best base type to purchase
     */
    async recommendBaseType(desiredMods, baseItemName, itemClass, league, craftingMethod) {
        // Check prices for different base types
        const recommendations = [];
        // 1. Normal (white) base
        try {
            const normalSearch = await this.poeNinja.searchItem(baseItemName, league);
            const normalPrice = normalSearch.minPrice || 1;
            recommendations.push({
                baseType: 'normal',
                itemName: baseItemName,
                reason: 'Cheapest option, requires full crafting process',
                averageCost: normalPrice,
                searchQuery: baseItemName
            });
        }
        catch (error) {
            // Fallback if not found
            recommendations.push({
                baseType: 'normal',
                itemName: baseItemName,
                reason: 'Standard white base',
                averageCost: 1
            });
        }
        // 2. Rare with partial mods (would need trade API integration)
        // For now, recommend normal base as safest option
        // Sort by cost
        recommendations.sort((a, b) => a.averageCost - b.averageCost);
        return recommendations[0];
    }
    /**
     * Format cost for display
     */
    formatCost(chaosValue, preferredCurrency = 'chaos') {
        const divinePrice = this.currencyService.getPrice('Divine Orb');
        if (preferredCurrency === 'divine' || chaosValue >= divinePrice * 2) {
            const divineValue = chaosValue / divinePrice;
            return `${divineValue.toFixed(2)} Divine`;
        }
        return `${chaosValue.toFixed(1)} Chaos`;
    }
}
exports.CraftingCalculator = CraftingCalculator;
