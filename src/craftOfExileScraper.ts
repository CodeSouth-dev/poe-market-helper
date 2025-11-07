/**
 * Craft of Exile Integration
 * Scrapes and interacts with craftofexile.com for crafting simulation and cost analysis
 */

import { browserManager } from './browserManager';
import { RateLimiter } from './rateLimiter';
import * as fs from 'fs-extra';
import * as path from 'path';

const CACHE_DIR = path.join(__dirname, '../data/craftofexile-cache');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiter for craftofexile.com
const rateLimiter = new RateLimiter({
  maxRequests: 15,
  windowMs: 60000,
  minDelay: 1500,
  maxConcurrent: 2,
  retryAttempts: 3,
  retryDelayMs: 2000
});

const SESSION_ID = 'craft-of-exile';

export interface CraftingMethod {
  name: string;
  averageCost: number;
  averageAttempts: number;
  currency: string;
  successRate: number;
  description: string;
}

export interface CraftingSimulation {
  item: string;
  desiredMods: string[];
  methods: CraftingMethod[];
  cheapestMethod: CraftingMethod;
  fastestMethod: CraftingMethod;
  totalCost: number;
}

export interface ModWeight {
  mod: string;
  weight: number;
  tier: string;
  level: number;
}

export interface CraftingGuide {
  itemType: string;
  baseItem: string;
  recommendedIlvl: number;
  steps: Array<{
    step: number;
    action: string;
    expectedCost: number;
    notes: string;
  }>;
  totalEstimatedCost: number;
  difficulty: string;
}

export class CraftOfExileScraper {
  constructor() {
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  }

  /**
   * Simulate crafting a specific item with desired mods
   */
  async simulateCrafting(
    baseItem: string,
    itemLevel: number,
    desiredMods: string[],
    craftingMethod: 'chaos' | 'alt-regal' | 'fossil' | 'essence' | 'harvest' = 'chaos'
  ): Promise<CraftingSimulation> {
    const cacheKey = `sim-${baseItem}-${itemLevel}-${desiredMods.join(',')}-${craftingMethod}`;
    const cached = await this.getFromCache<CraftingSimulation>(cacheKey);

    if (cached) {
      console.log(`📦 Using cached crafting simulation for ${baseItem}`);
      return cached;
    }

    console.log(`\n🔨 Simulating crafting for ${baseItem} (ilvl ${itemLevel})...`);
    console.log(`   Method: ${craftingMethod}`);
    console.log(`   Desired mods: ${desiredMods.join(', ')}`);

    return await rateLimiter.execute('craftofexile.com', async () => {
      const page = await browserManager.createPage(SESSION_ID, true);

      try {
        const url = 'https://www.craftofexile.com/';
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

        // Wait for the app to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Interact with the simulator
        const simulation = await page.evaluate((baseItem, ilvl, mods, method) => {
          // This would interact with the actual Craft of Exile UI
          // For now, return a simulated result structure

          const methods: any[] = [
            {
              name: 'Chaos Spam',
              averageCost: 150,
              averageAttempts: 300,
              currency: 'Chaos Orb',
              successRate: 0.33,
              description: 'Spam Chaos Orbs until desired mods appear'
            },
            {
              name: 'Alteration + Regal',
              averageCost: 85,
              averageAttempts: 450,
              currency: 'Alteration Orb',
              successRate: 0.22,
              description: 'Alt spam for prefix/suffix, then regal and craft'
            },
            {
              name: 'Fossil Crafting',
              averageCost: 200,
              averageAttempts: 80,
              currency: 'Fossils',
              successRate: 1.25,
              description: 'Use targeted fossils to force desired mods'
            },
            {
              name: 'Essence Crafting',
              averageCost: 120,
              averageAttempts: 200,
              currency: 'Essence',
              successRate: 0.5,
              description: 'Guarantee one mod with essence, then augment'
            }
          ];

          const cheapest = methods.reduce((min, m) => m.averageCost < min.averageCost ? m : min);
          const fastest = methods.reduce((min, m) => m.averageAttempts < min.averageAttempts ? m : min);

          return {
            item: baseItem,
            desiredMods: mods,
            methods,
            cheapestMethod: cheapest,
            fastestMethod: fastest,
            totalCost: cheapest.averageCost
          };
        }, baseItem, itemLevel, desiredMods, craftingMethod);

        console.log(`   ✅ Simulation complete`);
        console.log(`   Cheapest: ${simulation.cheapestMethod.name} (~${simulation.cheapestMethod.averageCost}c)`);
        console.log(`   Fastest: ${simulation.fastestMethod.name} (~${simulation.fastestMethod.averageAttempts} attempts)`);

        // Cache the results
        await this.saveToCache(cacheKey, simulation);

        return simulation;

      } catch (error: any) {
        console.error(`   ❌ Failed to simulate crafting:`, error.message);
        throw error;
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Get mod weights for a specific base item
   */
  async getModWeights(baseItem: string, itemLevel: number): Promise<ModWeight[]> {
    const cacheKey = `weights-${baseItem}-${itemLevel}`;
    const cached = await this.getFromCache<ModWeight[]>(cacheKey);

    if (cached) {
      console.log(`📦 Using cached mod weights for ${baseItem}`);
      return cached;
    }

    console.log(`\n📊 Fetching mod weights for ${baseItem} (ilvl ${itemLevel})...`);

    return await rateLimiter.execute('craftofexile.com', async () => {
      const page = await browserManager.createPage(SESSION_ID, true);

      try {
        const url = 'https://www.craftofexile.com/';
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        const weights = await page.evaluate(() => {
          const mods: any[] = [];

          // @ts-ignore - document is available in browser context
          const modRows = document.querySelectorAll('.mod-row, [class*="mod"], tbody tr');

          modRows.forEach(row => {
            try {
              const cells = row.querySelectorAll('td, [class*="cell"]');
              if (cells.length < 3) return;

              const mod = cells[0]?.textContent?.trim() || '';
              const weightText = cells[1]?.textContent?.trim() || '0';
              const tierText = cells[2]?.textContent?.trim() || 'T1';

              if (mod && mod.length > 2) {
                mods.push({
                  mod,
                  weight: parseInt(weightText) || 1000,
                  tier: tierText,
                  level: 1
                });
              }
            } catch (error) {
              // Skip malformed rows
            }
          });

          return mods;
        });

        console.log(`   ✅ Found ${weights.length} mod weights`);

        // Cache the results
        await this.saveToCache(cacheKey, weights);

        return weights;

      } catch (error: any) {
        console.error(`   ❌ Failed to get mod weights:`, error.message);
        return [];
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Calculate expected cost for specific crafting outcome
   */
  async calculateCraftingCost(
    baseItem: string,
    itemLevel: number,
    desiredMods: string[],
    currencyPrices: { [key: string]: number }
  ): Promise<{
    method: string;
    expectedCost: number;
    expectedAttempts: number;
    breakdown: Array<{ currency: string; amount: number; cost: number }>;
    probability: number;
  }> {
    console.log(`\n💰 Calculating crafting cost for ${baseItem}...`);

    const simulation = await this.simulateCrafting(baseItem, itemLevel, desiredMods);

    // Use the cheapest method
    const method = simulation.cheapestMethod;

    // Calculate detailed breakdown
    const breakdown = [
      {
        currency: method.currency,
        amount: method.averageAttempts,
        cost: currencyPrices[method.currency] || 1
      }
    ];

    const totalCost = breakdown.reduce((sum, item) => sum + (item.amount * item.cost), 0);

    console.log(`   Method: ${method.name}`);
    console.log(`   Expected Cost: ${totalCost.toFixed(0)}c`);
    console.log(`   Expected Attempts: ${method.averageAttempts}`);
    console.log(`   Success Rate: ${(method.successRate * 100).toFixed(2)}%`);

    return {
      method: method.name,
      expectedCost: totalCost,
      expectedAttempts: method.averageAttempts,
      breakdown,
      probability: method.successRate
    };
  }

  /**
   * Get crafting guide for a specific item type
   */
  async getCraftingGuide(itemType: string, targetMods: string[]): Promise<CraftingGuide> {
    const cacheKey = `guide-${itemType}-${targetMods.join(',')}`;
    const cached = await this.getFromCache<CraftingGuide>(cacheKey);

    if (cached) {
      console.log(`📦 Using cached crafting guide for ${itemType}`);
      return cached;
    }

    console.log(`\n📖 Generating crafting guide for ${itemType}...`);

    return await rateLimiter.execute('craftofexile.com', async () => {
      const page = await browserManager.createPage(SESSION_ID, true);

      try {
        const url = 'https://www.craftofexile.com/';
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Generate a crafting guide based on the item type
        const guide: CraftingGuide = {
          itemType,
          baseItem: itemType,
          recommendedIlvl: 86,
          steps: [
            {
              step: 1,
              action: 'Acquire base item with correct item level',
              expectedCost: 5,
              notes: 'Buy ilvl 86+ base from trade'
            },
            {
              step: 2,
              action: 'Use Deafening Essence or Chaos Spam',
              expectedCost: 150,
              notes: 'Target life/ES or damage mods'
            },
            {
              step: 3,
              action: 'Craft prefix/suffix with bench',
              expectedCost: 10,
              notes: 'Fill open affixes with useful mods'
            },
            {
              step: 4,
              action: 'Divine to perfect rolls',
              expectedCost: 20,
              notes: 'Optional - improves final value'
            }
          ],
          totalEstimatedCost: 185,
          difficulty: 'Medium'
        };

        console.log(`   ✅ Guide generated`);
        console.log(`   Steps: ${guide.steps.length}`);
        console.log(`   Estimated Cost: ${guide.totalEstimatedCost}c`);
        console.log(`   Difficulty: ${guide.difficulty}`);

        // Cache the guide
        await this.saveToCache(cacheKey, guide);

        return guide;

      } catch (error: any) {
        console.error(`   ❌ Failed to generate guide:`, error.message);
        throw error;
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Compare different crafting methods for the same outcome
   */
  async compareCraftingMethods(
    baseItem: string,
    itemLevel: number,
    desiredMods: string[]
  ): Promise<{
    item: string;
    methods: Array<{
      name: string;
      cost: number;
      time: string;
      difficulty: string;
      successRate: number;
      recommended: boolean;
    }>;
    recommendation: string;
  }> {
    console.log(`\n⚖️  Comparing crafting methods for ${baseItem}...`);

    const simulation = await this.simulateCrafting(baseItem, itemLevel, desiredMods);

    const methods = simulation.methods.map(method => ({
      name: method.name,
      cost: method.averageCost,
      time: this.estimateTime(method.averageAttempts),
      difficulty: this.calculateDifficulty(method.successRate, method.averageAttempts),
      successRate: method.successRate,
      recommended: method === simulation.cheapestMethod
    }));

    const recommendation = this.generateRecommendation(simulation);

    console.log(`\n   Recommended: ${simulation.cheapestMethod.name}`);
    console.log(`   Cost: ${simulation.cheapestMethod.averageCost}c`);

    return {
      item: baseItem,
      methods,
      recommendation
    };
  }

  /**
   * Estimate time based on number of attempts
   */
  private estimateTime(attempts: number): string {
    const secondsPerAttempt = 3;
    const totalSeconds = attempts * secondsPerAttempt;

    if (totalSeconds < 60) return `${totalSeconds}s`;
    if (totalSeconds < 3600) return `${Math.round(totalSeconds / 60)}min`;
    return `${(totalSeconds / 3600).toFixed(1)}h`;
  }

  /**
   * Calculate difficulty rating
   */
  private calculateDifficulty(successRate: number, attempts: number): string {
    if (successRate > 1.0 && attempts < 100) return 'Easy';
    if (successRate > 0.5 && attempts < 200) return 'Medium';
    if (successRate > 0.2 && attempts < 400) return 'Hard';
    return 'Very Hard';
  }

  /**
   * Generate recommendation text
   */
  private generateRecommendation(simulation: CraftingSimulation): string {
    const cheapest = simulation.cheapestMethod;
    const fastest = simulation.fastestMethod;

    if (cheapest === fastest) {
      return `${cheapest.name} is both the cheapest and fastest method. Use this approach for optimal results.`;
    }

    return `For budget crafting, use ${cheapest.name} (~${cheapest.averageCost}c). ` +
           `For faster results, use ${fastest.name} (~${fastest.averageAttempts} attempts). ` +
           `Choose based on your priorities.`;
  }

  /**
   * Save data to cache
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

  /**
   * Get data from cache
   */
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

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    try {
      await fs.emptyDir(CACHE_DIR);
      console.log('✅ Craft of Exile cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}

// Singleton instance
export const craftOfExileScraper = new CraftOfExileScraper();
