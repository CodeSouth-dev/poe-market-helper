"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
class CacheManager {
    constructor() {
        this.defaultTTL = 5; // 5 minutes default
        this.cacheDir = path.join(process.cwd(), 'data', 'cache');
        this.ensureCacheDir();
    }
    /**
     * Ensure cache directory exists
     */
    async ensureCacheDir() {
        try {
            await fs.ensureDir(this.cacheDir);
        }
        catch (error) {
            console.error('Failed to create cache directory:', error);
        }
    }
    /**
     * Generate cache file path for a key
     */
    getCacheFilePath(key) {
        const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_');
        return path.join(this.cacheDir, `${safeKey}.json`);
    }
    /**
     * Set a value in cache
     */
    async set(key, data, ttlMinutes = this.defaultTTL) {
        try {
            const cacheEntry = {
                data,
                timestamp: new Date(),
                ttl: ttlMinutes
            };
            const filePath = this.getCacheFilePath(key);
            await fs.writeJson(filePath, cacheEntry, { spaces: 2 });
            console.log(`Cached data for key: ${key}`);
        }
        catch (error) {
            console.error(`Failed to cache data for key ${key}:`, error);
        }
    }
    /**
     * Get a value from cache
     */
    async get(key) {
        try {
            const filePath = this.getCacheFilePath(key);
            if (!(await fs.pathExists(filePath))) {
                return null;
            }
            const cacheEntry = await fs.readJson(filePath);
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
        }
        catch (error) {
            console.error(`Failed to get cached data for key ${key}:`, error);
            return null;
        }
    }
    /**
     * Delete a cache entry
     */
    async delete(key) {
        try {
            const filePath = this.getCacheFilePath(key);
            await fs.remove(filePath);
            console.log(`Deleted cache for key: ${key}`);
        }
        catch (error) {
            console.error(`Failed to delete cache for key ${key}:`, error);
        }
    }
    /**
     * Clear all cache
     */
    async clear() {
        try {
            await fs.emptyDir(this.cacheDir);
            console.log('Cache cleared');
        }
        catch (error) {
            console.error('Failed to clear cache:', error);
        }
    }
    /**
     * Get cache statistics
     */
    async getStats() {
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
                totalFiles: files.filter((f) => f.endsWith('.json')).length,
                totalSize
            };
        }
        catch (error) {
            console.error('Failed to get cache stats:', error);
            return { totalFiles: 0, totalSize: 0 };
        }
    }
    /**
     * Check if a key exists and is not expired
     */
    async has(key) {
        const data = await this.get(key);
        return data !== null;
    }
}
exports.CacheManager = CacheManager;
//# sourceMappingURL=cache.js.map