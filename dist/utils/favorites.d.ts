export interface FavoriteItem {
    name: string;
    baseType?: string;
    league: string;
    addedAt: Date;
    lastChecked?: Date;
    lastPrice?: number;
}
export declare class FavoritesManager {
    private readonly favoritesFile;
    private favorites;
    constructor();
    /**
     * Load favorites from file
     */
    private loadFavorites;
    /**
     * Save favorites to file
     */
    private saveFavorites;
    /**
     * Get all favorites
     */
    getAll(): Promise<FavoriteItem[]>;
    /**
     * Add item to favorites
     */
    add(item: Omit<FavoriteItem, 'addedAt'>): Promise<void>;
    /**
     * Remove item from favorites
     */
    remove(itemName: string, league?: string): Promise<void>;
    /**
     * Update last checked time and price for an item
     */
    updateLastChecked(itemName: string, league: string, price?: number): Promise<void>;
    /**
     * Check if item is in favorites
     */
    isFavorite(itemName: string, league: string): boolean;
    /**
     * Get favorites by league
     */
    getByLeague(league: string): FavoriteItem[];
    /**
     * Clear all favorites
     */
    clear(): Promise<void>;
    /**
     * Export favorites to JSON string
     */
    export(): string;
    /**
     * Import favorites from JSON string
     */
    import(jsonString: string): Promise<void>;
}
