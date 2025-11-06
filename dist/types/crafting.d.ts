export interface ModWeight {
    tag: string;
    weight: number;
}
export interface Fossil {
    name: string;
    added_mods: string[];
    allowed_tags: string[];
    forbidden_tags: string[];
    forced_mods: string[];
    positive_mod_weights: ModWeight[];
    negative_mod_weights: ModWeight[];
    blocked_descriptions: string[];
    descriptions: string[];
    corrupted_essence_chance: number;
    rolls_lucky: boolean;
    rolls_white_sockets: boolean;
}
export interface Essence {
    name: string;
    level: number;
    item_level_restriction: number | null;
    spawn_level_min: number;
    spawn_level_max: number;
    mods: Record<string, string>;
    type: {
        tier: number;
        is_corruption_only: boolean;
    };
}
export interface ModSpawnWeight {
    tag: string;
    weight: number;
}
export interface ModStat {
    id: string;
    min: number;
    max: number;
}
export interface Mod {
    name: string;
    domain: string;
    generation_type: string;
    required_level: number;
    type: string;
    spawn_weights: ModSpawnWeight[];
    adds_tags: string[];
    stats: ModStat[];
    is_essence_only?: boolean;
}
export interface BaseItem {
    name: string;
    item_class: string;
    tags: string[];
    domain: string;
    release_state: string;
    drop_enabled: boolean;
    required_level?: number;
    implicits?: string[];
}
export interface CraftingBenchOption {
    id: string;
    name: string;
    item_classes: string[];
    mod_id: string;
    cost: Array<{
        name: string;
        amount: number;
    }>;
    required_level: number;
    is_suffix?: boolean;
    is_prefix?: boolean;
}
export interface DesiredMod {
    name: string;
    type: 'prefix' | 'suffix';
    tier?: number;
    weight?: number;
}
export interface CraftingMethod {
    method: 'chaos' | 'fossil' | 'essence' | 'alteration' | 'bench' | 'harvest' | 'veiled';
    name: string;
    description: string;
    probability: number;
    averageCost: number;
    currencyUsed: Record<string, number>;
    steps: string[];
    expectedAttempts: number;
}
export interface FossilCombination {
    fossils: string[];
    resonator: string;
    probability: number;
    averageCost: number;
}
export interface BaseRecommendation {
    baseType: string;
    itemName: string;
    reason: string;
    averageCost: number;
    savings?: number;
    searchQuery?: string;
}
export interface CraftingResult {
    desiredMods: DesiredMod[];
    baseItem: string;
    itemClass: string;
    league: string;
    methods: CraftingMethod[];
    bestMethod: CraftingMethod;
    baseRecommendation: BaseRecommendation;
    alternativeBases?: BaseRecommendation[];
    warnings?: string[];
    totalCostChaos: number;
    totalCostDivine?: number;
    preferredCurrency: 'chaos' | 'divine';
}
export interface CurrencyPrice {
    name: string;
    chaosValue: number;
    divineValue?: number;
    count?: number;
    listingCount?: number;
}
export interface CraftingStep {
    stepNumber: number;
    action: string;
    cost: string;
    probability?: string;
}
export interface CraftingMethodDisplay {
    method: string;
    totalCost: string;
    successRate: string;
    steps: CraftingStep[];
    isRecommended: boolean;
}
