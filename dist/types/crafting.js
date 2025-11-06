"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRAFTING_METHODS_TEMPLATES = exports.COMMON_MATERIALS = exports.CraftingMethodType = void 0;
var CraftingMethodType;
(function (CraftingMethodType) {
    CraftingMethodType["ALT_SPAM"] = "alt_spam";
    CraftingMethodType["ESSENCE"] = "essence";
    CraftingMethodType["FOSSIL"] = "fossil";
    CraftingMethodType["CHAOS_SPAM"] = "chaos_spam";
    CraftingMethodType["RECOMBINATOR"] = "recombinator";
    CraftingMethodType["HARVEST"] = "harvest";
    CraftingMethodType["VEILED_CHAOS"] = "veiled_chaos";
    CraftingMethodType["ELDRITCH"] = "eldritch";
    CraftingMethodType["BENCHCRAFT"] = "benchcraft";
})(CraftingMethodType || (exports.CraftingMethodType = CraftingMethodType = {}));
// Common crafting materials database
exports.COMMON_MATERIALS = {
    // Currency
    'Orb of Alteration': { category: 'Currency', avgChaos: 0.1 },
    'Orb of Augmentation': { category: 'Currency', avgChaos: 0.05 },
    'Regal Orb': { category: 'Currency', avgChaos: 0.5 },
    'Chaos Orb': { category: 'Currency', avgChaos: 1 },
    'Exalted Orb': { category: 'Currency', avgChaos: 150 },
    'Divine Orb': { category: 'Currency', avgChaos: 200 },
    'Orb of Scouring': { category: 'Currency', avgChaos: 0.4 },
    'Orb of Alchemy': { category: 'Currency', avgChaos: 0.3 },
    'Veiled Chaos Orb': { category: 'Currency', avgChaos: 3 },
    // Essences (example high-tier)
    'Deafening Essence of Greed': { category: 'Essence', avgChaos: 2 },
    'Deafening Essence of Hatred': { category: 'Essence', avgChaos: 2.5 },
    'Deafening Essence of Wrath': { category: 'Essence', avgChaos: 2.5 },
    'Deafening Essence of Rage': { category: 'Essence', avgChaos: 3 },
    // Fossils
    'Pristine Fossil': { category: 'Fossil', avgChaos: 1 },
    'Serrated Fossil': { category: 'Fossil', avgChaos: 1.5 },
    'Jagged Fossil': { category: 'Fossil', avgChaos: 1.2 },
    'Metallic Fossil': { category: 'Fossil', avgChaos: 2 },
    // Resonators
    'Primitive Chaotic Resonator': { category: 'Resonator', avgChaos: 0.5 },
    'Potent Chaotic Resonator': { category: 'Resonator', avgChaos: 1 },
    'Powerful Chaotic Resonator': { category: 'Resonator', avgChaos: 2 },
    // Harvest
    'Sacred Crystallised Lifeforce': { category: 'Currency', avgChaos: 15 },
    'Wild Crystallised Lifeforce': { category: 'Currency', avgChaos: 12 },
    'Primal Crystallised Lifeforce': { category: 'Currency', avgChaos: 10 },
    // Eldritch
    'Eldritch Chaos Orb': { category: 'Currency', avgChaos: 2 },
    'Eldritch Exalted Orb': { category: 'Currency', avgChaos: 20 },
    'Eldritch Orb of Annulment': { category: 'Currency', avgChaos: 5 },
    // Other
    'Orb of Annulment': { category: 'Currency', avgChaos: 5 },
    'Blessed Orb': { category: 'Currency', avgChaos: 0.2 },
};
// Predefined crafting method templates
exports.CRAFTING_METHODS_TEMPLATES = {
    alt_spam: {
        name: 'Alteration Spam',
        description: 'Use Alterations and Augmentations to roll desired mods on a magic item',
        averageAttempts: 50, // User can override
    },
    essence: {
        name: 'Essence Crafting',
        description: 'Use essences to guarantee specific mods',
        averageAttempts: 10,
    },
    fossil: {
        name: 'Fossil Crafting',
        description: 'Use fossils and resonators to weight specific mod types',
        averageAttempts: 15,
    },
    chaos_spam: {
        name: 'Chaos Spam',
        description: 'Spam Chaos Orbs until desired mods appear',
        averageAttempts: 100,
    },
    recombinator: {
        name: 'Recombinator',
        description: 'Combine two items to create a new item with mixed mods',
        averageAttempts: 1, // Usually one attempt
    },
    harvest: {
        name: 'Harvest Reforge',
        description: 'Use Harvest crafts to reforge with specific modifiers',
        averageAttempts: 20,
    },
};
//# sourceMappingURL=crafting.js.map