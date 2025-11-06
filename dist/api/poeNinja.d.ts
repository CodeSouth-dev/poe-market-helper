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
     * Get available leagues
     */
    getLeagues(): Promise<string[]>;
}
/**
 * Standalone function to search for items
 * Can be used by other modules without creating a new instance
 */
export declare function searchItem(itemName: string, league?: string): Promise<SearchResult>;
