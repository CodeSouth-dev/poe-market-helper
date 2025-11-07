/**
 * Currency and Crafting Materials Scraper
 *
 * Uses headless browser to scrape comprehensive pricing data from poe.ninja/economy
 * Covers all currency types and crafting materials:
 * - Currency (Chaos, Divine, Exalted, etc.)
 * - Fossils
 * - Essences
 * - Scarabs
 * - Delirium Orbs
 * - Oils
 * - Catalysts
 * - Fragments
 * - Vials
 * - Resonators
 * - Beast crafts
 * - Harvest crafts
 */

import { browserManager } from './browserManager';
import { RateLimiter } from './rateLimiter';
import * as fs from 'fs-extra';
import * as path from 'path';

const CACHE_DIR = path.join(__dirname, '../data/currency-cache');
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes (currency changes fast)

// Rate limiter for poe.ninja
const rateLimiter = new RateLimiter({
  maxRequests: 15,
  windowMs: 60000,
  minDelay: 1500,
  maxConcurrent: 2,
  retryAttempts: 3,
  retryDelayMs: 2000
});

const SESSION_ID = 'currency-materials-scraper';

export interface CurrencyItem {
  name: string;
  chaosValue: number;
  divineValue?: number;
  exaltedValue?: number;
  count?: number; // Stack size for display
  icon?: string;
  sparkline?: {
    totalChange: number;
    data: number[];
  };
  lowConfidence?: boolean;
  listingCount?: number;
}

export interface MaterialsPricing {
  // Basic Currency
  currency: CurrencyItem[];

  // Crafting Materials
  fossils: CurrencyItem[];
  essences: CurrencyItem[];
  resonators: CurrencyItem[];

  // Mapping Materials
  scarabs: CurrencyItem[];
  fragments: CurrencyItem[];

  // Anointing & Quality
  oils: CurrencyItem[];
  catalysts: CurrencyItem[];

  // League Mechanics
  deliriumOrbs: CurrencyItem[];
  vials: CurrencyItem[];

  // Harvest & Beast
  harvestLifeforce?: CurrencyItem[];
  beastCrafts?: CurrencyItem[];

  lastUpdated: number;
}

export class CurrencyMaterialsScraper {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  constructor() {
    this.ensureCacheDir();
  }

  private async ensureCacheDir() {
    await fs.ensureDir(CACHE_DIR);
  }

  /**
   * Get cached data if available and not expired
   */
  private async getFromCache<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data as T;
    }

    // Try to load from file cache
    const cacheFile = path.join(CACHE_DIR, `${key}.json`);
    try {
      if (await fs.pathExists(cacheFile)) {
        const data = await fs.readJson(cacheFile);
        if (Date.now() - data.timestamp < CACHE_DURATION) {
          this.cache.set(key, data);
          return data.data as T;
        }
      }
    } catch (error) {
      // Ignore cache errors
    }

    return null;
  }

  /**
   * Save data to cache
   */
  private async saveToCache(key: string, data: any) {
    const cacheData = { data, timestamp: Date.now() };
    this.cache.set(key, cacheData);

    const cacheFile = path.join(CACHE_DIR, `${key}.json`);
    try {
      await fs.writeJson(cacheFile, cacheData);
    } catch (error) {
      console.error('Failed to save cache:', error);
    }
  }

  /**
   * Scrape all currency and materials pricing for a league
   */
  async scrapeAllPricing(league: string = 'Standard'): Promise<MaterialsPricing> {
    const cacheKey = `all-pricing-${league}`;
    const cached = await this.getFromCache<MaterialsPricing>(cacheKey);

    if (cached) {
      console.log(`📦 Using cached pricing data for ${league}`);
      return cached;
    }

    console.log(`\n💰 Scraping all currency & materials pricing for ${league}...`);

    const [
      currency,
      fossils,
      essences,
      resonators,
      scarabs,
      fragments,
      oils,
      catalysts,
      deliriumOrbs,
      vials
    ] = await Promise.all([
      this.scrapeCurrency(league),
      this.scrapeFossils(league),
      this.scrapeEssences(league),
      this.scrapeResonators(league),
      this.scrapeScarabs(league),
      this.scrapeFragments(league),
      this.scrapeOils(league),
      this.scrapeCatalysts(league),
      this.scrapeDeliriumOrbs(league),
      this.scrapeVials(league)
    ]);

    const result: MaterialsPricing = {
      currency,
      fossils,
      essences,
      resonators,
      scarabs,
      fragments,
      oils,
      catalysts,
      deliriumOrbs,
      vials,
      lastUpdated: Date.now()
    };

    await this.saveToCache(cacheKey, result);
    return result;
  }

  /**
   * Scrape currency (Chaos, Divine, Exalted, etc.)
   */
  async scrapeCurrency(league: string): Promise<CurrencyItem[]> {
    return this.scrapeEconomyCategory(league, 'Currency', 'currency');
  }

  /**
   * Scrape fossils
   */
  async scrapeFossils(league: string): Promise<CurrencyItem[]> {
    return this.scrapeEconomyCategory(league, 'Fossil', 'fossils');
  }

  /**
   * Scrape essences
   */
  async scrapeEssences(league: string): Promise<CurrencyItem[]> {
    return this.scrapeEconomyCategory(league, 'Essence', 'essences');
  }

  /**
   * Scrape resonators
   */
  async scrapeResonators(league: string): Promise<CurrencyItem[]> {
    return this.scrapeEconomyCategory(league, 'Resonator', 'resonators');
  }

  /**
   * Scrape scarabs
   */
  async scrapeScarabs(league: string): Promise<CurrencyItem[]> {
    return this.scrapeEconomyCategory(league, 'Scarab', 'scarabs');
  }

  /**
   * Scrape fragments (map, breach, etc.)
   */
  async scrapeFragments(league: string): Promise<CurrencyItem[]> {
    return this.scrapeEconomyCategory(league, 'Fragment', 'fragments');
  }

  /**
   * Scrape oils
   */
  async scrapeOils(league: string): Promise<CurrencyItem[]> {
    return this.scrapeEconomyCategory(league, 'Oil', 'oils');
  }

  /**
   * Scrape catalysts
   */
  async scrapeCatalysts(league: string): Promise<CurrencyItem[]> {
    return this.scrapeEconomyCategory(league, 'Catalyst', 'catalysts');
  }

  /**
   * Scrape delirium orbs
   */
  async scrapeDeliriumOrbs(league: string): Promise<CurrencyItem[]> {
    return this.scrapeEconomyCategory(league, 'DeliriumOrb', 'delirium-orbs');
  }

  /**
   * Scrape vials (Sanctum)
   */
  async scrapeVials(league: string): Promise<CurrencyItem[]> {
    return this.scrapeEconomyCategory(league, 'Vial', 'vials');
  }

  /**
   * Generic scraper for any economy category
   */
  private async scrapeEconomyCategory(
    league: string,
    apiType: string,
    displayName: string
  ): Promise<CurrencyItem[]> {
    const cacheKey = `${league}-${apiType}`;
    const cached = await this.getFromCache<CurrencyItem[]>(cacheKey);

    if (cached) {
      return cached;
    }

    return await rateLimiter.execute('poe.ninja', async () => {
      const page = await browserManager.createPage(SESSION_ID, true);

      try {
        // Determine API endpoint
        const endpoint = this.isFragmentType(apiType) ? 'itemoverview' : 'currencyoverview';
        const url = `https://poe.ninja/api/data/${endpoint}?league=${league}&type=${apiType}&language=en`;

        console.log(`   🔍 Fetching ${displayName}...`);
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

        // Extract JSON data
        const data = await page.evaluate(() => {
          // @ts-ignore - document is available in browser context
          const preElement = document.querySelector('pre');
          if (preElement) {
            return JSON.parse(preElement.textContent || '{}');
          }
          return {};
        });

        // Parse and format items
        const items: CurrencyItem[] = [];
        const lines = data.lines || data.currencyDetails || [];

        for (const item of lines) {
          items.push({
            name: item.currencyTypeName || item.name || item.detailsId || 'Unknown',
            chaosValue: item.chaosEquivalent || item.chaosValue || 0,
            count: item.stackSize || item.count,
            icon: item.icon,
            sparkline: item.receiveSparkLine || item.sparkline ? {
              totalChange: item.receiveSparkLine?.totalChange || item.sparkline?.totalChange || 0,
              data: item.receiveSparkLine?.data || item.sparkline?.data || []
            } : undefined,
            lowConfidence: item.lowConfidenceReceiveSparkLine || item.lowConfidenceSparkLine || false,
            listingCount: item.listingCount
          });
        }

        console.log(`      ✅ Found ${items.length} ${displayName}`);

        // Cache the results
        await this.saveToCache(cacheKey, items);

        return items;

      } catch (error: any) {
        console.error(`      ❌ Failed to scrape ${displayName}:`, error.message);
        return [];
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Check if type uses itemoverview endpoint
   */
  private isFragmentType(type: string): boolean {
    const fragmentTypes = ['Scarab', 'Fragment', 'DeliriumOrb', 'Vial', 'Essence', 'Fossil', 'Resonator'];
    return fragmentTypes.includes(type);
  }

  /**
   * Get price for a specific currency/material by name
   */
  async getPrice(itemName: string, league: string = 'Standard'): Promise<number> {
    const allPricing = await this.scrapeAllPricing(league);

    // Search across all categories
    const allItems = [
      ...allPricing.currency,
      ...allPricing.fossils,
      ...allPricing.essences,
      ...allPricing.resonators,
      ...allPricing.scarabs,
      ...allPricing.fragments,
      ...allPricing.oils,
      ...allPricing.catalysts,
      ...allPricing.deliriumOrbs,
      ...allPricing.vials
    ];

    const item = allItems.find(i =>
      i.name.toLowerCase().includes(itemName.toLowerCase()) ||
      itemName.toLowerCase().includes(i.name.toLowerCase())
    );

    return item?.chaosValue || 0;
  }

  /**
   * Get all items of a specific category
   */
  async getCategoryPricing(category: string, league: string = 'Standard'): Promise<CurrencyItem[]> {
    const allPricing = await this.scrapeAllPricing(league);

    const categoryMap: Record<string, CurrencyItem[]> = {
      'currency': allPricing.currency,
      'fossils': allPricing.fossils,
      'fossil': allPricing.fossils,
      'essences': allPricing.essences,
      'essence': allPricing.essences,
      'resonators': allPricing.resonators,
      'resonator': allPricing.resonators,
      'scarabs': allPricing.scarabs,
      'scarab': allPricing.scarabs,
      'fragments': allPricing.fragments,
      'fragment': allPricing.fragments,
      'oils': allPricing.oils,
      'oil': allPricing.oils,
      'catalysts': allPricing.catalysts,
      'catalyst': allPricing.catalysts,
      'delirium': allPricing.deliriumOrbs,
      'deliriumorbs': allPricing.deliriumOrbs,
      'vials': allPricing.vials,
      'vial': allPricing.vials
    };

    return categoryMap[category.toLowerCase()] || [];
  }

  /**
   * Search for items by name across all categories
   */
  async searchItems(query: string, league: string = 'Standard'): Promise<CurrencyItem[]> {
    const allPricing = await this.scrapeAllPricing(league);

    const allItems = [
      ...allPricing.currency,
      ...allPricing.fossils,
      ...allPricing.essences,
      ...allPricing.resonators,
      ...allPricing.scarabs,
      ...allPricing.fragments,
      ...allPricing.oils,
      ...allPricing.catalysts,
      ...allPricing.deliriumOrbs,
      ...allPricing.vials
    ];

    const queryLower = query.toLowerCase();
    return allItems.filter(item =>
      item.name.toLowerCase().includes(queryLower)
    );
  }

  /**
   * Get most expensive items (for investment opportunities)
   */
  async getMostExpensive(limit: number = 20, league: string = 'Standard'): Promise<CurrencyItem[]> {
    const allPricing = await this.scrapeAllPricing(league);

    const allItems = [
      ...allPricing.currency,
      ...allPricing.fossils,
      ...allPricing.essences,
      ...allPricing.resonators,
      ...allPricing.scarabs,
      ...allPricing.fragments,
      ...allPricing.oils,
      ...allPricing.catalysts,
      ...allPricing.deliriumOrbs,
      ...allPricing.vials
    ];

    return allItems
      .sort((a, b) => b.chaosValue - a.chaosValue)
      .slice(0, limit);
  }

  /**
   * Get items with rising prices (good for investment)
   */
  async getRisingItems(minChange: number = 5, league: string = 'Standard'): Promise<CurrencyItem[]> {
    const allPricing = await this.scrapeAllPricing(league);

    const allItems = [
      ...allPricing.currency,
      ...allPricing.fossils,
      ...allPricing.essences,
      ...allPricing.resonators,
      ...allPricing.scarabs,
      ...allPricing.fragments,
      ...allPricing.oils,
      ...allPricing.catalysts,
      ...allPricing.deliriumOrbs,
      ...allPricing.vials
    ];

    return allItems
      .filter(item =>
        item.sparkline &&
        item.sparkline.totalChange >= minChange &&
        !item.lowConfidence
      )
      .sort((a, b) => (b.sparkline?.totalChange || 0) - (a.sparkline?.totalChange || 0));
  }
}

export const currencyMaterialsScraper = new CurrencyMaterialsScraper();
