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

    // 5. Exalted Orb slamming (for adding 1-2 specific mods)
    const exaltMethod = await this.calculateExaltedSlam(desiredMods, baseItem, league);
    if (exaltMethod) methods.push(exaltMethod);

    // 6. Harvest Reforge (for targeted rerolling)
    const harvestMethod = await this.calculateHarvestReforge(desiredMods, baseItem, league);
    if (harvestMethod) methods.push(harvestMethod);

    // 7. Veiled Chaos (Aisling) for veiled mods
    const veiledMethod = await this.calculateVeiledChaos(desiredMods, baseItem, league);
    if (veiledMethod) methods.push(veiledMethod);

    // 8. Annulment Orb (for removing unwanted mods)
    const annulMethod = await this.calculateAnnulment(desiredMods, baseItem, league);
    if (annulMethod) methods.push(annulMethod);

    // 9. Beastcrafting (specific beast crafts)
    const beastMethod = await this.calculateBeastcrafting(desiredMods, baseItem, league);
    if (beastMethod) methods.push(beastMethod);

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
   * Calculate Exalted Orb slamming method
   * Used to add 1-2 specific mods to an item with open affixes
   */
  private async calculateExaltedSlam(
    desiredMods: DesiredMod[],
    baseItem: BaseItem,
    league: string
  ): Promise<CraftingMethod | null> {
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
      const matchingMods = availablePrefixes.filter(m =>
        m.name.toLowerCase().includes(prefix.name.toLowerCase())
      );
      if (matchingMods.length === 0) return null;
      probability *= matchingMods.length / availablePrefixes.length;
    }

    for (const suffix of suffixes) {
      const matchingMods = availableSuffixes.filter(m =>
        m.name.toLowerCase().includes(suffix.name.toLowerCase())
      );
      if (matchingMods.length === 0) return null;
      probability *= matchingMods.length / availableSuffixes.length;
    }

    if (probability === 0) return null;

    const exaltPrice = this.currencyPrices.get('Exalted Orb')?.chaosValue || 180;
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
  private async calculateHarvestReforge(
    desiredMods: DesiredMod[],
    baseItem: BaseItem,
    league: string
  ): Promise<CraftingMethod | null> {
    // Determine harvest type based on desired mods
    const harvestType = this.getHarvestTypeForMods(desiredMods);
    if (!harvestType) return null;

    const availableMods = this.dataLoader.getModsForItemClass(baseItem.item_class, baseItem.tags);

    // Harvest reforge narrows the mod pool to specific types
    const harvestModPool = availableMods.filter(mod => {
      // Simplified: filter mods that match the harvest type
      const modName = mod.name.toLowerCase();
      return modName.includes(harvestType.toLowerCase());
    });

    if (harvestModPool.length === 0) return null;

    // Calculate probability with narrowed pool
    const probability = this.calculateModProbabilityWithPool(desiredMods, harvestModPool, baseItem.tags);

    if (probability === 0) return null;

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
  private async calculateVeiledChaos(
    desiredMods: DesiredMod[],
    baseItem: BaseItem,
    league: string
  ): Promise<CraftingMethod | null> {
    // Veiled chaos is mainly useful for specific unveil-able mods
    // For now, return null unless we can determine veiled mods are desired
    // This would require additional data about which mods are unveil-able

    const veiledPrice = this.currencyPrices.get('Veiled Chaos Orb')?.chaosValue || 50;

    // Simplified: only recommend if looking for 1-2 specific mods
    if (desiredMods.length > 2) return null;

    // Check if any desired mods match common veiled mod patterns
    const veiledModPatterns = ['quality', 'non-channelling', 'gain', 'trigger'];
    const hasVeiledMod = desiredMods.some(mod =>
      veiledModPatterns.some(pattern => mod.name.toLowerCase().includes(pattern))
    );

    if (!hasVeiledMod) return null;

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
  private async calculateAnnulment(
    desiredMods: DesiredMod[],
    baseItem: BaseItem,
    league: string
  ): Promise<CraftingMethod | null> {
    // Annulment is useful when you have a good item with 1 unwanted mod
    // This is a risky method, so we only recommend it in specific cases
    // For now, return null as it's situational and requires existing item analysis
    return null;
  }

  /**
   * Calculate Beastcrafting method
   * Uses captured beasts to apply specific crafts
   */
  private async calculateBeastcrafting(
    desiredMods: DesiredMod[],
    baseItem: BaseItem,
    league: string
  ): Promise<CraftingMethod | null> {
    // Beast prices from poe.ninja
    const craicicChimeralPrice = this.currencyPrices.get('Craicic Chimeral')?.chaosValue || 30;
    const fenumalHybridPrice = this.currencyPrices.get('Fenumal Hybrid Arachnid')?.chaosValue || 15;

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
   * Helper: Determine harvest craft type based on desired mods
   */
  private getHarvestTypeForMods(desiredMods: DesiredMod[]): string | null {
    const modTexts = desiredMods.map(m => m.name.toLowerCase()).join(' ');

    // Map common mod types to harvest craft types
    if (modTexts.includes('life') || modTexts.includes('mana')) return 'Life';
    if (modTexts.includes('fire') || modTexts.includes('cold') || modTexts.includes('lightning')) return 'Elemental';
    if (modTexts.includes('physical') || modTexts.includes('attack')) return 'Physical';
    if (modTexts.includes('chaos') || modTexts.includes('poison')) return 'Chaos';
    if (modTexts.includes('crit') || modTexts.includes('spell')) return 'Caster';
    if (modTexts.includes('speed') || modTexts.includes('attack')) return 'Speed';
    if (modTexts.includes('armour') || modTexts.includes('evasion') || modTexts.includes('energy shield')) return 'Defence';

    return null;
  }

  /**
   * Helper: Calculate probability with custom mod pool
   */
  private calculateModProbabilityWithPool(
    desiredMods: DesiredMod[],
    modPool: Mod[],
    itemTags: string[]
  ): number {
    const prefixes = desiredMods.filter(m => m.type === 'prefix');
    const suffixes = desiredMods.filter(m => m.type === 'suffix');

    const availablePrefixes = modPool.filter(m => m.type === 'prefix');
    const availableSuffixes = modPool.filter(m => m.type === 'suffix');

    if (availablePrefixes.length === 0 || availableSuffixes.length === 0) {
      return 0;
    }

    let probability = 1;

    for (const prefix of prefixes) {
      const matchingMods = availablePrefixes.filter(m =>
        m.name.toLowerCase().includes(prefix.name.toLowerCase())
      );
      if (matchingMods.length === 0) return 0;
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
