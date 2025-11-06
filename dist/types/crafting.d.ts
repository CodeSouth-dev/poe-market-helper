export interface CraftingMaterial {
    name: string;
    quantity: number;
    chaosValue?: number;
}
export interface CraftingMethod {
    name: string;
    description: string;
    materials: CraftingMaterial[];
    averageAttempts?: number;
    successRate?: number;
}
export declare enum CraftingMethodType {
    ALT_SPAM = "alt_spam",
    ESSENCE = "essence",
    FOSSIL = "fossil",
    CHAOS_SPAM = "chaos_spam",
    RECOMBINATOR = "recombinator",
    HARVEST = "harvest",
    VEILED_CHAOS = "veiled_chaos",
    ELDRITCH = "eldritch",
    BENCHCRAFT = "benchcraft"
}
export interface CraftingCost {
    methodType: CraftingMethodType;
    methodName: string;
    totalCost: number;
    breakdown: {
        baseCost: number;
        materialCosts: {
            material: string;
            unitCost: number;
            quantity: number;
            totalCost: number;
        }[];
    };
    expectedAttempts?: number;
}
export interface ProfitabilityAnalysis {
    targetItem: string;
    marketPrice: number;
    bestCraftingMethod: CraftingCost;
    allMethods: CraftingCost[];
    profit: number;
    profitPercentage: number;
    isProfitable: boolean;
    recommendation: 'craft' | 'buy';
}
export declare const COMMON_MATERIALS: {
    'Orb of Alteration': {
        category: string;
        avgChaos: number;
    };
    'Orb of Augmentation': {
        category: string;
        avgChaos: number;
    };
    'Regal Orb': {
        category: string;
        avgChaos: number;
    };
    'Chaos Orb': {
        category: string;
        avgChaos: number;
    };
    'Exalted Orb': {
        category: string;
        avgChaos: number;
    };
    'Divine Orb': {
        category: string;
        avgChaos: number;
    };
    'Orb of Scouring': {
        category: string;
        avgChaos: number;
    };
    'Orb of Alchemy': {
        category: string;
        avgChaos: number;
    };
    'Veiled Chaos Orb': {
        category: string;
        avgChaos: number;
    };
    'Deafening Essence of Greed': {
        category: string;
        avgChaos: number;
    };
    'Deafening Essence of Hatred': {
        category: string;
        avgChaos: number;
    };
    'Deafening Essence of Wrath': {
        category: string;
        avgChaos: number;
    };
    'Deafening Essence of Rage': {
        category: string;
        avgChaos: number;
    };
    'Pristine Fossil': {
        category: string;
        avgChaos: number;
    };
    'Serrated Fossil': {
        category: string;
        avgChaos: number;
    };
    'Jagged Fossil': {
        category: string;
        avgChaos: number;
    };
    'Metallic Fossil': {
        category: string;
        avgChaos: number;
    };
    'Primitive Chaotic Resonator': {
        category: string;
        avgChaos: number;
    };
    'Potent Chaotic Resonator': {
        category: string;
        avgChaos: number;
    };
    'Powerful Chaotic Resonator': {
        category: string;
        avgChaos: number;
    };
    'Sacred Crystallised Lifeforce': {
        category: string;
        avgChaos: number;
    };
    'Wild Crystallised Lifeforce': {
        category: string;
        avgChaos: number;
    };
    'Primal Crystallised Lifeforce': {
        category: string;
        avgChaos: number;
    };
    'Eldritch Chaos Orb': {
        category: string;
        avgChaos: number;
    };
    'Eldritch Exalted Orb': {
        category: string;
        avgChaos: number;
    };
    'Eldritch Orb of Annulment': {
        category: string;
        avgChaos: number;
    };
    'Orb of Annulment': {
        category: string;
        avgChaos: number;
    };
    'Blessed Orb': {
        category: string;
        avgChaos: number;
    };
};
export declare const CRAFTING_METHODS_TEMPLATES: Record<string, Omit<CraftingMethod, 'materials'>>;
