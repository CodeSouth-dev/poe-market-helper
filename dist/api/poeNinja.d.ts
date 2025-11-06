export interface Sparkline {
    data: number[];
    totalChange: number;
}
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
export interface PoeNinjaItem {
    id?: number;
    name: string;
    icon?: string;
    chaosValue: number;
    exaltedValue?: number;
    divineValue?: number;
    count: number;
    detailsId?: string;
    listingCount?: number;
    sparkline?: Sparkline;
    lowConfidenceSparkline?: Sparkline;
    pay?: CurrencyPayReceive;
    receive?: CurrencyPayReceive;
    paySparkLine?: Sparkline;
    receiveSparkLine?: Sparkline;
    lowConfidencePaySparkLine?: Sparkline;
    lowConfidenceReceiveSparkLine?: Sparkline;
    links?: number;
    mapTier?: number;
    levelRequired?: number;
    baseType?: string;
    variant?: string;
    itemClass?: number;
    implicitModifiers?: Array<{
        text: string;
        optional?: boolean;
    }>;
    explicitModifiers?: Array<{
        text: string;
        optional?: boolean;
    }>;
    corrupted?: boolean;
    gemLevel?: number;
    gemQuality?: number;
    itemType?: string;
    isPopular?: boolean;
    volumePerHour?: number;
    confidenceLevel?: 'high' | 'medium' | 'low';
}
export interface PoeNinjaResponse {
    lines: PoeNinjaItem[];
    currencyDetails?: any[];
    language?: any;
}
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
    mostPopular?: PoeNinjaItem;
    totalVolume?: number;
    averageConfidence?: 'high' | 'medium' | 'low';
}
export declare class PoeNinjaAPI {
    private readonly baseUrl;
    private readonly timeout;
    /**
     * Search for an item across different categories
     */
    searchItem(itemName: string, league: string): Promise<SearchResult>;
    /**
     * Search a specific category
     */
    private searchCategory;
    /**
     * Get the correct endpoint for each category
     */
    private getCategoryEndpoint;
    /**
     * Calculate median from array of numbers
     */
    private calculateMedian;
    /**
     * Get available leagues from Path of Exile official API
     */
    getLeagues(): Promise<string[]>;
    /**
     * Get fallback leagues when API fails
     */
    private getFallbackLeagues;
    /**
     * Enrich item data with calculated metrics
     */
    private enrichItemData;
    /**
     * Calculate confidence level for an item
     */
    private calculateConfidenceLevel;
    /**
     * Calculate estimated volume per hour
     */
    private calculateVolumePerHour;
    /**
     * Determine if an item is popular
     */
    private isItemPopular;
    /**
     * Calculate average confidence from multiple items
     */
    private calculateAverageConfidence;
    /**
     * Get adaptive value display (chooses best currency to display)
     */
    getAdaptiveValue(item: PoeNinjaItem): {
        value: number;
        currency: string;
    };
    /**
     * Format adaptive value for display
     */
    formatAdaptiveValue(item: PoeNinjaItem): string;
}
