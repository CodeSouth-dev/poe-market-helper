import * as fs from 'fs-extra';
import * as path from 'path';

export interface CacheEntry {
  data: any;
  timestamp: Date;
  ttl: number; // Time to live in minutes
}

export class CacheManager {
  private readonly cacheDir: string;
  private readonly defaultTTL: number = 5; // 5 minutes default

  constructor() {
    this.cacheDir = path.join(process.cwd(), 'data', 'cache');
    this.ensureCacheDir();
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.ensureDir(this.cacheDir);
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  /**
   * Generate cache file path for a key
   */
  private getCacheFilePath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.cacheDir, `${safeKey}.json`);
  }

  /**
   * Set a value in cache
   */
  async set(key: string, data: any, ttlMinutes: number = this.defaultTTL): Promise<void> {
    try {
      const cacheEntry: CacheEntry = {
        data,
        timestamp: new Date(),
        ttl: ttlMinutes
      };

      const filePath = this.getCacheFilePath(key);
      await fs.writeJson(filePath, cacheEntry, { spaces: 2 });
      
      console.log(`Cached data for key: ${key}`);
    } catch (error) {
      console.error(`Failed to cache data for key ${key}:`, error);
    }
  }

  /**
   * Get a value from cache
   */
  async get(key: string): Promise<any | null> {
    try {
      const filePath = this.getCacheFilePath(key);
      
      if (!(await fs.pathExists(filePath))) {
        return null;
      }

      const cacheEntry: CacheEntry = await fs.readJson(filePath);
      
      // Check if cache has expired
      const now = new Date();
      const cacheTime = new Date(cacheEntry.timestamp);
      const diffMinutes = (now.getTime() - cacheTime.getTime()) / (1000 * 60);

      if (diffMinutes > cacheEntry.ttl) {
        console.log(`Cache expired for key: ${key}`);
        await this.delete(key);
        return null;
      }

      console.log(`Cache hit for key: ${key}`);
      return cacheEntry.data;
    } catch (error) {
      console.error(`Failed to get cached data for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete a cache entry
   */
  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getCacheFilePath(key);
      await fs.remove(filePath);
      console.log(`Deleted cache for key: ${key}`);
    } catch (error) {
      console.error(`Failed to delete cache for key ${key}:`, error);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      await fs.emptyDir(this.cacheDir);
      console.log('Cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ totalFiles: number; totalSize: number }> {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        }
      }

      return {
        totalFiles: files.filter((f: string) => f.endsWith('.json')).length,
        totalSize
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return { totalFiles: 0, totalSize: 0 };
    }
  }

  /**
   * Check if a key exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    const data = await this.get(key);
    return data !== null;
  }
}