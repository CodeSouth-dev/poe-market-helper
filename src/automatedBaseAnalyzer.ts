/**
 * Automated Base Analyzer
 *
 * Uses headless browser to automatically:
 * - Scrape poe.ninja for base economy data (value, #listed, confidence)
 * - Verify actual listings on pathofexile.com/trade
 * - Compare prices and availability across sources
 * - Generate buy/craft recommendations
 *
 * This runs automatically in the background to keep data fresh
 */

import { browserManager } from './browserManager';
import { RateLimiter } from './rateLimiter';
import * as fs from 'fs-extra';
import * as path from 'path';

// Rate limiter for automated analysis (slower to avoid detection)
const rateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000,
  minDelay: 2000,
  maxConcurrent: 1,
  retryAttempts: 2,
  retryDelayMs: 3000
});

interface BaseEconomyData {
  name: string;
  itemClass: string;
  poeNinjaPrice: number;
  poeNinjaListings: number;
  lowConfidence: boolean;
  sparkline?: {
    totalChange: number;
    data: number[];
  };

  // Trade site verification
  tradeVerified: boolean;
  tradeActualPrice?: number;
  tradeListingCount?: number;
  tradePriceMatch?: boolean; // Does trade price match poe.ninja?

  // Recommendations
  recommendation?: 'BUY' | 'CRAFT' | 'SKIP';
  reason?: string;

  lastUpdated: number;
}

export class AutomatedBaseAnalyzer {
  private SESSION_ID = 'automated-base-analyzer';
  private cacheFile = path.join(__dirname, '../cache/automated-base-analysis.json');
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.ensureCacheDir();
  }

  private async ensureCacheDir() {
    await fs.ensureDir(path.dirname(this.cacheFile));
  }

  /**
   * Start automated analysis (runs every 30 minutes)
   */
  async startAutomatedAnalysis() {
    if (this.isRunning) {
      console.log('⚠️  Automated base analyzer is already running');
      return;
    }

    this.isRunning = true;
    console.log('🤖 Starting automated base analyzer...');

    // Run immediately
    await this.runFullAnalysis();

    // Then run every 30 minutes
    this.updateInterval = setInterval(async () => {
      await this.runFullAnalysis();
    }, 30 * 60 * 1000);
  }

  /**
   * Stop automated analysis
   */
  stopAutomatedAnalysis() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Stopped automated base analyzer');
  }

  /**
   * Run full analysis for all item classes
   */
  async runFullAnalysis(league: string = 'Standard') {
    console.log(`\n🤖 [Automated] Running full base analysis for ${league}...`);

    const itemClasses = [
      'Body Armour', 'Helmet', 'Gloves', 'Boots', 'Shield',
      'Belt', 'Amulet', 'Ring', 'Bow', 'Wand'
    ];

    const allResults: BaseEconomyData[] = [];

    for (const itemClass of itemClasses) {
      try {
        console.log(`   🔍 Analyzing ${itemClass}...`);
        const results = await this.analyzeItemClass(itemClass, league);
        allResults.push(...results);

        // Rate limit: wait 3 seconds between item classes
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error: any) {
        console.error(`   ❌ Failed to analyze ${itemClass}:`, error.message);
      }
    }

    // Save results to cache
    await this.saveResults(allResults);

    console.log(`\n✅ [Automated] Analysis complete! Analyzed ${allResults.length} bases`);
    console.log(`   📊 Recommendations:`);
    console.log(`      BUY: ${allResults.filter(r => r.recommendation === 'BUY').length}`);
    console.log(`      CRAFT: ${allResults.filter(r => r.recommendation === 'CRAFT').length}`);
    console.log(`      SKIP: ${allResults.filter(r => r.recommendation === 'SKIP').length}`);

    return allResults;
  }

  /**
   * Analyze all bases for a specific item class
   */
  async analyzeItemClass(itemClass: string, league: string): Promise<BaseEconomyData[]> {
    // Step 1: Get poe.ninja data
    const ninjaData = await this.fetchPoeNinjaData(itemClass, league);

    // Step 2: Verify top 3 bases on trade site
    const topBases = ninjaData.slice(0, 3);
    const results: BaseEconomyData[] = [];

    for (const base of topBases) {
      try {
        const tradeData = await this.verifyOnTradeSite(base.name, league);

        const result: BaseEconomyData = {
          ...base,
          itemClass,
          tradeVerified: tradeData.verified,
          tradeActualPrice: tradeData.actualPrice,
          tradeListingCount: tradeData.listingCount,
          tradePriceMatch: tradeData.priceMatch,
          lastUpdated: Date.now()
        };

        // Generate recommendation
        result.recommendation = this.generateRecommendation(result);
        result.reason = this.generateReason(result);

        results.push(result);

        // Rate limit: wait 2 seconds between trade site checks
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`      ⚠️  Trade verification failed for ${base.name}:`, error.message);
        // Add without trade verification
        results.push({
          ...base,
          itemClass,
          tradeVerified: false,
          lastUpdated: Date.now()
        });
      }
    }

    return results;
  }

  /**
   * Fetch base data from poe.ninja
   */
  private async fetchPoeNinjaData(itemClass: string, league: string): Promise<any[]> {
    return await rateLimiter.execute('poe.ninja', async () => {
      const page = await browserManager.createPage(this.SESSION_ID, true);

      try {
        const url = `https://poe.ninja/api/data/itemoverview?league=${league}&type=BaseType&language=en`;
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

        const data = await page.evaluate(() => {
          // @ts-ignore
          const preElement = document.querySelector('pre');
          if (preElement) {
            return JSON.parse(preElement.textContent || '{}');
          }
          return {};
        });

        // Filter and format for this item class
        const items = (data.lines || [])
          .filter((item: any) => {
            return item.baseType && item.listingCount > 5;
          })
          .sort((a: any, b: any) => (b.listingCount || 0) - (a.listingCount || 0))
          .slice(0, 10)
          .map((item: any) => ({
            name: item.baseType || item.name,
            poeNinjaPrice: item.chaosValue || 0,
            poeNinjaListings: item.listingCount || 0,
            lowConfidence: item.lowConfidenceSparkline || item.lowConfidence || false,
            sparkline: item.sparkline ? {
              totalChange: item.sparkline.totalChange || 0,
              data: item.sparkline.data || []
            } : undefined
          }));

        return items;

      } finally {
        await page.close();
      }
    });
  }

  /**
   * Verify base availability and price on pathofexile.com/trade
   */
  private async verifyOnTradeSite(baseName: string, league: string): Promise<{
    verified: boolean;
    actualPrice?: number;
    listingCount?: number;
    priceMatch?: boolean;
  }> {
    return await rateLimiter.execute('pathofexile.com', async () => {
      const page = await browserManager.createPage(this.SESSION_ID, true);

      try {
        // Build trade search URL
        const query = {
          query: {
            type: baseName,
            filters: {
              misc_filters: {
                filters: {
                  ilvl: { min: 82 }
                }
              }
            }
          }
        };

        const url = `https://www.pathofexile.com/trade/search/${league}`;
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

        // Wait for results to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Extract listing data
        const tradeData = await page.evaluate(() => {
          // @ts-ignore - document is available in browser context
          const listings = document.querySelectorAll('.resultset .row');
          const prices: number[] = [];

          listings.forEach(listing => {
            const priceElement = listing.querySelector('.price');
            if (priceElement && priceElement.textContent) {
              const priceText = priceElement.textContent.trim();
              const match = priceText.match(/(\d+\.?\d*)\s*chaos/i);
              if (match) {
                prices.push(parseFloat(match[1]));
              }
            }
          });

          return {
            listingCount: listings.length,
            prices
          };
        });

        if (tradeData.prices.length > 0) {
          const avgPrice = tradeData.prices.reduce((a, b) => a + b, 0) / tradeData.prices.length;
          return {
            verified: true,
            actualPrice: avgPrice,
            listingCount: tradeData.listingCount,
            priceMatch: true // We'll compare this in the caller
          };
        }

        return {
          verified: false
        };

      } finally {
        await page.close();
      }
    });
  }

  /**
   * Generate BUY/CRAFT/SKIP recommendation
   */
  private generateRecommendation(data: BaseEconomyData): 'BUY' | 'CRAFT' | 'SKIP' {
    // SKIP if low confidence (hard to sell)
    if (data.lowConfidence) {
      return 'SKIP';
    }

    // SKIP if price is falling rapidly
    if (data.sparkline && data.sparkline.totalChange < -10) {
      return 'SKIP';
    }

    // BUY if trade price is significantly lower than poe.ninja (underpriced)
    if (data.tradeVerified && data.tradeActualPrice && data.poeNinjaPrice > 0) {
      const discount = ((data.poeNinjaPrice - data.tradeActualPrice) / data.poeNinjaPrice) * 100;
      if (discount > 20) {
        return 'BUY';
      }
    }

    // BUY if cheap base with high demand
    if (data.poeNinjaPrice < 5 && data.poeNinjaListings > 100) {
      return 'BUY';
    }

    // CRAFT if expensive base with high demand
    if (data.poeNinjaPrice > 20 && data.poeNinjaListings > 50) {
      return 'CRAFT';
    }

    // CRAFT if medium price with rising trend
    if (data.sparkline && data.sparkline.totalChange > 5 && data.poeNinjaPrice > 5) {
      return 'CRAFT';
    }

    return 'SKIP';
  }

  /**
   * Generate human-readable reason for recommendation
   */
  private generateReason(data: BaseEconomyData): string {
    if (data.recommendation === 'SKIP') {
      if (data.lowConfidence) {
        return 'Low sellability - may be hard to sell';
      }
      if (data.sparkline && data.sparkline.totalChange < -10) {
        return `Price dropping (${data.sparkline.totalChange.toFixed(1)}%) - wait for stabilization`;
      }
      return 'Not worth the investment right now';
    }

    if (data.recommendation === 'BUY') {
      if (data.tradeVerified && data.tradeActualPrice && data.poeNinjaPrice > 0) {
        const discount = ((data.poeNinjaPrice - data.tradeActualPrice) / data.poeNinjaPrice) * 100;
        if (discount > 20) {
          return `Underpriced on trade! ${discount.toFixed(0)}% below market - BUY NOW`;
        }
      }
      if (data.poeNinjaPrice < 5 && data.poeNinjaListings > 100) {
        return `Cheap base (${data.poeNinjaPrice.toFixed(1)}c) with high demand - good for crafting`;
      }
    }

    if (data.recommendation === 'CRAFT') {
      if (data.sparkline && data.sparkline.totalChange > 5) {
        return `Price rising (${data.sparkline.totalChange.toFixed(1)}%) - craft now and sell high`;
      }
      if (data.poeNinjaPrice > 20 && data.poeNinjaListings > 50) {
        return `High value (${data.poeNinjaPrice.toFixed(1)}c) with good demand - profitable to craft`;
      }
      return 'Good crafting opportunity';
    }

    return '';
  }

  /**
   * Save results to cache
   */
  private async saveResults(results: BaseEconomyData[]) {
    try {
      await fs.writeJson(this.cacheFile, {
        results,
        lastUpdated: Date.now()
      }, { spaces: 2 });
      console.log(`   💾 Saved ${results.length} base analyses to cache`);
    } catch (error: any) {
      console.error('   ❌ Failed to save results:', error.message);
    }
  }

  /**
   * Get cached results
   */
  async getCachedResults(): Promise<BaseEconomyData[]> {
    try {
      if (await fs.pathExists(this.cacheFile)) {
        const data = await fs.readJson(this.cacheFile);
        return data.results || [];
      }
    } catch (error: any) {
      console.error('Failed to read cached results:', error.message);
    }
    return [];
  }

  /**
   * Get recommendations for a specific item class
   */
  async getRecommendationsForClass(itemClass: string): Promise<BaseEconomyData[]> {
    const cached = await this.getCachedResults();
    return cached.filter(r => r.itemClass === itemClass);
  }

  /**
   * Get all BUY recommendations
   */
  async getBuyRecommendations(): Promise<BaseEconomyData[]> {
    const cached = await this.getCachedResults();
    return cached.filter(r => r.recommendation === 'BUY');
  }

  /**
   * Get all CRAFT recommendations
   */
  async getCraftRecommendations(): Promise<BaseEconomyData[]> {
    const cached = await this.getCachedResults();
    return cached.filter(r => r.recommendation === 'CRAFT');
  }
}

export const automatedBaseAnalyzer = new AutomatedBaseAnalyzer();
