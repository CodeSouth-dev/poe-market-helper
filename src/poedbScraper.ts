/**
 * PoeDB.tw scraper for modifier and base item data
 * Scrapes and caches modifier information and item level requirements
 */

import { browserManager } from './browserManager';
import { RateLimiter } from './rateLimiter';
import * as fs from 'fs-extra';
import * as path from 'path';

const CACHE_DIR = path.join(__dirname, '../data/poedb-cache');
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// Rate limiter for poedb.tw (be respectful)
const rateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000,
  minDelay: 2000,
  maxConcurrent: 1,
  retryAttempts: 3,
  retryDelayMs: 3000
});

const SESSION_ID = 'poedb-scraper';

export interface ModifierData {
  name: string;
  type: string;
  level: number;
  tags: string[];
  weight: number;
  domain: string;
  generationType: string;
  tiers: Array<{
    tier: string;
    level: number;
    stats: string[];
    weight: number;
  }>;
}

export interface BaseItemData {
  name: string;
  itemClass: string;
  baseType: string;
  dropLevel: number;
  requiredLevel: number;
  implicitMods: string[];
  tags: string[];
  bestIlvlForCrafting: number;
}

export class PoeDBScraper {
  constructor() {
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  }

  /**
   * Scrape all modifiers from poedb.tw
   */
  async scrapeModifiers(itemClass: string = 'weapon'): Promise<ModifierData[]> {
    const cacheKey = `modifiers-${itemClass}`;
    const cached = await this.getFromCache<ModifierData[]>(cacheKey);

    if (cached) {
      console.log(`📦 Using cached modifiers for ${itemClass}`);
      return cached;
    }

    console.log(`🔍 Scraping modifiers for ${itemClass} from poedb.tw...`);

    return await rateLimiter.execute('poedb.tw', async () => {
      const page = await browserManager.createPage(SESSION_ID, true);

      try {
        const url = `https://poedb.tw/us/Modifiers?cn=${this.getItemClassCode(itemClass)}`;
        console.log(`   Loading: ${url}`);

        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });

        // Wait for the modifiers table to load
        await page.waitForSelector('table, .modifier-table', { timeout: 10000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        const modifiers = await page.evaluate(() => {
          const mods: any[] = [];

          // Find modifier tables
          const tables = document.querySelectorAll('table');

          tables.forEach(table => {
            const rows = table.querySelectorAll('tbody tr');

            rows.forEach(row => {
              try {
                const cells = row.querySelectorAll('td');
                if (cells.length < 3) return;

                const nameCell = cells[0];
                const levelCell = cells[1];
                const tagsCell = cells[2];

                const name = nameCell?.textContent?.trim() || '';
                if (!name || name.length < 2) return;

                const level = parseInt(levelCell?.textContent?.trim() || '1');
                const tags = (tagsCell?.textContent?.trim() || '').split(',').map(t => t.trim());

                // Extract stats from the mod description
                const stats: string[] = [];
                const statElements = nameCell.querySelectorAll('.stat, [class*="stat"]');
                statElements.forEach(el => {
                  const stat = el.textContent?.trim();
                  if (stat) stats.push(stat);
                });

                mods.push({
                  name,
                  type: name.toLowerCase().includes('prefix') ? 'prefix' : 'suffix',
                  level,
                  tags,
                  weight: 1000,
                  domain: 'item',
                  generationType: 'normal',
                  tiers: [{
                    tier: '1',
                    level,
                    stats: stats.length > 0 ? stats : [name],
                    weight: 1000
                  }]
                });
              } catch (error) {
                // Skip malformed rows
              }
            });
          });

          return mods;
        });

        console.log(`   ✅ Scraped ${modifiers.length} modifiers`);

        // Cache the results
        await this.saveToCache(cacheKey, modifiers);

        return modifiers;

      } catch (error: any) {
        console.error(`   ❌ Failed to scrape modifiers:`, error.message);
        return [];
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Scrape base item data from poedb.tw
   */
  async scrapeBaseItems(itemClass: string = 'weapon'): Promise<BaseItemData[]> {
    const cacheKey = `base-items-${itemClass}`;
    const cached = await this.getFromCache<BaseItemData[]>(cacheKey);

    if (cached) {
      console.log(`📦 Using cached base items for ${itemClass}`);
      return cached;
    }

    console.log(`🔍 Scraping base items for ${itemClass} from poedb.tw...`);

    return await rateLimiter.execute('poedb.tw', async () => {
      const page = await browserManager.createPage(SESSION_ID, true);

      try {
        const url = `https://poedb.tw/us/Items?cn=${this.getItemClassCode(itemClass)}`;
        console.log(`   Loading: ${url}`);

        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });

        await page.waitForSelector('table, .item-table', { timeout: 10000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        const baseItems = await page.evaluate(() => {
          const items: any[] = [];

          const tables = document.querySelectorAll('table');

          tables.forEach(table => {
            const rows = table.querySelectorAll('tbody tr');

            rows.forEach(row => {
              try {
                const cells = row.querySelectorAll('td');
                if (cells.length < 2) return;

                const nameCell = cells[0];
                const levelCell = cells[1];

                const name = nameCell?.textContent?.trim() || '';
                if (!name || name.length < 2) return;

                const dropLevel = parseInt(levelCell?.textContent?.trim() || '1');

                // Extract item class from the table header or row data
                const itemClass = 'Unknown';

                // Parse implicit mods if available
                const implicitMods: string[] = [];
                const implicitElements = nameCell.querySelectorAll('.implicit, [class*="implicit"]');
                implicitElements.forEach(el => {
                  const mod = el.textContent?.trim();
                  if (mod) implicitMods.push(mod);
                });

                // Determine best ilvl for crafting (usually dropLevel + 10-15 for top tier mods)
                const bestIlvlForCrafting = Math.max(dropLevel, 80);

                items.push({
                  name,
                  itemClass,
                  baseType: name,
                  dropLevel,
                  requiredLevel: dropLevel,
                  implicitMods,
                  tags: [],
                  bestIlvlForCrafting
                });
              } catch (error) {
                // Skip malformed rows
              }
            });
          });

          return items;
        });

        console.log(`   ✅ Scraped ${baseItems.length} base items`);

        // Cache the results
        await this.saveToCache(cacheKey, baseItems);

        return baseItems;

      } catch (error: any) {
        console.error(`   ❌ Failed to scrape base items:`, error.message);
        return [];
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Get the best item level for crafting specific mods
   */
  async getBestIlvlForMods(itemClass: string, desiredMods: string[]): Promise<{
    recommendedIlvl: number;
    reasoning: string;
    modDetails: Array<{ mod: string; minLevel: number }>;
  }> {
    const modifiers = await this.scrapeModifiers(itemClass);

    const modDetails = desiredMods.map(desiredMod => {
      // Find the modifier that matches
      const mod = modifiers.find(m =>
        m.name.toLowerCase().includes(desiredMod.toLowerCase()) ||
        m.tiers.some(t => t.stats.some(s => s.toLowerCase().includes(desiredMod.toLowerCase())))
      );

      const minLevel = mod ? Math.max(...mod.tiers.map(t => t.level)) : 1;

      return {
        mod: desiredMod,
        minLevel
      };
    });

    const recommendedIlvl = Math.max(...modDetails.map(m => m.minLevel), 82);

    return {
      recommendedIlvl,
      reasoning: `Item level ${recommendedIlvl} required for all desired modifiers`,
      modDetails
    };
  }

  /**
   * Get item class code for poedb.tw URLs
   */
  private getItemClassCode(itemClass: string): string {
    const mapping: Record<string, string> = {
      'weapon': 'Weapon',
      'armor': 'Armour',
      'armour': 'Armour',
      'body armour': 'BodyArmours',
      'boots': 'Boots',
      'gloves': 'Gloves',
      'helmet': 'Helmets',
      'ring': 'Rings',
      'amulet': 'Amulets',
      'belt': 'Belts',
      'jewel': 'Jewels'
    };

    return mapping[itemClass.toLowerCase()] || 'Weapon';
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
      console.log('✅ PoeDB cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}

// Singleton instance
export const poedbScraper = new PoeDBScraper();
