/**
 * Enhanced Craft of Exile Simulator Integration
 *
 * This module provides deep integration with craftofexile.com's simulator to:
 * - Extract complete crafting STRATEGIES (not just probabilities)
 * - Implement mod blocking using fossils
 * - Generate step-by-step crafting plans with bench crafts
 * - Optimize for budget-based "perfect outcomes"
 * - Cache all strategies for fast lookups
 *
 * The simulator provides PRACTICES, not just information.
 */

import { browserManager } from './browserManager';
import { RateLimiter } from './rateLimiter';
import * as fs from 'fs-extra';
import * as path from 'path';

const CACHE_DIR = path.join(__dirname, '../data/craftofexile-strategies');
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days (strategies don't change often)

// Rate limiter for craftofexile.com
const rateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000,
  minDelay: 2000,
  maxConcurrent: 1, // Only 1 concurrent to avoid overloading
  retryAttempts: 3,
  retryDelayMs: 3000
});

const SESSION_ID = 'craft-of-exile-simulator';

/**
 * Complete crafting strategy extracted from Craft of Exiles simulator
 */
export interface CraftingStrategy {
  baseItem: string;
  itemLevel: number;
  desiredMods: string[];
  blockedMods?: string[]; // Mods to block using fossils or other methods

  // Primary method
  method: string;
  methodType: 'chaos' | 'alt-regal' | 'fossil' | 'essence' | 'harvest' | 'metacraft';

  // Step-by-step practice
  steps: CraftingStep[];

  // Economics
  averageCost: number; // in chaos
  averageAttempts: number;
  successRate: number; // probability per attempt (0.0 to 1.0)
  currencyBreakdown: Array<{
    currency: string;
    amount: number;
    costPerUnit: number;
    totalCost: number;
  }>;

  // Metadata
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  estimatedTime: string;
  warnings: string[];
  tips: string[];
}

/**
 * Individual crafting step with specific actions
 */
export interface CraftingStep {
  stepNumber: number;
  action: string; // "Use Chaos Orb", "Craft 'Suffixes Cannot Be Changed'", etc.
  actionType: 'currency' | 'bench' | 'harvest' | 'fossil' | 'essence' | 'check';
  details: string;
  cost?: number;

  // Optional: What to look for after this step
  expectedOutcome?: string;
  stopCondition?: string; // "When you hit +1 to Level of Socketed Gems"
}

/**
 * Fossil combination recommendation for mod blocking
 */
export interface FossilCombination {
  fossils: string[];
  blockedTags: string[]; // e.g., ['life', 'mana'] to block life/mana mods
  guaranteedTags: string[]; // e.g., ['caster'] to guarantee caster mods
  resonatorType: string; // "Primitive Chaotic Resonator" (1-socket), etc.
  costPerAttempt: number;
  increaseChanceFor: string[]; // Mods this combo helps hit
}

/**
 * Budget-optimized outcome
 */
export interface BudgetOptimization {
  budget: number;
  achievableMods: string[]; // Which mods from desired list are achievable
  unreachableMods: string[]; // Which mods are too expensive
  recommendedStrategy: CraftingStrategy;
  alternatives: CraftingStrategy[];
  profitPotential?: number; // If crafting for profit
}

export class CraftOfExileSimulatorEnhanced {
  constructor() {
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  }

  /**
   * Get complete crafting strategy from Craft of Exiles simulator
   * This extracts the PRACTICE, not just probabilities
   */
  async getCraftingStrategy(
    baseItem: string,
    itemLevel: number,
    desiredMods: string[],
    blockedMods: string[] = [],
    options: {
      budget?: number;
      preferredMethod?: string;
      allowMetacrafting?: boolean;
    } = {}
  ): Promise<CraftingStrategy> {
    const cacheKey = `strategy-${baseItem}-${itemLevel}-${desiredMods.join('|')}-${blockedMods.join('|')}`;
    const cached = await this.getFromCache<CraftingStrategy>(cacheKey);

    if (cached) {
      console.log(`📦 Using cached crafting strategy for ${baseItem}`);
      return cached;
    }

    console.log(`\n🎯 Generating crafting strategy for ${baseItem} (ilvl ${itemLevel})...`);
    console.log(`   Desired mods: ${desiredMods.join(', ')}`);
    if (blockedMods.length > 0) {
      console.log(`   Blocked mods: ${blockedMods.join(', ')}`);
    }

    return await rateLimiter.execute('craftofexile.com', async () => {
      const page = await browserManager.createPage(SESSION_ID, true);

      try {
        // Navigate to the calculator/simulator
        const url = 'https://www.craftofexile.com/?b=19&m=chaos&i=|2|&ob=both&v=d&a=e&l=a&lg=10&bp=y&as=1&req={}&bld={}&ggt=|&cyl=0';
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        console.log(`   ⏳ Waiting for simulator to load...`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Interact with the actual Craft of Exiles UI
        const strategyData = await page.evaluate(
          async (baseItemName, ilvl, mods, blocked) => {
            // Helper functions
            const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

            const waitForElement = (selector: string, timeout = 10000): Promise<Element | null> => {
              return new Promise((resolve) => {
                const startTime = Date.now();
                const checkElement = () => {
                  const el = document.querySelector(selector);
                  if (el) {
                    resolve(el);
                  } else if (Date.now() - startTime > timeout) {
                    console.error(`Timeout waiting for ${selector}`);
                    resolve(null);
                  } else {
                    setTimeout(checkElement, 200);
                  }
                };
                checkElement();
              });
            };

            const clickElement = async (selector: string, waitTime = 500): Promise<boolean> => {
              const el = document.querySelector(selector) as HTMLElement;
              if (el) {
                el.click();
                await sleep(waitTime);
                return true;
              }
              return false;
            };

            const rightClickElement = async (selector: string, waitTime = 500): Promise<boolean> => {
              const el = document.querySelector(selector) as HTMLElement;
              if (el) {
                const event = new MouseEvent('contextmenu', {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  button: 2
                });
                el.dispatchEvent(event);
                await sleep(waitTime);
                return true;
              }
              return false;
            };

            const typeInput = async (selector: string, text: string, waitTime = 500): Promise<boolean> => {
              const el = document.querySelector(selector) as HTMLInputElement;
              if (el) {
                el.value = '';
                el.focus();
                el.value = text;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                await sleep(waitTime);
                return true;
              }
              return false;
            };

            try {
              console.log('Starting simulator interaction...');

              // Step 1: Select the base item
              // Look for base item selector (usually a dropdown or search)
              const baseSelector = 'input[placeholder*="base" i], input[placeholder*="item" i], .base-select, #baseSelect';
              await waitForElement(baseSelector);
              await typeInput(baseSelector, baseItemName, 1000);

              // Click on first result
              const firstResult = '.item-result:first-child, .base-result:first-child, li:first-child';
              await clickElement(firstResult, 1000);

              // Step 2: Set item level
              const ilvlSelector = 'input[type="number"], input[placeholder*="level" i], #ilvl, .ilvl-input';
              await typeInput(ilvlSelector, ilvl.toString(), 500);

              // Step 3: Add desired mods (LEFT-CLICK to add as requirements)
              for (const mod of mods) {
                console.log(`Adding desired mod: ${mod}`);

                // Search for the mod
                const modSearch = 'input[placeholder*="mod" i], input[placeholder*="search" i], .mod-search';
                await typeInput(modSearch, mod, 800);

                // LEFT-CLICK on the mod to add it as a requirement
                const modResult = `.mod-item:first-child, .modifier:first-child, [data-mod]:first-child`;
                await clickElement(modResult, 500);
              }

              // Step 4: Block undesired mods (RIGHT-CLICK to block)
              if (blocked && blocked.length > 0) {
                for (const blockMod of blocked) {
                  console.log(`Blocking mod: ${blockMod}`);

                  const modSearch = 'input[placeholder*="mod" i], input[placeholder*="search" i], .mod-search';
                  await typeInput(modSearch, blockMod, 800);

                  // RIGHT-CLICK on the mod to block it
                  const modResult = `.mod-item:first-child, .modifier:first-child, [data-mod]:first-child`;
                  await rightClickElement(modResult, 500);
                }
              }

              // Step 5: Wait for calculation to complete
              await sleep(2000);

              // Step 6: Extract results from the UI
              // Look for probability/cost display elements
              const probabilityText = document.querySelector('.probability, .chance, [class*="prob"]')?.textContent || '';
              const costText = document.querySelector('.cost, .average-cost, [class*="cost"]')?.textContent || '';
              const attemptsText = document.querySelector('.attempts, .tries, [class*="attempt"]')?.textContent || '';

              // Try to extract method recommendation
              const methodElements = document.querySelectorAll('.method, .crafting-method, [class*="method"]');
              const methods: any[] = [];

              methodElements.forEach((el, idx) => {
                const methodName = el.querySelector('.name, .method-name')?.textContent?.trim() || `Method ${idx + 1}`;
                const methodCost = el.querySelector('.cost')?.textContent?.trim() || '0';
                const methodChance = el.querySelector('.chance, .probability')?.textContent?.trim() || '0%';

                if (methodName && methodName.length > 0) {
                  methods.push({
                    name: methodName,
                    cost: parseFloat(methodCost.replace(/[^\d.]/g, '')) || 0,
                    chance: parseFloat(methodChance.replace('%', '')) / 100 || 0
                  });
                }
              });

              // Extract fossil recommendations if available
              const fossilElements = document.querySelectorAll('.fossil, [class*="fossil"]');
              const recommendedFossils: string[] = [];
              fossilElements.forEach(el => {
                const fossilName = el.textContent?.trim();
                if (fossilName && fossilName.length > 2) {
                  recommendedFossils.push(fossilName);
                }
              });

              console.log('Extraction complete');

              return {
                probability: parseFloat(probabilityText.replace(/[^\d.]/g, '')) || 0,
                cost: parseFloat(costText.replace(/[^\d.]/g, '')) || 0,
                attempts: parseFloat(attemptsText.replace(/[^\d.]/g, '')) || 0,
                methods,
                recommendedFossils,
                success: true
              };

            } catch (error: any) {
              console.error('Error in simulator interaction:', error);
              return {
                probability: 0,
                cost: 0,
                attempts: 0,
                methods: [],
                recommendedFossils: [],
                success: false,
                error: error.message
              };
            }
          },
          baseItem,
          itemLevel,
          desiredMods,
          blockedMods
        );

        if (!strategyData.success) {
          console.log(`   ⚠️ Simulator interaction failed, using fallback logic`);
          return this.generateFallbackStrategy(baseItem, itemLevel, desiredMods, blockedMods, options);
        }

        // Build the complete strategy from extracted data
        const strategy = this.buildStrategyFromSimulatorData(
          baseItem,
          itemLevel,
          desiredMods,
          blockedMods,
          strategyData,
          options
        );

        // Cache the strategy
        await this.saveToCache(cacheKey, strategy);

        console.log(`   ✅ Strategy generated: ${strategy.method}`);
        console.log(`   📊 Success rate: ${(strategy.successRate * 100).toFixed(2)}%`);
        console.log(`   💰 Average cost: ${strategy.averageCost}c`);

        return strategy;

      } catch (error: any) {
        console.error(`   ❌ Failed to generate strategy:`, error.message);
        return this.generateFallbackStrategy(baseItem, itemLevel, desiredMods, blockedMods, options);
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Build complete strategy from simulator extracted data
   */
  private buildStrategyFromSimulatorData(
    baseItem: string,
    itemLevel: number,
    desiredMods: string[],
    blockedMods: string[],
    simulatorData: any,
    options: any
  ): CraftingStrategy {
    // Determine the best method from simulator results
    const bestMethod = simulatorData.methods && simulatorData.methods.length > 0
      ? simulatorData.methods.sort((a: any, b: any) => a.cost - b.cost)[0]
      : { name: 'Chaos Spam', cost: simulatorData.cost || 100, chance: simulatorData.probability || 0.01 };

    const successRate = bestMethod.chance || simulatorData.probability || 0.01;
    const averageCost = bestMethod.cost || simulatorData.cost || 100;
    const averageAttempts = successRate > 0 ? Math.ceil(1 / successRate) : 100;

    // Generate step-by-step crafting plan
    const steps = this.generateCraftingSteps(
      baseItem,
      itemLevel,
      desiredMods,
      blockedMods,
      bestMethod.name,
      simulatorData.recommendedFossils || []
    );

    // Calculate currency breakdown
    const currencyBreakdown = this.calculateCurrencyBreakdown(bestMethod.name, averageAttempts, averageCost);

    return {
      baseItem,
      itemLevel,
      desiredMods,
      blockedMods,
      method: bestMethod.name,
      methodType: this.mapMethodToType(bestMethod.name),
      steps,
      averageCost,
      averageAttempts,
      successRate,
      currencyBreakdown,
      difficulty: this.assessDifficulty(desiredMods.length, blockedMods.length, bestMethod.name),
      estimatedTime: this.estimateTime(averageAttempts),
      warnings: this.generateWarnings(bestMethod.name, averageCost, successRate),
      tips: this.generateTips(bestMethod.name, desiredMods, simulatorData.recommendedFossils || [])
    };
  }

  /**
   * Generate detailed step-by-step crafting plan
   */
  private generateCraftingSteps(
    baseItem: string,
    itemLevel: number,
    desiredMods: string[],
    blockedMods: string[],
    method: string,
    recommendedFossils: string[]
  ): CraftingStep[] {
    const steps: CraftingStep[] = [];
    let stepNum = 1;

    // Step 1: Acquire base
    steps.push({
      stepNumber: stepNum++,
      action: `Acquire ${baseItem} base`,
      actionType: 'check',
      details: `Purchase or farm a ${baseItem} with item level ${itemLevel}+ (check trade sites, search for "ilvl:${itemLevel}")`,
      expectedOutcome: `You have a clean (white/blue) ${baseItem} ilvl ${itemLevel}+`,
      cost: 1
    });

    // Step 2: Prepare the base (scour if needed)
    steps.push({
      stepNumber: stepNum++,
      action: 'Prepare clean base',
      actionType: 'currency',
      details: 'If the item has mods, use an Orb of Scouring to make it white (no mods)',
      cost: 1,
      expectedOutcome: 'White (normal) rarity item with no mods'
    });

    // Generate method-specific steps
    if (method.toLowerCase().includes('fossil')) {
      // Fossil crafting steps
      if (recommendedFossils.length > 0) {
        steps.push({
          stepNumber: stepNum++,
          action: `Acquire fossils: ${recommendedFossils.join(', ')}`,
          actionType: 'fossil',
          details: `These fossils block unwanted mod types and weight desired mods. Purchase from trade or farm in delve.`,
          cost: recommendedFossils.length * 5
        });

        steps.push({
          stepNumber: stepNum++,
          action: 'Socket fossils in resonator',
          actionType: 'fossil',
          details: `Use a ${this.getResonatorType(recommendedFossils.length)} and socket all ${recommendedFossils.length} fossils`,
          cost: 2
        });
      }

      steps.push({
        stepNumber: stepNum++,
        action: 'Spam fossils',
        actionType: 'fossil',
        details: `Apply fossil resonator to base repeatedly until you hit: ${desiredMods.join(' + ')}`,
        stopCondition: `Stop when you see all desired mods: ${desiredMods.join(', ')}`,
        cost: 0
      });

    } else if (method.toLowerCase().includes('essence')) {
      // Essence crafting
      const essenceType = this.guessEssenceType(desiredMods);
      steps.push({
        stepNumber: stepNum++,
        action: `Acquire ${essenceType}`,
        actionType: 'essence',
        details: `Purchase Deafening or Shrieking tier essences from trade`,
        cost: 3
      });

      steps.push({
        stepNumber: stepNum++,
        action: 'Spam essences',
        actionType: 'essence',
        details: `Use ${essenceType} on the base until you hit good mods alongside the guaranteed mod`,
        stopCondition: `Stop when you see: ${desiredMods.join(' + ')}`,
        cost: 0
      });

    } else if (method.toLowerCase().includes('alt') || method.toLowerCase().includes('alteration')) {
      // Alt-regal method
      steps.push({
        stepNumber: stepNum++,
        action: 'Spam Orbs of Alteration',
        actionType: 'currency',
        details: 'Use Orbs of Alteration to roll magic (blue) item until you hit one of your desired mods',
        stopCondition: `Stop when you see one high-value mod from: ${desiredMods.join(' OR ')}`,
        cost: 0
      });

      steps.push({
        stepNumber: stepNum++,
        action: 'Use Orb of Augmentation if needed',
        actionType: 'currency',
        details: 'If you only have 1 mod, use Orb of Augmentation to add a second mod',
        cost: 0
      });

      steps.push({
        stepNumber: stepNum++,
        action: 'Use Regal Orb',
        actionType: 'currency',
        details: 'When you have 2 good mods, use Regal Orb to upgrade to rare and add a 3rd mod',
        expectedOutcome: 'Rare (yellow) item with 3 mods',
        cost: 1
      });

    } else {
      // Chaos spam (default)
      steps.push({
        stepNumber: stepNum++,
        action: 'Spam Chaos Orbs',
        actionType: 'currency',
        details: `Use Chaos Orbs to reroll all mods until you hit: ${desiredMods.join(' + ')}`,
        stopCondition: `Stop when you see all desired mods: ${desiredMods.join(', ')}`,
        cost: 0
      });
    }

    // Final steps: Bench crafting
    if (desiredMods.length < 6) {
      steps.push({
        stepNumber: stepNum++,
        action: 'Bench craft remaining affixes',
        actionType: 'bench',
        details: 'Use crafting bench to add useful mods to empty prefix/suffix slots (e.g., resistances, life, etc.)',
        cost: 5
      });
    }

    // Optional: Divine for perfect rolls
    steps.push({
      stepNumber: stepNum++,
      action: 'Divine Orb (optional)',
      actionType: 'currency',
      details: 'Use Divine Orbs to reroll numeric values to get higher rolls on your mods',
      cost: 15
    });

    return steps;
  }

  /**
   * Calculate currency breakdown for the strategy
   */
  private calculateCurrencyBreakdown(
    method: string,
    averageAttempts: number,
    totalCost: number
  ): Array<{ currency: string; amount: number; costPerUnit: number; totalCost: number }> {
    const breakdown: Array<any> = [];

    if (method.toLowerCase().includes('chaos')) {
      breakdown.push({
        currency: 'Chaos Orb',
        amount: averageAttempts,
        costPerUnit: 1,
        totalCost: averageAttempts
      });
    } else if (method.toLowerCase().includes('alt')) {
      breakdown.push(
        {
          currency: 'Orb of Alteration',
          amount: averageAttempts * 3,
          costPerUnit: 0.2,
          totalCost: averageAttempts * 3 * 0.2
        },
        {
          currency: 'Regal Orb',
          amount: Math.ceil(averageAttempts / 3),
          costPerUnit: 0.5,
          totalCost: Math.ceil(averageAttempts / 3) * 0.5
        }
      );
    } else if (method.toLowerCase().includes('fossil')) {
      breakdown.push({
        currency: 'Fossils + Resonators',
        amount: averageAttempts,
        costPerUnit: totalCost / averageAttempts,
        totalCost: totalCost
      });
    } else if (method.toLowerCase().includes('essence')) {
      breakdown.push({
        currency: 'Essences',
        amount: averageAttempts,
        costPerUnit: 3,
        totalCost: averageAttempts * 3
      });
    }

    return breakdown;
  }

  /**
   * Map method name to type
   */
  private mapMethodToType(methodName: string): 'chaos' | 'alt-regal' | 'fossil' | 'essence' | 'harvest' | 'metacraft' {
    const name = methodName.toLowerCase();
    if (name.includes('fossil')) return 'fossil';
    if (name.includes('essence')) return 'essence';
    if (name.includes('alt') || name.includes('regal')) return 'alt-regal';
    if (name.includes('harvest') || name.includes('reforge')) return 'harvest';
    if (name.includes('meta') || name.includes('cannot')) return 'metacraft';
    return 'chaos';
  }

  /**
   * Assess difficulty based on mod count and method
   */
  private assessDifficulty(
    desiredModCount: number,
    blockedModCount: number,
    method: string
  ): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
    let score = 0;

    // Mod count affects difficulty
    score += desiredModCount * 10;
    score += blockedModCount * 5;

    // Method complexity
    if (method.toLowerCase().includes('meta')) score += 40;
    else if (method.toLowerCase().includes('fossil')) score += 20;
    else if (method.toLowerCase().includes('harvest')) score += 15;
    else if (method.toLowerCase().includes('alt')) score += 10;

    if (score < 20) return 'beginner';
    if (score < 40) return 'intermediate';
    if (score < 60) return 'advanced';
    return 'expert';
  }

  /**
   * Estimate time to complete
   */
  private estimateTime(attempts: number): string {
    const minutesPerAttempt = 0.5;
    const totalMinutes = attempts * minutesPerAttempt;

    if (totalMinutes < 15) return '10-15 minutes';
    if (totalMinutes < 30) return '15-30 minutes';
    if (totalMinutes < 60) return '30-60 minutes';
    if (totalMinutes < 120) return '1-2 hours';
    if (totalMinutes < 240) return '2-4 hours';
    return '4+ hours';
  }

  /**
   * Generate warnings based on cost and success rate
   */
  private generateWarnings(method: string, cost: number, successRate: number): string[] {
    const warnings: string[] = [];

    if (successRate < 0.01) {
      warnings.push('⚠️ VERY LOW success rate - expect to spend significant currency');
    } else if (successRate < 0.05) {
      warnings.push('⚠️ Low success rate - prepare for many attempts');
    }

    if (cost > 500) {
      warnings.push('⚠️ High cost strategy - ensure you have enough currency');
    } else if (cost > 200) {
      warnings.push('⚠️ Moderate cost - budget accordingly');
    }

    if (method.toLowerCase().includes('meta')) {
      warnings.push('⚠️ Metacrafting requires unlocked crafting bench recipes (2+ divine per craft)');
    }

    return warnings;
  }

  /**
   * Generate tips based on method and mods
   */
  private generateTips(method: string, desiredMods: string[], fossils: string[]): string[] {
    const tips: string[] = [];

    if (fossils.length > 0) {
      tips.push(`💡 Recommended fossils: ${fossils.join(', ')}`);
      tips.push('💡 Fossils block certain mod tags, increasing your chance of hitting desired mods');
    }

    if (method.toLowerCase().includes('alt')) {
      tips.push('💡 Roll for the rarest/most expensive mod first with alterations');
      tips.push('💡 Check mod tier - aim for T1 or T2 before regaling');
    }

    if (desiredMods.length >= 4) {
      tips.push('💡 Consider crafting 2-3 mods first, then using Exalted Orbs for the rest');
    }

    tips.push('💡 Check trade sites for similar items - buying might be cheaper than crafting');

    return tips;
  }

  /**
   * Guess essence type from desired mods
   */
  private guessEssenceType(desiredMods: string[]): string {
    const modsText = desiredMods.join(' ').toLowerCase();

    if (modsText.includes('life') || modsText.includes('maximum life')) return 'Essence of Greed';
    if (modsText.includes('energy shield') || modsText.includes('es')) return 'Essence of Woe';
    if (modsText.includes('resistance') || modsText.includes('resist')) return 'Essence of Envy';
    if (modsText.includes('attack speed')) return 'Essence of Zeal';
    if (modsText.includes('spell damage') || modsText.includes('cast speed')) return 'Essence of Woe';

    return 'Appropriate Essence';
  }

  /**
   * Get resonator type based on fossil count
   */
  private getResonatorType(fossilCount: number): string {
    if (fossilCount === 1) return 'Primitive Chaotic Resonator';
    if (fossilCount === 2) return 'Potent Chaotic Resonator';
    if (fossilCount === 3) return 'Powerful Chaotic Resonator';
    return 'Prime Chaotic Resonator';
  }

  /**
   * Fallback strategy generator when simulator fails
   */
  private generateFallbackStrategy(
    baseItem: string,
    itemLevel: number,
    desiredMods: string[],
    blockedMods: string[],
    options: any
  ): CraftingStrategy {
    console.log(`   🔄 Generating fallback strategy...`);

    // Use simplified logic
    const method = desiredMods.length <= 2 ? 'Chaos Spam' : 'Fossil Crafting';
    const successRate = Math.pow(0.1, desiredMods.length); // Rough estimate
    const averageAttempts = Math.ceil(1 / successRate);
    const averageCost = method === 'Chaos Spam' ? averageAttempts : averageAttempts * 5;

    const steps = this.generateCraftingSteps(baseItem, itemLevel, desiredMods, blockedMods, method, []);
    const currencyBreakdown = this.calculateCurrencyBreakdown(method, averageAttempts, averageCost);

    return {
      baseItem,
      itemLevel,
      desiredMods,
      blockedMods,
      method,
      methodType: this.mapMethodToType(method),
      steps,
      averageCost,
      averageAttempts,
      successRate,
      currencyBreakdown,
      difficulty: this.assessDifficulty(desiredMods.length, blockedMods.length, method),
      estimatedTime: this.estimateTime(averageAttempts),
      warnings: this.generateWarnings(method, averageCost, successRate),
      tips: this.generateTips(method, desiredMods, [])
    };
  }

  /**
   * Optimize crafting strategy for a specific budget
   */
  async optimizeForBudget(
    baseItem: string,
    itemLevel: number,
    desiredMods: string[],
    budget: number
  ): Promise<BudgetOptimization> {
    console.log(`\n💰 Optimizing crafting for ${budget}c budget...`);

    // Try full strategy first
    const fullStrategy = await this.getCraftingStrategy(baseItem, itemLevel, desiredMods);

    if (fullStrategy.averageCost <= budget) {
      console.log(`   ✅ Full strategy fits budget!`);
      return {
        budget,
        achievableMods: desiredMods,
        unreachableMods: [],
        recommendedStrategy: fullStrategy,
        alternatives: []
      };
    }

    // If over budget, find subset of mods that fit
    console.log(`   ⚠️ Full strategy (${fullStrategy.averageCost}c) exceeds budget, finding alternatives...`);

    const alternatives: CraftingStrategy[] = [];
    const achievableMods: string[] = [];

    // Try with fewer mods
    for (let i = desiredMods.length - 1; i >= 1; i--) {
      const subsetMods = desiredMods.slice(0, i);
      const strategy = await this.getCraftingStrategy(baseItem, itemLevel, subsetMods);

      if (strategy.averageCost <= budget) {
        achievableMods.push(...subsetMods);
        alternatives.push(strategy);
        break;
      }
    }

    const unreachableMods = desiredMods.filter(m => !achievableMods.includes(m));

    return {
      budget,
      achievableMods,
      unreachableMods,
      recommendedStrategy: alternatives[0] || fullStrategy,
      alternatives: alternatives.slice(1)
    };
  }

  /**
   * Get fossil combinations that block certain mods
   */
  async getFossilCombinations(
    desiredMods: string[],
    blockedTags: string[]
  ): Promise<FossilCombination[]> {
    // Fossil tag blocking database
    const fossilDatabase: Record<string, { blocks: string[]; guarantees: string[] }> = {
      'Frigid Fossil': { blocks: ['fire'], guarantees: ['cold'] },
      'Scorched Fossil': { blocks: ['cold'], guarantees: ['fire'] },
      'Metallic Fossil': { blocks: ['physical'], guarantees: ['lightning'] },
      'Jagged Fossil': { blocks: ['chaos'], guarantees: ['physical'] },
      'Aberrant Fossil': { blocks: [], guarantees: ['chaos'] },
      'Pristine Fossil': { blocks: [], guarantees: ['life'] },
      'Dense Fossil': { blocks: [], guarantees: ['defense'] },
      'Lucent Fossil': { blocks: [], guarantees: ['mana'] },
      'Shuddering Fossil': { blocks: [], guarantees: ['attack', 'speed'] },
      'Bound Fossil': { blocks: [], guarantees: ['minion'] },
    };

    // Find combinations that block desired tags
    const combinations: FossilCombination[] = [];

    for (const [fossil, data] of Object.entries(fossilDatabase)) {
      const matchesBlocked = blockedTags.some(tag => data.blocks.includes(tag));

      if (matchesBlocked) {
        combinations.push({
          fossils: [fossil],
          blockedTags: data.blocks,
          guaranteedTags: data.guarantees,
          resonatorType: 'Primitive Chaotic Resonator',
          costPerAttempt: 5,
          increaseChanceFor: desiredMods.filter(mod =>
            data.guarantees.some(tag => mod.toLowerCase().includes(tag))
          )
        });
      }
    }

    return combinations;
  }

  /**
   * Cache management
   */
  private async saveToCache<T>(key: string, data: T): Promise<void> {
    try {
      const cachePath = path.join(CACHE_DIR, `${key}.json`);
      const cacheData = {
        timestamp: Date.now(),
        data
      };
      await fs.writeJson(cachePath, cacheData, { spaces: 2 });
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  }

  private async getFromCache<T>(key: string): Promise<T | null> {
    try {
      const cachePath = path.join(CACHE_DIR, `${key}.json`);

      if (!fs.existsSync(cachePath)) {
        return null;
      }

      const cacheData = await fs.readJson(cachePath);
      const age = Date.now() - cacheData.timestamp;

      if (age > CACHE_DURATION) {
        console.log(`   🗑️  Cache expired for ${key}`);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      return null;
    }
  }

  async clearCache(): Promise<void> {
    try {
      await fs.emptyDir(CACHE_DIR);
      console.log('✅ Craft of Exile strategy cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}

export const craftOfExileSimulatorEnhanced = new CraftOfExileSimulatorEnhanced();
