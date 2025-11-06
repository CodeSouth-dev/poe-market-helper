import { DesiredMod, CraftingResult } from '../types/crafting';
/**
 * Core crafting calculation engine
 * Calculates probabilities and costs for different crafting methods
 */
export declare class CraftingCalculator {
    private dataLoader;
    private poeNinja;
    private currencyPrices;
    constructor();
    /**
     * Initialize the calculator by loading data
     */
    initialize(league: string): Promise<void>;
    /**
     * Load currency prices from poe.ninja
     */
    private loadCurrencyPrices;
    /**
     * Main method: Calculate best crafting method for desired mods
     */
    calculateBestMethod(desiredMods: DesiredMod[], baseItemName: string, itemClass: string, league: string): Promise<CraftingResult>;
    /**
     * Calculate chaos spam method
     */
    private calculateChaosSpam;
    /**
     * Calculate fossil crafting method
     */
    private calculateFossilCrafting;
    /**
     * Calculate essence crafting method
     */
    private calculateEssenceCrafting;
    /**
     * Calculate alteration spam method
     */
    private calculateAlterationSpam;
    /**
     * Calculate probability of hitting desired mods
     */
    private calculateModProbability;
    /**
     * Find best fossil combination for desired mods
     */
    private findBestFossilCombination;
    /**
     * Apply fossil modifiers to mod pool
     */
    private applyFossilModifiers;
    /**
     * Get resonator price by type
     */
    private getResonatorPrice;
    /**
     * Recommend best base type to purchase
     */
    private recommendBaseType;
    /**
     * Format cost for display
     */
    formatCost(chaosValue: number, preferredCurrency?: 'chaos' | 'divine'): string;
}
