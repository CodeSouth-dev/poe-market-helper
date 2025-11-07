import axios from 'axios';

export interface PoeNinjaItem {
  name: string;
  chaosValue: number;
  exaltedValue?: number;
  divineValue?: number;
  count: number;
  detailsId?: string;
  listingCount?: number;
  links?: number;
  mapTier?: number;
  levelRequired?: number;
  baseType?: string;
  variant?: string;
}

export interface PoeNinjaResponse {
  lines: PoeNinjaItem[];
  currencyDetails?: any[];
  language?: any;
}

export interface SearchResult {
  itemName: string;
  league: string;
  results: PoeNinjaItem[];
  timestamp: Date;
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
  totalListings: number;
}

export class PoeNinjaAPI {
  private readonly baseUrl = 'https://poe.ninja/api/data';
  private readonly timeout = 10000; // 10 seconds

  /**
   * Search for an item across different categories
   */
  async searchItem(itemName: string, league: string): Promise<SearchResult> {
    const searchTerm = itemName.toLowerCase().trim();
    let allResults: PoeNinjaItem[] = [];

    // Define the categories to search
    const categories = [
      'UniqueWeapon',
      'UniqueArmour',
      'UniqueAccessory',
      'UniqueFlask',
      'UniqueJewel',
      'UniqueMap',
      'SkillGem',
      'Currency',
      'Fragment',
      'Essence',
      'DivinationCard',
      'Oil',
      'Incubator',
      'Scarab',
      'Fossil',
      'Resonator',
      'Beast'
    ];

    // Search through each category
    for (const category of categories) {
      try {
        const categoryResults = await this.searchCategory(searchTerm, league, category);
        allResults = allResults.concat(categoryResults);
      } catch (error: any) {
        console.warn(`Failed to search category ${category}:`, error.message);
        // Continue with other categories
      }
    }

    // Filter and sort results
    const filteredResults = allResults.filter(item => 
      item.name.toLowerCase().includes(searchTerm) ||
      (item.baseType && item.baseType.toLowerCase().includes(searchTerm))
    );

    // Calculate statistics
    const prices = filteredResults.map(item => item.chaosValue).filter(price => price > 0);
    const totalListings = filteredResults.reduce((sum, item) => sum + (item.listingCount || item.count || 0), 0);

    return {
      itemName,
      league,
      results: filteredResults,
      timestamp: new Date(),
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      medianPrice: this.calculateMedian(prices),
      totalListings
    };
  }

  /**
   * Search a specific category
   */
  public async searchCategory(searchTerm: string, league: string, category: string): Promise<PoeNinjaItem[]> {
    const endpoint = this.getCategoryEndpoint(category);
    const url = `${this.baseUrl}/${endpoint}`;
    
    const params = {
      league,
      type: category,
      language: 'en'
    };

    try {
      const response = await axios.get<PoeNinjaResponse>(url, {
        params,
        timeout: this.timeout,
        headers: {
          'User-Agent': 'PoE-Market-Helper/1.0.0'
        }
      });

      if (!response.data || !response.data.lines) {
        return [];
      }

      // Filter results that match the search term
      return response.data.lines.filter(item => {
        const name = item.name.toLowerCase();
        const baseType = item.baseType ? item.baseType.toLowerCase() : '';
        return name.includes(searchTerm) || baseType.includes(searchTerm);
      });

    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Timeout searching ${category}`);
      }
      throw new Error(`Failed to search ${category}: ${error.message}`);
    }
  }

  /**
   * Get the correct endpoint for each category
   */
  private getCategoryEndpoint(category: string): string {
    const currencyTypes = ['Currency', 'Fragment'];
    return currencyTypes.includes(category) ? 'currencyoverview' : 'itemoverview';
  }

  /**
   * Calculate median from array of numbers
   */
  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Get available leagues by testing the API
   */
  async getLeagues(): Promise<string[]> {
    try {
      // Known possible leagues to test - ordered by recency (current league first)
      const leaguesToTest = [
        'Keepers of the Flame',
        'Keepers',
        'Settlers of Kalguur',
        'Settlers',
        'Standard',
        'Hardcore',
        'SSF Standard',
        'SSF Hardcore'
      ];

      const validLeagues: string[] = [];

      // Test each league by attempting to fetch currency data
      for (const league of leaguesToTest) {
        try {
          const url = `${this.baseUrl}/currencyoverview`;
          const response = await axios.get(url, {
            params: { league, type: 'Currency' },
            timeout: 5000
          });

          if (response.data && response.data.lines && response.data.lines.length > 0) {
            validLeagues.push(league);
          }
        } catch (error) {
          // League doesn't exist or API error, skip it
          continue;
        }
      }

      // Always include Standard as fallback
      if (validLeagues.length === 0) {
        validLeagues.push('Standard', 'Hardcore');
      }

      console.log('Available leagues:', validLeagues);
      return validLeagues;
    } catch (error) {
      console.error('Failed to fetch leagues:', error);
      return ['Keepers of the Flame', 'Standard', 'Hardcore']; // Fallback with current league
    }
  }

  /**
   * Get popular/high-demand items based on listing counts
   */
  async getPopularItems(league: string, limit: number = 20): Promise<PoeNinjaItem[]> {
    const allItems: PoeNinjaItem[] = [];

    // Categories most relevant for trading
    const categories = [
      'UniqueWeapon',
      'UniqueArmour',
      'UniqueAccessory',
      'UniqueJewel',
      'UniqueFlask',
      'SkillGem'
    ];

    for (const category of categories) {
      try {
        const items = await this.searchCategory('', league, category);
        allItems.push(...items);
      } catch (error) {
        console.warn(`Failed to fetch ${category}:`, error);
      }
    }

    // Sort by listing count (higher = more demand) and value
    const popularItems = allItems
      .filter(item => item.listingCount && item.listingCount > 10) // At least 10 listings
      .sort((a, b) => {
        // Combine listing count and value for popularity score
        const scoreA = (a.listingCount || 0) * 0.7 + (a.chaosValue || 0) * 0.3;
        const scoreB = (b.listingCount || 0) * 0.7 + (b.chaosValue || 0) * 0.3;
        return scoreB - scoreA;
      })
      .slice(0, limit);

    return popularItems;
  }

  /**
   * Get items with best profit margins for crafting
   * Returns all craftable base types including:
   * - Normal/magic/rare items
   * - Fractured items (locked mods, rest craftable)
   * - Synthesized items (special implicit, explicit mods craftable)
   * - Influenced items (Shaper/Elder/Conqueror - prime crafting bases)
   * - 4/5/6-link items (part of crafting process)
   *
   * EXCLUDES:
   * - Unique items (already excluded via BaseType category)
   * - Corrupted items (cannot be modified)
   */
  async getProfitableItems(league: string, limit: number = 20): Promise<Array<{
    item: PoeNinjaItem;
    profitMargin: number;
    sellPrice: number;
    demand: string;
    craftingMethod: string;
  }>> {
    const allItems: PoeNinjaItem[] = [];

    // ONLY use BaseType - these are craftable items
    // Uniques are in separate categories (UniqueWeapon, UniqueArmour, etc.)
    try {
      const baseTypes = await this.searchCategory('', league, 'BaseType');
      allItems.push(...baseTypes);
    } catch (error) {
      console.warn('Failed to fetch base types:', error);
    }

    // Calculate profit margins for craftable bases
    const profitableItems = allItems
      .filter(item => {
        // Must be valuable enough and have decent trading activity
        if (!(item.chaosValue > 20 && item.listingCount && item.listingCount > 3)) {
          return false;
        }

        // Only exclude corrupted items - they cannot be modified
        const variant = (item.variant || '').toLowerCase();
        if (variant.includes('corrupt')) {
          return false;
        }

        // Everything else in BaseType category is craftable:
        // - Normal/magic/rare bases
        // - Fractured bases (locked mods but rest is craftable)
        // - Synthesized bases (implicit locked, explicit craftable)
        // - Influenced bases (Shaper/Elder/Conqueror - valuable crafting bases)
        // - Any link count (4/5/6-link are all craftable)

        return true;
      })
      .map(item => {
        const sellPrice = item.chaosValue;
        const listings = item.listingCount || 0;

        // Estimate crafting cost based on item value
        // Base cost + crafting materials (fossils/essences/chaos)
        let estimatedCraftCost: number;
        let craftingMethod: string;

        if (sellPrice > 500) {
          // High-value items: fossil/essence crafting
          estimatedCraftCost = sellPrice * 0.4;
          craftingMethod = 'Fossil/Essence';
        } else if (sellPrice > 100) {
          // Medium-value: chaos spam or targeted crafting
          estimatedCraftCost = sellPrice * 0.35;
          craftingMethod = 'Chaos/Fossil';
        } else {
          // Lower-value: alteration or chaos spam
          estimatedCraftCost = sellPrice * 0.3;
          craftingMethod = 'Alt/Chaos';
        }

        const profitMargin = sellPrice - estimatedCraftCost;

        // Demand indicator based on listing count
        let demand = 'Low';
        if (listings > 30) demand = 'High';
        else if (listings > 10) demand = 'Medium';

        return {
          item,
          profitMargin,
          sellPrice,
          demand,
          craftingMethod
        };
      })
      .sort((a, b) => b.profitMargin - a.profitMargin)
      .slice(0, limit);

    return profitableItems;
  }

  /**
   * Get trending items (recent price increases)
   */
  async getTrendingItems(league: string, limit: number = 10): Promise<PoeNinjaItem[]> {
    const allItems: PoeNinjaItem[] = [];

    const categories = [
      'UniqueWeapon',
      'UniqueArmour',
      'UniqueAccessory',
      'SkillGem'
    ];

    for (const category of categories) {
      try {
        const items = await this.searchCategory('', league, category);
        allItems.push(...items);
      } catch (error) {
        console.warn(`Failed to fetch ${category}:`, error);
      }
    }

    // Items with higher value and good listing counts are likely trending
    const trending = allItems
      .filter(item => item.chaosValue > 5 && item.listingCount && item.listingCount > 10)
      .sort((a, b) => {
        // Sort by value * listing count (proxy for demand)
        const scoreA = a.chaosValue * Math.log(a.listingCount || 1);
        const scoreB = b.chaosValue * Math.log(b.listingCount || 1);
        return scoreB - scoreA;
      })
      .slice(0, limit);

    return trending;
  }
}

/**
 * Standalone helper function for searching items
 * Creates a PoeNinjaAPI instance and calls searchItem
 */
export async function searchItem(itemName: string, league: string): Promise<SearchResult> {
  const api = new PoeNinjaAPI();
  return api.searchItem(itemName, league);
}
