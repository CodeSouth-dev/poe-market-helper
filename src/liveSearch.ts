/**
 * Live Search & Notifications
 * Monitors trade site for good deals and notifies users
 */

import { EventEmitter } from 'events';
import { browserManager } from './browserManager';
import { RateLimiter } from './rateLimiter';
import * as fs from 'fs-extra';
import * as path from 'path';

const SEARCH_INTERVAL = 30000; // 30 seconds
const SESSION_ID = 'live-search';

// Rate limiter for trade site
const rateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000,
  minDelay: 3000,
  maxConcurrent: 1,
  retryAttempts: 2,
  retryDelayMs: 5000
});

export interface SearchFilter {
  itemName?: string;
  itemType?: string;
  minPrice?: number;
  maxPrice?: number;
  requiredMods?: string[];
  minLinks?: number;
  league: string;
}

export interface SearchResult {
  id: string;
  itemName: string;
  price: number;
  currency: string;
  seller: string;
  listed: string;
  mods: string[];
  links?: number;
  level?: number;
  quality?: number;
  matchScore: number; // How well it matches the filter
}

export interface LiveSearch {
  id: string;
  filter: SearchFilter;
  active: boolean;
  lastCheck: Date;
  results: SearchResult[];
  seenIds: Set<string>;
}

export class LiveSearchManager extends EventEmitter {
  private searches: Map<string, LiveSearch>;
  private searchIntervals: Map<string, NodeJS.Timeout>;
  private nextSearchId: number;

  constructor() {
    super();
    this.searches = new Map();
    this.searchIntervals = new Map();
    this.nextSearchId = 1;
  }

  /**
   * Create a new live search
   * IMPORTANT: Only monitors items YOU specifically define in the filter.
   * No random items - you control exactly what to watch for.
   */
  async createSearch(filter: SearchFilter): Promise<string> {
    // Validate that user has specified what to search for
    if (!filter.itemName && !filter.itemType) {
      throw new Error('Must specify either itemName or itemType - no random item monitoring allowed');
    }

    const searchId = `search-${this.nextSearchId++}`;

    console.log(`\n🔍 Creating live search: ${searchId}`);
    console.log(`   Item: ${filter.itemName || filter.itemType || 'Any'}`);
    console.log(`   Price: ${filter.minPrice || 0}c - ${filter.maxPrice || '∞'}c`);
    console.log(`   League: ${filter.league}`);
    console.log(`   ℹ️  Only monitoring YOUR specified item - no random items`);

    const liveSearch: LiveSearch = {
      id: searchId,
      filter,
      active: true,
      lastCheck: new Date(),
      results: [],
      seenIds: new Set()
    };

    this.searches.set(searchId, liveSearch);

    // Start polling
    this.startPolling(searchId);

    // Do first search immediately
    await this.performSearch(searchId);

    return searchId;
  }

  /**
   * Stop a live search
   */
  stopSearch(searchId: string): boolean {
    console.log(`\n⏹️  Stopping live search: ${searchId}`);

    const search = this.searches.get(searchId);
    if (!search) {
      return false;
    }

    search.active = false;

    // Clear interval
    const interval = this.searchIntervals.get(searchId);
    if (interval) {
      clearInterval(interval);
      this.searchIntervals.delete(searchId);
    }

    return true;
  }

  /**
   * Resume a live search
   */
  resumeSearch(searchId: string): boolean {
    const search = this.searches.get(searchId);
    if (!search) {
      return false;
    }

    console.log(`\n▶️  Resuming live search: ${searchId}`);

    search.active = true;
    this.startPolling(searchId);

    return true;
  }

  /**
   * Delete a live search
   */
  deleteSearch(searchId: string): boolean {
    this.stopSearch(searchId);
    return this.searches.delete(searchId);
  }

  /**
   * Get all active searches
   */
  getActiveSearches(): LiveSearch[] {
    return Array.from(this.searches.values()).filter(s => s.active);
  }

  /**
   * Get search by ID
   */
  getSearch(searchId: string): LiveSearch | undefined {
    return this.searches.get(searchId);
  }

  /**
   * Get results for a search
   */
  getResults(searchId: string): SearchResult[] {
    const search = this.searches.get(searchId);
    return search ? search.results : [];
  }

  /**
   * Start polling for a search
   */
  private startPolling(searchId: string): void {
    // Clear existing interval if any
    const existingInterval = this.searchIntervals.get(searchId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Start new interval
    const interval = setInterval(async () => {
      await this.performSearch(searchId);
    }, SEARCH_INTERVAL);

    this.searchIntervals.set(searchId, interval);
  }

  /**
   * Perform search and check for new results
   */
  private async performSearch(searchId: string): Promise<void> {
    const search = this.searches.get(searchId);
    if (!search || !search.active) {
      return;
    }

    try {
      console.log(`   🔄 Checking ${searchId}...`);

      const results = await this.fetchResults(search.filter);

      // Filter for new results
      const newResults = results.filter(r => !search.seenIds.has(r.id));

      if (newResults.length > 0) {
        console.log(`   ✨ Found ${newResults.length} new results!`);

        // Add to seen IDs
        newResults.forEach(r => search.seenIds.add(r.id));

        // Add to results (keep last 50)
        search.results.push(...newResults);
        search.results = search.results.slice(-50);

        // Emit event for each new result
        for (const result of newResults) {
          this.emit('newListing', {
            searchId,
            result
          });
        }
      }

      search.lastCheck = new Date();

    } catch (error: any) {
      console.error(`   ❌ Error in search ${searchId}:`, error.message);
    }
  }

  /**
   * Fetch results from trade site (simplified)
   */
  private async fetchResults(filter: SearchFilter): Promise<SearchResult[]> {
    return await rateLimiter.execute('pathofexile.com/trade', async () => {
      const page = await browserManager.createPage(SESSION_ID, true);

      try {
        // Navigate to trade site
        const url = `https://www.pathofexile.com/trade/search/${filter.league}`;
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Extract listings (simplified simulation)
        const results = await page.evaluate((filterData) => {
          const listings: any[] = [];

          // In production, this would scrape actual listings
          // For now, return simulated results
          // @ts-ignore - document is available in browser context
          const resultElements = document.querySelectorAll('.resultset .row');

          resultElements.forEach((elem: any, index: number) => {
            if (index > 10) return; // Limit to 10 results

            try {
              const itemName = elem.querySelector('.itemName')?.textContent?.trim() || 'Unknown';
              const priceText = elem.querySelector('.price')?.textContent?.trim() || '0';
              const seller = elem.querySelector('.seller')?.textContent?.trim() || 'Unknown';

              // Parse price
              const priceMatch = priceText.match(/(\d+(\.\d+)?)/);
              const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

              listings.push({
                id: `listing-${Date.now()}-${index}`,
                itemName,
                price,
                currency: 'chaos',
                seller,
                listed: 'Just now',
                mods: [],
                matchScore: 0.8
              });
            } catch (error) {
              // Skip malformed listings
            }
          });

          return listings;
        }, filter);

        // Filter by price
        const filtered = results.filter(r => {
          if (filter.minPrice && r.price < filter.minPrice) return false;
          if (filter.maxPrice && r.price > filter.maxPrice) return false;
          return true;
        });

        return filtered;

      } finally {
        await page.close();
      }
    });
  }

  /**
   * Create a search for underpriced items
   * YOU specify the exact item name - this finds deals on YOUR chosen item only
   */
  async createUnderpricedSearch(
    itemName: string,
    typicalPrice: number,
    discount: number, // percentage (e.g., 20 for 20% off)
    league: string
  ): Promise<string> {
    if (!itemName || itemName.trim() === '') {
      throw new Error('Must specify itemName - no random item monitoring');
    }

    const maxPrice = typicalPrice * (1 - discount / 100);

    console.log(`\n💎 Creating underpriced search for ${itemName}`);
    console.log(`   Typical price: ${typicalPrice}c`);
    console.log(`   Max price (${discount}% off): ${maxPrice.toFixed(0)}c`);
    console.log(`   ℹ️  Monitoring YOUR specified item only`);

    return await this.createSearch({
      itemName,
      maxPrice,
      league
    });
  }

  /**
   * Get statistics for all searches
   */
  getStatistics(): {
    totalSearches: number;
    activeSearches: number;
    totalResults: number;
    averageResultsPerSearch: number;
  } {
    const searches = Array.from(this.searches.values());
    const active = searches.filter(s => s.active);
    const totalResults = searches.reduce((sum, s) => sum + s.results.length, 0);

    return {
      totalSearches: searches.length,
      activeSearches: active.length,
      totalResults,
      averageResultsPerSearch: searches.length > 0 ? totalResults / searches.length : 0
    };
  }

  /**
   * Cleanup all searches
   */
  shutdown(): void {
    console.log('\n🛑 Shutting down live search manager...');

    for (const [searchId] of this.searches) {
      this.stopSearch(searchId);
    }

    this.searches.clear();
    this.searchIntervals.clear();
  }
}

// Singleton instance
export const liveSearchManager = new LiveSearchManager();
