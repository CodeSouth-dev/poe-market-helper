import axios from 'axios';

// Sparkline data for price trends
export interface Sparkline {
  data: number[];
  totalChange: number;
}

// Currency-specific pay/receive data
export interface CurrencyPayReceive {
  id: number;
  league_id: number;
  pay_currency_id: number;
  get_currency_id: number;
  sample_time_utc: string;
  count: number;
  value: number;
  data_point_count: number;
  includes_secondary: boolean;
  listing_count: number;
}

// Enhanced item interface with economy data
export interface PoeNinjaItem {
  id?: number;
  name: string;
  icon?: string;
  chaosValue: number;
  exaltedValue?: number;
  divineValue?: number;
  count: number;
  detailsId?: string;

  // Listing and volume metrics
  listingCount?: number;

  // Price trend data
  sparkline?: Sparkline;
  lowConfidenceSparkline?: Sparkline;

  // Currency-specific fields
  pay?: CurrencyPayReceive;
  receive?: CurrencyPayReceive;
  paySparkLine?: Sparkline;
  receiveSparkLine?: Sparkline;
  lowConfidencePaySparkLine?: Sparkline;
  lowConfidenceReceiveSparkLine?: Sparkline;

  // Item properties
  links?: number;
  mapTier?: number;
  levelRequired?: number;
  baseType?: string;
  variant?: string;
  itemClass?: number;

  // Modifiers
  implicitModifiers?: Array<{text: string; optional?: boolean}>;
  explicitModifiers?: Array<{text: string; optional?: boolean}>;

  // Additional metadata
  corrupted?: boolean;
  gemLevel?: number;
  gemQuality?: number;
  itemType?: string;

  // Confidence and popularity indicators
  isPopular?: boolean;
  volumePerHour?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
}

export interface PoeNinjaResponse {
  lines: PoeNinjaItem[];
  currencyDetails?: any[];
  language?: any;
}

// League information from official PoE API
export interface League {
  id: string;
  realm?: string;
  description?: string;
  category?: {
    id: string;
    current?: boolean;
  };
  rules?: any[];
  registerAt?: string;
  event?: boolean;
  url?: string;
  startAt?: string;
  endAt?: string | null;
  timedEvent?: boolean;
  scoreEvent?: boolean;
  delveEvent?: boolean;
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

  // Economy metrics
  mostPopular?: PoeNinjaItem;
  totalVolume?: number;
  averageConfidence?: 'high' | 'medium' | 'low';
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

    // Enrich results with calculated metrics
    const enrichedResults = filteredResults.map(item => this.enrichItemData(item));

    // Calculate statistics
    const prices = enrichedResults.map(item => item.chaosValue).filter(price => price > 0);
    const totalListings = enrichedResults.reduce((sum, item) => sum + (item.listingCount || item.count || 0), 0);

    // Calculate total volume per hour
    const totalVolume = enrichedResults.reduce((sum, item) => sum + (item.volumePerHour || 0), 0);

    // Find most popular item (highest listing count)
    const mostPopular = enrichedResults.length > 0
      ? enrichedResults.reduce((prev, current) =>
          (current.listingCount || 0) > (prev.listingCount || 0) ? current : prev
        )
      : undefined;

    // Calculate average confidence
    const confidenceLevels = enrichedResults
      .map(item => item.confidenceLevel)
      .filter((level): level is 'high' | 'medium' | 'low' => level !== undefined);
    const averageConfidence = this.calculateAverageConfidence(confidenceLevels);

    return {
      itemName,
      league,
      results: enrichedResults,
      timestamp: new Date(),
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      medianPrice: this.calculateMedian(prices),
      totalListings,
      mostPopular,
      totalVolume,
      averageConfidence
    };
  }

  /**
   * Search a specific category
   */
  private async searchCategory(searchTerm: string, league: string, category: string): Promise<PoeNinjaItem[]> {
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
      return response.data.lines.filter((item: any) => {
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
   * Get available leagues from Path of Exile official API
   */
  async getLeagues(): Promise<string[]> {
    try {
      const response = await axios.get<League[]>('https://api.pathofexile.com/leagues', {
        timeout: this.timeout,
        params: {
          type: 'main',
          compact: 1
        }
      });

      if (!response.data || !Array.isArray(response.data)) {
        console.warn('Invalid league data received, using fallback');
        return this.getFallbackLeagues();
      }

      // Filter for current/active leagues
      const leagues = response.data
        .filter((league: League) => !league.event) // Exclude events
        .map((league: League) => league.id);

      return leagues.length > 0 ? leagues : this.getFallbackLeagues();
    } catch (error: any) {
      console.error('Failed to fetch leagues:', error);
      return this.getFallbackLeagues();
    }
  }

  /**
   * Get fallback leagues when API fails
   */
  private getFallbackLeagues(): string[] {
    return ['Settlers', 'Hardcore Settlers', 'Standard', 'Hardcore'];
  }

  /**
   * Enrich item data with calculated metrics
   */
  private enrichItemData(item: PoeNinjaItem): PoeNinjaItem {
    // Calculate confidence level based on sparkline data
    const confidenceLevel = this.calculateConfidenceLevel(item);

    // Calculate volume per hour (estimate based on count and sparkline)
    const volumePerHour = this.calculateVolumePerHour(item);

    // Determine if item is popular (high listing count relative to value)
    const isPopular = this.isItemPopular(item);

    return {
      ...item,
      confidenceLevel,
      volumePerHour,
      isPopular
    };
  }

  /**
   * Calculate confidence level for an item
   */
  private calculateConfidenceLevel(item: PoeNinjaItem): 'high' | 'medium' | 'low' {
    const listingCount = item.listingCount || item.count || 0;
    const hasLowConfidenceData = (item.lowConfidenceSparkline?.data && item.lowConfidenceSparkline.data.length > 0) ||
                                  (item.lowConfidencePaySparkLine?.data && item.lowConfidencePaySparkLine.data.length > 0);

    // High confidence: Many listings and no low confidence indicators
    if (listingCount >= 50 && !hasLowConfidenceData) {
      return 'high';
    }

    // Low confidence: Few listings or low confidence sparkline data exists
    if (listingCount < 10 || hasLowConfidenceData) {
      return 'low';
    }

    // Medium confidence: Everything else
    return 'medium';
  }

  /**
   * Calculate estimated volume per hour
   */
  private calculateVolumePerHour(item: PoeNinjaItem): number {
    // Use sparkline data to estimate trading volume
    const sparklineData = item.sparkline?.data || item.receiveSparkLine?.data || [];

    if (sparklineData.length === 0) {
      // No sparkline data, estimate from count
      const count = item.count || item.listingCount || 0;
      // Assume data is collected over 24 hours
      return count / 24;
    }

    // Calculate average change from sparkline (represents activity)
    const avgChange = sparklineData.reduce((sum, val) => sum + Math.abs(val), 0) / sparklineData.length;
    const count = item.count || item.listingCount || 0;

    // Estimate volume based on count and activity
    return (count * (1 + avgChange / 100)) / 24;
  }

  /**
   * Determine if an item is popular
   */
  private isItemPopular(item: PoeNinjaItem): boolean {
    const listingCount = item.listingCount || item.count || 0;
    const chaosValue = item.chaosValue || 0;

    // Popular items have high listing counts
    // Or high value items with decent listing counts
    return listingCount >= 100 || (chaosValue >= 100 && listingCount >= 20);
  }

  /**
   * Calculate average confidence from multiple items
   */
  private calculateAverageConfidence(levels: Array<'high' | 'medium' | 'low'>): 'high' | 'medium' | 'low' {
    if (levels.length === 0) return 'medium';

    const weights = { high: 3, medium: 2, low: 1 };
    const avgWeight = levels.reduce((sum, level) => sum + weights[level], 0) / levels.length;

    if (avgWeight >= 2.5) return 'high';
    if (avgWeight >= 1.5) return 'medium';
    return 'low';
  }

  /**
   * Get adaptive value display (chooses best currency to display)
   */
  getAdaptiveValue(item: PoeNinjaItem): { value: number; currency: string } {
    const chaos = item.chaosValue || 0;
    const divine = item.divineValue || 0;
    const exalted = item.exaltedValue || 0;

    // If item is worth more than 10 divine, display in divine
    if (divine >= 10) {
      return { value: divine, currency: 'divine' };
    }

    // If item is worth more than 100 chaos but less than 10 divine, show both
    if (chaos >= 100 && divine > 0) {
      return { value: divine, currency: 'divine' };
    }

    // If exalted value is significant (legacy support)
    if (exalted >= 10) {
      return { value: exalted, currency: 'exalted' };
    }

    // Default to chaos
    return { value: chaos, currency: 'chaos' };
  }

  /**
   * Format adaptive value for display
   */
  formatAdaptiveValue(item: PoeNinjaItem): string {
    const { value, currency } = this.getAdaptiveValue(item);
    const formatted = value.toFixed(2);

    const symbols: { [key: string]: string } = {
      chaos: 'c',
      divine: 'd',
      exalted: 'ex'
    };

    return `${formatted}${symbols[currency] || currency}`;
  }
}
