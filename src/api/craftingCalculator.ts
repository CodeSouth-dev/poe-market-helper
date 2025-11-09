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
import { craftOfExileScraper } from '../craftOfExileScraper';
import { PoeNinjaAPI } from './poeNinja';
import { getCurrencyPriceService } from '../services/currencyPriceService';
import { calculateSimpleModProbability, calculateWeightedModProbability } from '../utils/probabilityCalculator';
import { CURRENCY_COSTS, MOD_LIMITS, HARVEST_COSTS, RECOMBINATOR_COSTS } from '../config/craftingConstants';

/**
 * Core crafting calculation engine
 * Calculates probabilities and costs for different crafting methods
 * Now uses live PoEDB scraping and CraftOfExile simulator for accurate probabilities
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

    const itemLevelData = await poedbScraper.getBestIlvlForMods(itemClass, desiredMods.map(m => m.name));
    const itemLevel = itemLevelData.recommendedIlvl;

    console.log(`\n🎲 Running CraftOfExile simulations for ${baseItemName} (ilvl ${itemLevel})...`);

    // Use CraftOfExile simulator to get accurate probabilities
    const methods: CraftingMethod[] = [];
    const modNames = desiredMods.map(m => m.name);

    try {
      // Run simulations for different methods in parallel
      const [chaosSimulation, altRegalSimulation, fossilSimulation, essenceSimulation] = await Promise.all([
        craftOfExileScraper.simulateCrafting(baseItemName, itemLevel, modNames, 'chaos'),
        craftOfExileScraper.simulateCrafting(baseItemName, itemLevel, modNames, 'alt-regal'),
        craftOfExileScraper.simulateCrafting(baseItemName, itemLevel, modNames, 'fossil'),
        craftOfExileScraper.simulateCrafting(baseItemName, itemLevel, modNames, 'essence')
      ]);

      // Convert CraftOfExile results to our CraftingMethod format
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

      if (fossilSimulation.cheapestMethod && fossilSimulation.cheapestMethod.averageCost > 0) {
        methods.push({
          method: 'fossil',
          name: fossilSimulation.cheapestMethod.name,
          description: fossilSimulation.cheapestMethod.description || 'Use targeted fossils to force desired mods',
          probability: fossilSimulation.cheapestMethod.successRate,
          averageCost: fossilSimulation.cheapestMethod.averageCost,
          currencyUsed: { 'Fossils': fossilSimulation.cheapestMethod.averageAttempts },
          steps: [
            'Identify which fossils weight your desired mods',
            `Spam fossils on ${baseItemName} (ilvl ${itemLevel})`,
            `Expected attempts: ${fossilSimulation.cheapestMethod.averageAttempts}`,
            `Success rate: ${(fossilSimulation.cheapestMethod.successRate * 100).toFixed(2)}%`,
            'Finish with bench crafts'
          ],
          expectedAttempts: fossilSimulation.cheapestMethod.averageAttempts
        });
      }

      if (essenceSimulation.cheapestMethod && essenceSimulation.cheapestMethod.averageCost > 0) {
        methods.push({
          method: 'essence',
          name: essenceSimulation.cheapestMethod.name,
          description: essenceSimulation.cheapestMethod.description || 'Use essences to guarantee specific mods',
          probability: essenceSimulation.cheapestMethod.successRate,
          averageCost: essenceSimulation.cheapestMethod.averageCost,
          currencyUsed: { 'Essence': essenceSimulation.cheapestMethod.averageAttempts },
          steps: [
            'Find the appropriate essence for your desired mod',
            `Spam essences on ${baseItemName} (ilvl ${itemLevel})`,
            `Expected attempts: ${essenceSimulation.cheapestMethod.averageAttempts}`,
            `Success rate: ${(essenceSimulation.cheapestMethod.successRate * 100).toFixed(2)}%`,
            'Finish with bench crafts'
          ],
          expectedAttempts: essenceSimulation.cheapestMethod.averageAttempts
        });
      }

      console.log(`✅ Simulations complete. Found ${methods.length} crafting methods.`);
    } catch (error: any) {
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
