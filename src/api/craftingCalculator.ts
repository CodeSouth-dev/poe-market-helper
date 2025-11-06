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
import { getCraftingDataLoader } from './craftingData';
import { PoeNinjaAPI } from './poeNinja';

/**
 * Core crafting calculation engine
 * Calculates probabilities and costs for different crafting methods
 */
export class CraftingCalculator {
  private dataLoader = getCraftingDataLoader();
  private poeNinja = new PoeNinjaAPI();
  private currencyPrices: Map<string, CurrencyPrice> = new Map();

  constructor() {}

  /**
   * Initialize the calculator by loading data
   */
  async initialize(league: string): Promise<void> {
    await this.dataLoader.loadAll();
    await this.loadCurrencyPrices(league);
  }

  /**
   * Load currency prices from poe.ninja
   */
  private async loadCurrencyPrices(league: string): Promise<void> {
    try {
      const result = await this.poeNinja.searchCategory('', league, 'Currency');

      for (const item of result) {
        this.currencyPrices.set(item.name, {
          name: item.name,
          chaosValue: item.chaosValue,
          divineValue: item.divineValue,
          count: item.count,
          listingCount: item.listingCount
        });
      }

      // Also load fossils, essences, and other crafting currency
      const fossilResult = await this.poeNinja.searchCategory('', league, 'Fossil');
      for (const item of fossilResult) {
        this.currencyPrices.set(item.name, {
          name: item.name,
          chaosValue: item.chaosValue,
          divineValue: item.divineValue,
          count: item.count,
          listingCount: item.listingCount
        });
      }

      const essenceResult = await this.poeNinja.searchCategory('', league, 'Essence');
      for (const item of essenceResult) {
        this.currencyPrices.set(item.name, {
          name: item.name,
          chaosValue: item.chaosValue,
          divineValue: item.divineValue,
          count: item.count,
          listingCount: item.listingCount
        });
      }

      console.log(`Loaded ${this.currencyPrices.size} currency prices`);
    } catch (error) {
      console.error('Error loading currency prices:', error);
    }
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
    if (!this.dataLoader.isLoaded()) {
      await this.initialize(league);
    }

    const baseItem = this.dataLoader.getBaseItem(baseItemName);
    if (!baseItem) {
      throw new Error(`Base item not found: ${baseItemName}`);
    }

    // Calculate different methods
    const methods: CraftingMethod[] = [];

    // 1. Chaos spam
    const chaosMethod = await this.calculateChaosSpam(desiredMods, baseItem, league);
    if (chaosMethod) methods.push(chaosMethod);

    // 2. Fossil crafting
    const fossilMethod = await this.calculateFossilCrafting(desiredMods, baseItem, league);
    if (fossilMethod) methods.push(fossilMethod);

    // 3. Essence crafting
    const essenceMethod = await this.calculateEssenceCrafting(desiredMods, baseItem, itemClass, league);
    if (essenceMethod) methods.push(essenceMethod);

    // 4. Alteration spam
    const alterationMethod = await this.calculateAlterationSpam(desiredMods, baseItem, league);
    if (alterationMethod) methods.push(alterationMethod);

    // Sort by cost
    methods.sort((a, b) => a.averageCost - b.averageCost);

    const bestMethod = methods[0];
    const baseRecommendation = await this.recommendBaseType(desiredMods, baseItemName, itemClass, league, bestMethod);

    const totalCostChaos = baseRecommendation.averageCost + bestMethod.averageCost;
    const divinePrice = this.currencyPrices.get('Divine Orb')?.chaosValue || 200;
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
  private async calculateChaosSpam(
    desiredMods: DesiredMod[],
    baseItem: BaseItem,
    league: string
  ): Promise<CraftingMethod | null> {
    const availableMods = this.dataLoader.getModsForItemClass(baseItem.item_class, baseItem.tags);

    const probability = this.calculateModProbability(desiredMods, availableMods, baseItem.tags);

    if (probability === 0) {
      return null;
    }

    const chaosPrice = this.currencyPrices.get('Chaos Orb')?.chaosValue || 1;
    const expectedAttempts = Math.ceil(1 / probability);
    const averageCost = expectedAttempts * chaosPrice;

    return {
      method: 'chaos',
      name: 'Chaos Spam',
      description: `Use Chaos Orbs to reroll the item until desired mods are hit`,
      probability,
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
  private async calculateFossilCrafting(
    desiredMods: DesiredMod[],
    baseItem: BaseItem,
    league: string
  ): Promise<CraftingMethod | null> {
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
      const price = this.currencyPrices.get(fossilName)?.chaosValue || 1;
      return total + price;
    }, 0);

    const resonatorPrice = this.getResonatorPrice(bestCombination.resonator);
    const costPerAttempt = fossilCost + resonatorPrice;
    const expectedAttempts = Math.ceil(1 / bestCombination.probability);
    const averageCost = expectedAttempts * costPerAttempt;

    const currencyUsed: Record<string, number> = {};
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
  private async calculateEssenceCrafting(
    desiredMods: DesiredMod[],
    baseItem: BaseItem,
    itemClass: string,
    league: string
  ): Promise<CraftingMethod | null> {
    const essences = this.dataLoader.getEssencesForItemClass(itemClass);

    // Find if any essence guarantees one of our desired mods
    let bestEssence: Essence | null = null;
    let guaranteedMod: DesiredMod | null = null;

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
      if (bestEssence) break;
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

    const essencePrice = this.currencyPrices.get(bestEssence.name)?.chaosValue || 1;
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
  private async calculateAlterationSpam(
    desiredMods: DesiredMod[],
    baseItem: BaseItem,
    league: string
  ): Promise<CraftingMethod | null> {
    // Alteration spam is mainly useful for 1-2 mod items
    if (desiredMods.length > 2) {
      return null;
    }

    const availableMods = this.dataLoader.getModsForItemClass(baseItem.item_class, baseItem.tags);
    const probability = this.calculateModProbability(desiredMods, availableMods, baseItem.tags, true);

    if (probability === 0) {
      return null;
    }

    const alterationPrice = this.currencyPrices.get('Orb of Alteration')?.chaosValue || 0.1;
    const augmentPrice = this.currencyPrices.get('Orb of Augmentation')?.chaosValue || 0.05;

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
   * Calculate probability of hitting desired mods
   */
  private calculateModProbability(
    desiredMods: DesiredMod[],
    availableMods: Mod[],
    itemTags: string[],
    magicItem: boolean = false
  ): number {
    // Simplified probability calculation
    // In reality, this is more complex with weighted pools

    const prefixes = desiredMods.filter(m => m.type === 'prefix');
    const suffixes = desiredMods.filter(m => m.type === 'suffix');

    const availablePrefixes = availableMods.filter(m => m.type === 'prefix');
    const availableSuffixes = availableMods.filter(m => m.type === 'suffix');

    if (availablePrefixes.length === 0 || availableSuffixes.length === 0) {
      return 0;
    }

    // For magic items (alteration), max 1 prefix and 1 suffix
    const maxPrefixes = magicItem ? 1 : 3;
    const maxSuffixes = magicItem ? 1 : 3;

    if (prefixes.length > maxPrefixes || suffixes.length > maxSuffixes) {
      return 0;
    }

    // Simplified probability calculation
    // Real calculation would involve weighted pools and tag interactions
    let probability = 1;

    for (const prefix of prefixes) {
      const matchingMods = availablePrefixes.filter(m =>
        m.name.toLowerCase().includes(prefix.name.toLowerCase())
      );
      if (matchingMods.length === 0) return 0;

      // Simplified: assume equal weights
      probability *= matchingMods.length / availablePrefixes.length;
    }

    for (const suffix of suffixes) {
      const matchingMods = availableSuffixes.filter(m =>
        m.name.toLowerCase().includes(suffix.name.toLowerCase())
      );
      if (matchingMods.length === 0) return 0;

      probability *= matchingMods.length / availableSuffixes.length;
    }

    return probability;
  }

  /**
   * Find best fossil combination for desired mods
   */
  private findBestFossilCombination(
    desiredMods: DesiredMod[],
    baseItem: BaseItem,
    fossils: Fossil[]
  ): FossilCombination | null {
    // Simplified: try single fossils first
    // In reality, would need to try all combinations up to 4 fossils

    let bestCombination: FossilCombination | null = null;
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
  private applyFossilModifiers(fossils: Fossil[], itemTags: string[]): Mod[] {
    // Simplified implementation
    // In reality, would need to apply weight multipliers and blocked tags
    const allMods = Array.from(this.dataLoader['mods'].values());
    return allMods.filter(mod => mod.domain === 'item');
  }

  /**
   * Get resonator price by type
   */
  private getResonatorPrice(resonatorType: string): number {
    const price = this.currencyPrices.get(resonatorType)?.chaosValue;
    if (price) return price;

    // Fallback prices
    const resonatorPrices: Record<string, number> = {
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
    const divinePrice = this.currencyPrices.get('Divine Orb')?.chaosValue || 200;

    if (preferredCurrency === 'divine' || chaosValue >= divinePrice * 2) {
      const divineValue = chaosValue / divinePrice;
      return `${divineValue.toFixed(2)} Divine`;
    }

    return `${chaosValue.toFixed(1)} Chaos`;
  }
}
