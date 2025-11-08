import {
  DesiredMod,
  CraftingMethod,
  CraftingResult,
  FossilCombination,
  Mod,
  Fossil,
  Essence,
  BaseItem,
  CurrencyPrice,
  BaseRecommendation
} from '../types/crafting';
import { poedbScraper } from '../poedbScraper';
import { PoeNinjaAPI } from './poeNinja';
import { getCurrencyPriceService } from '../services/currencyPriceService';
import { calculateSimpleModProbability, calculateWeightedModProbability } from '../utils/probabilityCalculator';
import { CURRENCY_COSTS, MOD_LIMITS, HARVEST_COSTS, RECOMBINATOR_COSTS } from '../config/craftingConstants';

/**
 * Core crafting calculation engine
 * Calculates probabilities and costs for different crafting methods
 * Now uses live PoEDB scraping instead of static RePoE data
 */
export class CraftingCalculator {
  private currencyService = getCurrencyPriceService();
  private poeNinja = new PoeNinjaAPI();

  constructor() {}

  /**
   * Initialize the calculator by loading data
   */
  async initialize(league: string): Promise<void> {
    await this.currencyService.loadPrices(league);
  }

  /**
   * Main method: Calculate best crafting method for desired mods
   */
  async calculateBestMethod(
    desiredMods: DesiredMod[],
    baseItemName: string,
    itemClass: string,
    league: string
  ): Promise<CraftingResult> {
    await this.initialize(league);

    // Get base item data from PoEDB
    const baseItems = await poedbScraper.scrapeBaseItems(itemClass);
    const baseItem = baseItems.find(item =>
      item.name.toLowerCase() === baseItemName.toLowerCase()
    );

    if (!baseItem) {
      // If not found, create a minimal base item object
      console.warn(`Base item "${baseItemName}" not found in PoEDB, using defaults`);
    }

    // TODO: Refactor remaining methods to use live PoEDB data instead of RePoE
    // For now, return simplified methods based on desired mod count
    const methods: CraftingMethod[] = [];

    // Simplified method recommendations based on mod count
    const modCount = desiredMods.length;
    const chaosPrice = this.currencyService.getPrice('Chaos Orb');

    if (modCount <= 2) {
      methods.push({
        method: 'alteration',
        name: 'Alt-Regal Method',
        description: 'Alt spam for desired mods, then regal',
        probability: 0.3,
        averageCost: 50 * chaosPrice,
        currencyUsed: { 'Orb of Alteration': 100, 'Regal Orb': 1 },
        steps: [
          `Spam Orbs of Alteration on ${baseItemName}`,
          'When you hit desired mods, use Regal Orb',
          'Craft remaining affixes on bench'
        ],
        expectedAttempts: 100
      });
    }

    methods.push({
      method: 'chaos',
      name: 'Chaos Spam',
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
  // REMOVED: All RePoE-dependent calculation methods have been removed.
  // TODO: Reimplement using live PoEDB scraping (poedbScraper)
  // Methods that need reimplementation:
  // - calculateChaosSpam, calculateFossilCrafting, calculateEssenceCrafting  
  // - calculateAlterationSpam, calculateExaltedSlam, calculateHarvestReforge
  // - calculateVeiledChaos, calculateAnnulment, calculateBeastcrafting
  // - calculateRecombinator, and helper methods
  // ============================================================================


  /**
   * Recommend best base type to purchase
   */
  private async recommendBaseType(
    desiredMods: DesiredMod[],
    baseItemName: string,
    itemClass: string,
    league: string,
    craftingMethod: CraftingMethod
  ): Promise<BaseRecommendation> {
    // Check prices for different base types
    const recommendations: BaseRecommendation[] = [];

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
    } catch (error) {
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
  formatCost(chaosValue: number, preferredCurrency: 'chaos' | 'divine' = 'chaos'): string {
    const divinePrice = this.currencyService.getPrice('Divine Orb');

    if (preferredCurrency === 'divine' || chaosValue >= divinePrice * 2) {
      const divineValue = chaosValue / divinePrice;
      return `${divineValue.toFixed(2)} Divine`;
    }

    return `${chaosValue.toFixed(1)} Chaos`;
  }
}
