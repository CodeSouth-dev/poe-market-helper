"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CraftingCalculator = void 0;
const craftingData_1 = require("./craftingData");
const poeNinja_1 = require("./poeNinja");
const currencyPriceService_1 = require("../services/currencyPriceService");
const probabilityCalculator_1 = require("../utils/probabilityCalculator");
/**
 * Core crafting calculation engine
 * Calculates probabilities and costs for different crafting methods
 */
class CraftingCalculator {
    constructor() {
        this.dataLoader = (0, craftingData_1.getCraftingDataLoader)();
        this.currencyService = (0, currencyPriceService_1.getCurrencyPriceService)();
        this.poeNinja = new poeNinja_1.PoeNinjaAPI();
    }
    /**
     * Initialize the calculator by loading data
     */
    async initialize(league) {
        await this.dataLoader.loadAll();
        await this.currencyService.loadPrices(league);
    }
    /**
     * Main method: Calculate best crafting method for desired mods
     */
    async calculateBestMethod(desiredMods, baseItemName, itemClass, league) {
        if (!this.dataLoader.isLoaded()) {
            await this.initialize(league);
        }
        const baseItem = this.dataLoader.getBaseItem(baseItemName);
        if (!baseItem) {
            throw new Error(`Base item not found: ${baseItemName}`);
        }
        // Calculate different methods
        const methods = [];
        // 1. Chaos spam
        const chaosMethod = await this.calculateChaosSpam(desiredMods, baseItem, league);
        if (chaosMethod)
            methods.push(chaosMethod);
        // 2. Fossil crafting
        const fossilMethod = await this.calculateFossilCrafting(desiredMods, baseItem, league);
        if (fossilMethod)
            methods.push(fossilMethod);
        // 3. Essence crafting
        const essenceMethod = await this.calculateEssenceCrafting(desiredMods, baseItem, itemClass, league);
        if (essenceMethod)
            methods.push(essenceMethod);
        // 4. Alteration spam
        const alterationMethod = await this.calculateAlterationSpam(desiredMods, baseItem, league);
        if (alterationMethod)
            methods.push(alterationMethod);
        // 5. Exalted Orb slamming (for adding 1-2 specific mods)
        const exaltMethod = await this.calculateExaltedSlam(desiredMods, baseItem, league);
        if (exaltMethod)
            methods.push(exaltMethod);
        // 6. Harvest Reforge (for targeted rerolling)
        const harvestMethod = await this.calculateHarvestReforge(desiredMods, baseItem, league);
        if (harvestMethod)
            methods.push(harvestMethod);
        // 7. Veiled Chaos (Aisling) for veiled mods
        const veiledMethod = await this.calculateVeiledChaos(desiredMods, baseItem, league);
        if (veiledMethod)
            methods.push(veiledMethod);
        // 8. Annulment Orb (for removing unwanted mods)
        const annulMethod = await this.calculateAnnulment(desiredMods, baseItem, league);
        if (annulMethod)
            methods.push(annulMethod);
        // 9. Beastcrafting (specific beast crafts)
        const beastMethod = await this.calculateBeastcrafting(desiredMods, baseItem, league);
        if (beastMethod)
            methods.push(beastMethod);
        // 10. Recombinators (combine two items)
        const recombinatorMethod = await this.calculateRecombinator(desiredMods, baseItem, league);
        if (recombinatorMethod)
            methods.push(recombinatorMethod);
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
    /**
     * Calculate chaos spam method
     */
    async calculateChaosSpam(desiredMods, baseItem, league) {
        const availableMods = this.dataLoader.getModsForItemClass(baseItem.item_class, baseItem.tags);
        const probResult = (0, probabilityCalculator_1.calculateWeightedModProbability)(desiredMods, availableMods, baseItem.tags);
        if (probResult.successRate === 0) {
            return null;
        }
        const chaosPrice = this.currencyService.getPrice('Chaos Orb');
        const expectedAttempts = probResult.expectedAttempts;
        const averageCost = expectedAttempts * chaosPrice;
        return {
            method: 'chaos',
            name: 'Chaos Spam',
            description: `Use Chaos Orbs to reroll the item until desired mods are hit`,
            probability: probResult.successRate,
            averageCost,
            currencyUsed: {
                'Chaos Orb': expectedAttempts
            },
            steps: [
                `Obtain a ${baseItem.name}`,
                `Use Chaos Orbs repeatedly until you hit the desired mods`,
                `Expected attempts: ${expectedAttempts}`
            ],
            expectedAttempts
        };
    }
    /**
     * Calculate fossil crafting method
     */
    async calculateFossilCrafting(desiredMods, baseItem, league) {
        const relevantFossils = this.dataLoader.getFossilsForTags(baseItem.tags);
        if (relevantFossils.length === 0) {
            return null;
        }
        // Find best fossil combination
        const bestCombination = this.findBestFossilCombination(desiredMods, baseItem, relevantFossils);
        if (!bestCombination) {
            return null;
        }
        const fossilCost = bestCombination.fossils.reduce((total, fossilName) => {
            const price = this.currencyService.getPrice(fossilName);
            return total + price;
        }, 0);
        const resonatorPrice = this.getResonatorPrice(bestCombination.resonator);
        const costPerAttempt = fossilCost + resonatorPrice;
        const expectedAttempts = Math.ceil(1 / bestCombination.probability);
        const averageCost = expectedAttempts * costPerAttempt;
        const currencyUsed = {};
        bestCombination.fossils.forEach(fossil => {
            currencyUsed[fossil] = expectedAttempts;
        });
        currencyUsed[bestCombination.resonator] = expectedAttempts;
        return {
            method: 'fossil',
            name: `Fossil Crafting (${bestCombination.fossils.join(' + ')})`,
            description: `Use ${bestCombination.fossils.join(', ')} in a ${bestCombination.resonator}`,
            probability: bestCombination.probability,
            averageCost,
            currencyUsed,
            steps: [
                `Obtain a ${baseItem.name}`,
                `Place ${bestCombination.fossils.join(', ')} in a ${bestCombination.resonator}`,
                `Use on the item repeatedly until desired mods are hit`,
                `Expected attempts: ${expectedAttempts}`
            ],
            expectedAttempts
        };
    }
    /**
     * Calculate essence crafting method
     */
    async calculateEssenceCrafting(desiredMods, baseItem, itemClass, league) {
        const essences = this.dataLoader.getEssencesForItemClass(itemClass);
        // Find if any essence guarantees one of our desired mods
        let bestEssence = null;
        let guaranteedMod = null;
        for (const essence of essences) {
            const modId = essence.mods[itemClass];
            if (modId) {
                const mod = this.dataLoader.getMod(modId);
                if (mod) {
                    for (const desiredMod of desiredMods) {
                        if (mod.name.toLowerCase().includes(desiredMod.name.toLowerCase())) {
                            bestEssence = essence;
                            guaranteedMod = desiredMod;
                            break;
                        }
                    }
                }
            }
            if (bestEssence)
                break;
        }
        if (!bestEssence || !guaranteedMod) {
            return null;
        }
        // Calculate probability of hitting remaining mods
        const remainingMods = desiredMods.filter(m => m !== guaranteedMod);
        const availableMods = this.dataLoader.getModsForItemClass(baseItem.item_class, baseItem.tags);
        const probability = remainingMods.length > 0
            ? this.calculateModProbability(remainingMods, availableMods, baseItem.tags)
            : 1;
        if (probability === 0 && remainingMods.length > 0) {
            return null;
        }
        const essencePrice = this.currencyService.getPrice(bestEssence.name);
        const expectedAttempts = Math.ceil(1 / probability);
        const averageCost = expectedAttempts * essencePrice;
        return {
            method: 'essence',
            name: `Essence Crafting (${bestEssence.name})`,
            description: `Use ${bestEssence.name} to guarantee ${guaranteedMod.name}`,
            probability,
            averageCost,
            currencyUsed: {
                [bestEssence.name]: expectedAttempts
            },
            steps: [
                `Obtain a ${baseItem.name}`,
                `Use ${bestEssence.name} to guarantee ${guaranteedMod.name}`,
                remainingMods.length > 0
                    ? `Repeat until other desired mods are also hit`
                    : 'Craft is complete',
                `Expected attempts: ${expectedAttempts}`
            ],
            expectedAttempts
        };
    }
    /**
     * Calculate alteration spam method
     */
    async calculateAlterationSpam(desiredMods, baseItem, league) {
        // Alteration spam is mainly useful for 1-2 mod items
        if (desiredMods.length > 2) {
            return null;
        }
        const availableMods = this.dataLoader.getModsForItemClass(baseItem.item_class, baseItem.tags);
        const probability = this.calculateModProbability(desiredMods, availableMods, baseItem.tags, true);
        if (probability === 0) {
            return null;
        }
        const alterationPrice = this.currencyService.getPrice('Orb of Alteration');
        const augmentPrice = this.currencyService.getPrice('Orb of Augmentation');
        const expectedAttempts = Math.ceil(1 / probability);
        const averageCost = expectedAttempts * (alterationPrice + augmentPrice * 0.5);
        return {
            method: 'alteration',
            name: 'Alteration Spam',
            description: 'Use Orb of Alteration until desired mods appear',
            probability,
            averageCost,
            currencyUsed: {
                'Orb of Alteration': expectedAttempts,
                'Orb of Augmentation': Math.floor(expectedAttempts * 0.5)
            },
            steps: [
                `Obtain a ${baseItem.name}`,
                'Use Orb of Alteration to reroll as magic item',
                'Use Orb of Augmentation to add a second mod if needed',
                `Expected attempts: ${expectedAttempts}`,
                'Can use Regal Orb to upgrade to rare if needed'
            ],
            expectedAttempts
        };
    }
    /**
     * Calculate Exalted Orb slamming method
     * Used to add 1-2 specific mods to an item with open affixes
     */
    async calculateExaltedSlam(desiredMods, baseItem, league) {
        // Exalt slamming is only useful for adding 1-2 mods to an already good item
        if (desiredMods.length > 2) {
            return null;
        }
        const availableMods = this.dataLoader.getModsForItemClass(baseItem.item_class, baseItem.tags);
        // Calculate probability of hitting desired mod with exalt
        const prefixes = desiredMods.filter(m => m.type === 'prefix');
        const suffixes = desiredMods.filter(m => m.type === 'suffix');
        const availablePrefixes = availableMods.filter(m => m.type === 'prefix');
        const availableSuffixes = availableMods.filter(m => m.type === 'suffix');
        let probability = 1;
        for (const prefix of prefixes) {
            const matchingMods = availablePrefixes.filter(m => m.name.toLowerCase().includes(prefix.name.toLowerCase()));
            if (matchingMods.length === 0)
                return null;
            probability *= matchingMods.length / availablePrefixes.length;
        }
        for (const suffix of suffixes) {
            const matchingMods = availableSuffixes.filter(m => m.name.toLowerCase().includes(suffix.name.toLowerCase()));
            if (matchingMods.length === 0)
                return null;
            probability *= matchingMods.length / availableSuffixes.length;
        }
        if (probability === 0)
            return null;
        const exaltPrice = this.currencyService.getPrice('Exalted Orb');
        const expectedAttempts = Math.ceil(1 / probability);
        const averageCost = expectedAttempts * exaltPrice;
        return {
            method: 'chaos',
            name: 'Exalted Orb Slamming',
            description: 'Add random mods to item using Exalted Orbs',
            probability,
            averageCost,
            currencyUsed: {
                'Exalted Orb': expectedAttempts
            },
            steps: [
                `Start with a rare ${baseItem.name} that has good existing mods`,
                'Ensure the item has open prefix or suffix slots',
                'Use Exalted Orb to add a random mod',
                `Expected attempts to hit desired mod(s): ${expectedAttempts}`,
                '⚠️ Warning: Exalt slamming is expensive and risky for multiple mods'
            ],
            expectedAttempts
        };
    }
    /**
     * Calculate Harvest Reforge method
     * Rerolls all mods while guaranteeing mods of a specific type
     */
    async calculateHarvestReforge(desiredMods, baseItem, league) {
        // Determine harvest type based on desired mods
        const harvestType = this.getHarvestTypeForMods(desiredMods);
        if (!harvestType)
            return null;
        const availableMods = this.dataLoader.getModsForItemClass(baseItem.item_class, baseItem.tags);
        // Harvest reforge narrows the mod pool to specific types
        const harvestModPool = availableMods.filter(mod => {
            // Simplified: filter mods that match the harvest type
            const modName = mod.name.toLowerCase();
            return modName.includes(harvestType.toLowerCase());
        });
        if (harvestModPool.length === 0)
            return null;
        // Calculate probability with narrowed pool
        const probability = this.calculateModProbabilityWithPool(desiredMods, harvestModPool, baseItem.tags);
        if (probability === 0)
            return null;
        // Harvest craft prices vary, use reasonable estimate
        const harvestPrice = 20; // Average harvest reforge cost
        const expectedAttempts = Math.ceil(1 / probability);
        const averageCost = expectedAttempts * harvestPrice;
        return {
            method: 'harvest',
            name: `Harvest Reforge (${harvestType})`,
            description: `Use Harvest "Reforge ${harvestType}" to guarantee ${harvestType} mods`,
            probability,
            averageCost,
            currencyUsed: {
                [`Harvest Reforge ${harvestType}`]: expectedAttempts
            },
            steps: [
                `Obtain a ${baseItem.name}`,
                `Use Harvest "Reforge ${harvestType}" craft`,
                `This guarantees at least one ${harvestType} mod while rerolling all other mods`,
                `Expected attempts: ${expectedAttempts}`,
                `💡 Harvest crafts can be bought from TFT or found in Sacred Grove`
            ],
            expectedAttempts
        };
    }
    /**
     * Calculate Veiled Chaos method (Aisling crafting)
     * Adds a veiled mod that can be unveiled for powerful crafts
     */
    async calculateVeiledChaos(desiredMods, baseItem, league) {
        // Veiled chaos is mainly useful for specific unveil-able mods
        // For now, return null unless we can determine veiled mods are desired
        // This would require additional data about which mods are unveil-able
        const veiledPrice = this.currencyService.getPrice('Veiled Chaos Orb');
        // Simplified: only recommend if looking for 1-2 specific mods
        if (desiredMods.length > 2)
            return null;
        // Check if any desired mods match common veiled mod patterns
        const veiledModPatterns = ['quality', 'non-channelling', 'gain', 'trigger'];
        const hasVeiledMod = desiredMods.some(mod => veiledModPatterns.some(pattern => mod.name.toLowerCase().includes(pattern)));
        if (!hasVeiledMod)
            return null;
        const expectedAttempts = 15; // Average attempts to get desired veiled mod
        const averageCost = expectedAttempts * veiledPrice;
        return {
            method: 'veiled',
            name: 'Veiled Chaos Orb (Aisling)',
            description: 'Use Veiled Chaos Orb to add veiled modifier',
            probability: 1 / expectedAttempts,
            averageCost,
            currencyUsed: {
                'Veiled Chaos Orb': expectedAttempts
            },
            steps: [
                `Start with a rare ${baseItem.name}`,
                'Use Veiled Chaos Orb to reroll and add a veiled mod',
                'Unveil the mod at Jun to choose from 3 options',
                `Expected attempts: ${expectedAttempts}`,
                '💡 Alternatively, use Aisling in Research for veiled mod'
            ],
            expectedAttempts
        };
    }
    /**
     * Calculate Annulment Orb method
     * Used to remove unwanted mods from an item
     */
    async calculateAnnulment(desiredMods, baseItem, league) {
        // Annulment is useful when you have a good item with 1 unwanted mod
        // This is a risky method, so we only recommend it in specific cases
        // For now, return null as it's situational and requires existing item analysis
        return null;
    }
    /**
     * Calculate Beastcrafting method
     * Uses captured beasts to apply specific crafts
     */
    async calculateBeastcrafting(desiredMods, baseItem, league) {
        // Beast prices from poe.ninja
        const craicicChimeralPrice = this.currencyService.getPrice('Craicic Chimeral');
        const fenumalHybridPrice = this.currencyService.getPrice('Fenumal Hybrid Arachnid');
        // Check if any desired mods match common beast craft patterns
        const modTexts = desiredMods.map(m => m.name.toLowerCase()).join(' ');
        // Imprint beast (Craicic Chimeral) - useful for alt+regal crafting
        if (desiredMods.length <= 2) {
            return {
                method: 'chaos',
                name: 'Beastcraft (Imprint)',
                description: 'Use Craicic Chimeral to create imprint for safe crafting',
                probability: 0.5,
                averageCost: craicicChimeralPrice + 20, // Beast + base crafting cost
                currencyUsed: {
                    'Craicic Chimeral': 1,
                    'Orb of Alteration': 50,
                    'Regal Orb': 2
                },
                steps: [
                    `Start with a magic ${baseItem.name} with desired mod`,
                    'Use Craicic Chimeral to create an imprint',
                    'Use Regal Orb to upgrade to rare',
                    'If bad regal, restore with imprint and try again',
                    'Repeat until good regal, then continue crafting',
                    '💡 This method is great for preserving good magic items'
                ],
                expectedAttempts: 2
            };
        }
        // Split beast (Fenumal Hybrid Arachnid) - duplicates a rare item
        if (modTexts.includes('split')) {
            return {
                method: 'chaos',
                name: 'Beastcraft (Split)',
                description: 'Use Fenumal Hybrid Arachnid to duplicate item',
                probability: 0.5,
                averageCost: fenumalHybridPrice,
                currencyUsed: {
                    'Fenumal Hybrid Arachnid': 1
                },
                steps: [
                    `Start with a rare ${baseItem.name} that has some desired mods`,
                    'Use Fenumal Hybrid Arachnid to split the item',
                    'Both resulting items will have some of the original mods',
                    'This creates two items from one, useful for valuable items',
                    '⚠️ Mods are randomly distributed between the two items'
                ],
                expectedAttempts: 1
            };
        }
        return null;
    }
    /**
     * Helper: Calculate optimal p/s combinations for recombinator crafting
     * Returns suggested prefix/suffix counts for each item
     */
    getOptimalRecombinatorCombination(prefixCount, suffixCount) {
        const totalPrefixes = prefixCount;
        const totalSuffixes = suffixCount;
        // Optimal strategy: Use mod doubling by having overlapping mods
        // For 2 desired mods of same type: 1p/0s + 1p/0s (double the mod)
        // For mixed types: distribute evenly
        let itemA = '';
        let itemB = '';
        if (prefixCount === 2 && suffixCount === 0) {
            // 2 prefixes: Double 1 mod
            itemA = '1p/0s';
            itemB = '1p/0s';
        }
        else if (prefixCount === 0 && suffixCount === 2) {
            // 2 suffixes: Double 1 mod
            itemA = '0p/1s';
            itemB = '0p/1s';
        }
        else if (prefixCount === 1 && suffixCount === 1) {
            // 1p + 1s: Simple combination
            itemA = '1p/0s';
            itemB = '0p/1s';
        }
        else if (prefixCount === 3 && suffixCount === 0) {
            // 3 prefixes: 2p on one, 1p doubled on both
            itemA = '2p/0s';
            itemB = '1p/0s';
        }
        else if (prefixCount === 0 && suffixCount === 3) {
            // 3 suffixes: 2s on one, 1s doubled on both
            itemA = '0p/2s';
            itemB = '0p/1s';
        }
        else if (prefixCount === 2 && suffixCount === 1) {
            // 2p + 1s: Double 1 prefix
            itemA = '1p/1s';
            itemB = '1p/0s';
        }
        else if (prefixCount === 1 && suffixCount === 2) {
            // 1p + 2s: Double 1 suffix
            itemA = '1p/1s';
            itemB = '0p/1s';
        }
        else {
            // Fallback: distribute evenly
            const itemAPrefixes = Math.ceil(prefixCount / 2);
            const itemBPrefixes = prefixCount - itemAPrefixes;
            const itemASuffixes = Math.ceil(suffixCount / 2);
            const itemBSuffixes = suffixCount - itemASuffixes;
            itemA = `${itemAPrefixes}p/${itemASuffixes}s`;
            itemB = `${itemBPrefixes}p/${itemBSuffixes}s`;
        }
        return { itemA, itemB, totalPrefixes, totalSuffixes };
    }
    /**
     * Calculate Recombinator crafting method
     * Combines two items to create one item with mods from both
     *
     * Notation: p = prefix, s = suffix
     * Example: 1p/0s + 2p/1s means Item A has 1 prefix, 0 suffixes
     *          and Item B has 2 prefixes, 1 suffix (3TP/1TS total)
     * Success Rate: Always 1/3 for hitting desired mods
     */
    async calculateRecombinator(desiredMods, baseItem, league) {
        // Recombinators are best for 2-4 desired mods
        if (desiredMods.length < 2 || desiredMods.length > 4) {
            return null;
        }
        // Check if recombinators are available (they were removed after Sentinel league)
        // For now, we'll calculate but note availability
        const recombinatorPrice = this.currencyService.getPrice('Armour Recombinator');
        // Count prefixes and suffixes
        const prefixes = desiredMods.filter(m => m.type === 'prefix');
        const suffixes = desiredMods.filter(m => m.type === 'suffix');
        const prefixCount = prefixes.length;
        const suffixCount = suffixes.length;
        // Success rate is always 1/3 for recombinators
        const successProbability = 1 / 3;
        const expectedAttempts = Math.ceil(1 / successProbability); // = 3
        // Get optimal combination
        const combination = this.getOptimalRecombinatorCombination(prefixCount, suffixCount);
        // Build strategy description using p/s notation
        const strategyNotation = `${combination.itemA} + ${combination.itemB} → ${combination.totalPrefixes}TP/${combination.totalSuffixes}TS`;
        // Build detailed strategy based on desired mods
        let detailedStrategy = '';
        if (prefixCount === 2 && suffixCount === 0) {
            detailedStrategy = `Craft Item A with 1 desired prefix, craft Item B with the SAME prefix (mod doubling). Result: 2TP/0TS`;
        }
        else if (prefixCount === 0 && suffixCount === 2) {
            detailedStrategy = `Craft Item A with 1 desired suffix, craft Item B with the SAME suffix (mod doubling). Result: 0TP/2TS`;
        }
        else if (prefixCount === 1 && suffixCount === 1) {
            detailedStrategy = `Craft Item A with the desired prefix (1p/0s), craft Item B with the desired suffix (0p/1s). Result: 1TP/1TS`;
        }
        else if (prefixCount === 3 && suffixCount === 0) {
            detailedStrategy = `Craft Item A with 2 desired prefixes (2p/0s), craft Item B with 1 of those prefixes doubled (1p/0s). Result: 3TP/0TS`;
        }
        else if (prefixCount === 0 && suffixCount === 3) {
            detailedStrategy = `Craft Item A with 2 desired suffixes (0p/2s), craft Item B with 1 of those suffixes doubled (0p/1s). Result: 0TP/3TS`;
        }
        else if (prefixCount === 2 && suffixCount === 1) {
            detailedStrategy = `Craft Item A with 1 prefix + 1 suffix (1p/1s), craft Item B with 1 prefix doubled (1p/0s). Result: 2TP/1TS`;
        }
        else if (prefixCount === 1 && suffixCount === 2) {
            detailedStrategy = `Craft Item A with 1 prefix + 1 suffix (1p/1s), craft Item B with 1 suffix doubled (0p/1s). Result: 1TP/2TS`;
        }
        else {
            detailedStrategy = `Craft Item A: ${combination.itemA}, craft Item B: ${combination.itemB}. Result: ${combination.totalPrefixes}TP/${combination.totalSuffixes}TS`;
        }
        // Cost calculation: need to craft two base items + recombinator
        const chaosPrice = this.currencyService.getPrice('Chaos Orb');
        const baseCraftCost = 50 * chaosPrice; // Estimate for crafting each base item
        const totalBaseCost = baseCraftCost * 2; // Two items needed
        const recombinatorCost = recombinatorPrice * expectedAttempts;
        const averageCost = totalBaseCost * expectedAttempts + recombinatorCost;
        // Build specific crafting steps with mod names
        const itemAMods = [];
        const itemBMods = [];
        // Distribute mods based on optimal combination
        if (combination.itemA.includes('2p')) {
            itemAMods.push(...prefixes.slice(0, 2).map(p => p.name));
        }
        else if (combination.itemA.includes('1p')) {
            itemAMods.push(prefixes[0]?.name || 'prefix');
        }
        if (combination.itemA.includes('2s')) {
            itemAMods.push(...suffixes.slice(0, 2).map(s => s.name));
        }
        else if (combination.itemA.includes('1s')) {
            itemAMods.push(suffixes[0]?.name || 'suffix');
        }
        if (combination.itemB.includes('2p')) {
            itemBMods.push(...prefixes.slice(0, 2).map(p => p.name));
        }
        else if (combination.itemB.includes('1p')) {
            // Use the same mod for doubling if possible
            itemBMods.push(prefixes[prefixCount > 1 && combination.itemA.includes('1p') ? 0 : Math.min(1, prefixCount - 1)]?.name || 'prefix');
        }
        if (combination.itemB.includes('2s')) {
            itemBMods.push(...suffixes.slice(0, 2).map(s => s.name));
        }
        else if (combination.itemB.includes('1s')) {
            // Use the same mod for doubling if possible
            itemBMods.push(suffixes[suffixCount > 1 && combination.itemA.includes('1s') ? 0 : Math.min(1, suffixCount - 1)]?.name || 'suffix');
        }
        return {
            method: 'harvest', // Using 'harvest' as a catch-all for special methods
            name: `Recombinator (${strategyNotation})`,
            description: `Combine two items to merge their modifiers using mod doubling strategy`,
            probability: successProbability,
            averageCost,
            currencyUsed: {
                [`${baseItem.item_class} Recombinator`]: expectedAttempts,
                'Chaos Orb (for base crafting)': Math.floor(totalBaseCost / chaosPrice) * expectedAttempts
            },
            steps: [
                `⚠️ NOTE: Recombinators were removed after Sentinel league and may not be available`,
                `📊 Strategy: ${strategyNotation}`,
                `💡 ${detailedStrategy}`,
                ``,
                `Crafting Steps:`,
                `1. Craft Item A (${combination.itemA}): ${baseItem.name} with [${itemAMods.join(', ')}]`,
                `   • Use Essence/Alteration spam to hit these mods`,
                ``,
                `2. Craft Item B (${combination.itemB}): ${baseItem.name} with [${itemBMods.join(', ')}]`,
                `   • ${itemAMods.some(mod => itemBMods.includes(mod)) ? '⭐ Double one mod from Item A for higher success rate!' : 'Use Essence/Alteration spam to hit these mods'}`,
                ``,
                `3. Use ${baseItem.item_class} Recombinator to combine both items`,
                `   • The recombinator will randomly select mods from both items`,
                `   • Success rate: 1/3 (always)`,
                `   • Expected attempts: ${expectedAttempts}`,
                ``,
                `💡 MOD DOUBLING TIP: Having the same mod on both items does NOT increase your chance`,
                `   but it does increase the pool size, giving you more total affixes to work with`,
                ``,
                `Result: ${combination.totalPrefixes}TP/${combination.totalSuffixes}TS total affixes across both items`
            ],
            expectedAttempts
        };
    }
    /**
     * Helper: Determine harvest craft type based on desired mods
     */
    getHarvestTypeForMods(desiredMods) {
        const modTexts = desiredMods.map(m => m.name.toLowerCase()).join(' ');
        // Map common mod types to harvest craft types
        if (modTexts.includes('life') || modTexts.includes('mana'))
            return 'Life';
        if (modTexts.includes('fire') || modTexts.includes('cold') || modTexts.includes('lightning'))
            return 'Elemental';
        if (modTexts.includes('physical') || modTexts.includes('attack'))
            return 'Physical';
        if (modTexts.includes('chaos') || modTexts.includes('poison'))
            return 'Chaos';
        if (modTexts.includes('crit') || modTexts.includes('spell'))
            return 'Caster';
        if (modTexts.includes('speed') || modTexts.includes('attack'))
            return 'Speed';
        if (modTexts.includes('armour') || modTexts.includes('evasion') || modTexts.includes('energy shield'))
            return 'Defence';
        return null;
    }
    /**
     * Helper: Calculate probability with custom mod pool
     */
    calculateModProbabilityWithPool(desiredMods, modPool, itemTags) {
        const result = (0, probabilityCalculator_1.calculateWeightedModProbability)(desiredMods, modPool, itemTags);
        return result.successRate;
    }
    /**
     * Calculate probability of hitting desired mods
     */
    calculateModProbability(desiredMods, availableMods, itemTags, magicItem = false) {
        const result = magicItem
            ? (0, probabilityCalculator_1.calculateSimpleModProbability)(desiredMods, availableMods, itemTags, true)
            : (0, probabilityCalculator_1.calculateWeightedModProbability)(desiredMods, availableMods, itemTags);
        return result.successRate;
    }
    /**
     * Find best fossil combination for desired mods
     */
    findBestFossilCombination(desiredMods, baseItem, fossils) {
        // Simplified: try single fossils first
        // In reality, would need to try all combinations up to 4 fossils
        let bestCombination = null;
        let bestProbability = 0;
        for (const fossil of fossils) {
            const modifiedPool = this.applyFossilModifiers([fossil], baseItem.tags);
            const probability = this.calculateModProbability(desiredMods, modifiedPool, baseItem.tags);
            if (probability > bestProbability) {
                bestProbability = probability;
                bestCombination = {
                    fossils: [fossil.name],
                    resonator: 'Primitive Chaotic Resonator',
                    probability,
                    averageCost: 0 // Will be calculated later
                };
            }
        }
        return bestCombination;
    }
    /**
     * Apply fossil modifiers to mod pool
     */
    applyFossilModifiers(fossils, itemTags) {
        // Simplified implementation
        // In reality, would need to apply weight multipliers and blocked tags
        const allMods = Array.from(this.dataLoader['mods'].values());
        return allMods.filter(mod => mod.domain === 'item');
    }
    /**
     * Get resonator price by type
     */
    getResonatorPrice(resonatorType) {
        const price = this.currencyService.getPrice(resonatorType) || 0;
        if (price)
            return price;
        // Fallback prices
        const resonatorPrices = {
            'Primitive Chaotic Resonator': 0.5,
            'Primitive Alchemical Resonator': 0.7,
            'Potent Chaotic Resonator': 1,
            'Potent Alchemical Resonator': 1.5,
            'Powerful Chaotic Resonator': 2,
            'Powerful Alchemical Resonator': 3,
            'Prime Chaotic Resonator': 5,
            'Prime Alchemical Resonator': 8
        };
        return resonatorPrices[resonatorType] || 1;
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
