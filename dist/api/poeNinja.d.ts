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
    searchCategory(searchTerm: string, league: string, category: string): Promise<PoeNinjaItem[]>;
    /**
     * Search for map crafting items
     */
    searchMapCrafting(itemName: string, league: string): Promise<SearchResult>;
    /**
     * Get item crafting categories
     */
    private getItemCraftingCategories;
    /**
     * Get map crafting categories
     */
    private getMapCraftingCategories;
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
