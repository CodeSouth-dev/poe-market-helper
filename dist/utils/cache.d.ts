export interface CacheEntry {
    data: any;
    timestamp: Date;
    ttl: number;
}
export declare class CacheManager {
    private readonly cacheDir;
    private readonly defaultTTL;
    constructor();
    /**
     * Ensure cache directory exists
     */
    private ensureCacheDir;
    /**
     * Generate cache file path for a key
     */
    private getCacheFilePath;
    /**
     * Set a value in cache
     */
    set(key: string, data: any, ttlMinutes?: number): Promise<void>;
    /**
     * Get a value from cache
     */
    get(key: string): Promise<any | null>;
    /**
     * Delete a cache entry
     */
    delete(key: string): Promise<void>;
    /**
     * Clear all cache
     */
    clear(): Promise<void>;
    /**
     * Get cache statistics
     */
    getStats(): Promise<{
        totalFiles: number;
        totalSize: number;
    }>;
    /**
     * Check if a key exists and is not expired
     */
    has(key: string): Promise<boolean>;
}
