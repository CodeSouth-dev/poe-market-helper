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
      'Gem',
      'Currency',
      'Fragment',
      'Essence',
      'DivinationCard',
      'Prophecy',
      'Oil',
      'Incubator',
      'Scarab',
      'Fossil',
      'Resonator',
      'Beast',
      'Vial'
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
   * Get available leagues
   */
  async getLeagues(): Promise<string[]> {
    try {
      // Common leagues - you might want to fetch this dynamically
      return ['Crucible', 'Hardcore Crucible', 'Standard', 'Hardcore'];
    } catch (error) {
      console.error('Failed to fetch leagues:', error);
      return ['Crucible']; // Fallback
    }
  }
}
