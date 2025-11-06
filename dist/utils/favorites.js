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
exports.FavoritesManager = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
class FavoritesManager {
    constructor() {
        this.favorites = [];
        this.favoritesFile = path.join(process.cwd(), 'data', 'favorites.json');
        this.loadFavorites();
    }
    /**
     * Load favorites from file
     */
    async loadFavorites() {
        try {
            // Ensure data directory exists
            await fs.ensureDir(path.dirname(this.favoritesFile));
            if (await fs.pathExists(this.favoritesFile)) {
                this.favorites = await fs.readJson(this.favoritesFile);
                console.log(`Loaded ${this.favorites.length} favorites`);
            }
            else {
                this.favorites = [];
                await this.saveFavorites();
            }
        }
        catch (error) {
            console.error('Failed to load favorites:', error);
            this.favorites = [];
        }
    }
    /**
     * Save favorites to file
     */
    async saveFavorites() {
        try {
            await fs.writeJson(this.favoritesFile, this.favorites, { spaces: 2 });
            console.log('Favorites saved');
        }
        catch (error) {
            console.error('Failed to save favorites:', error);
        }
    }
    /**
     * Get all favorites
     */
    async getAll() {
        return [...this.favorites];
    }
    /**
     * Add item to favorites
     */
    async add(item) {
        // Check if already exists
        const exists = this.favorites.some(fav => fav.name.toLowerCase() === item.name.toLowerCase() &&
            fav.league === item.league);
        if (exists) {
            throw new Error('Item already in favorites');
        }
        const favoriteItem = {
            ...item,
            addedAt: new Date()
        };
        this.favorites.push(favoriteItem);
        await this.saveFavorites();
        console.log(`Added ${item.name} to favorites`);
    }
    /**
     * Remove item from favorites
     */
    async remove(itemName, league) {
        const initialLength = this.favorites.length;
        this.favorites = this.favorites.filter(fav => {
            if (league) {
                return !(fav.name.toLowerCase() === itemName.toLowerCase() && fav.league === league);
            }
            else {
                return fav.name.toLowerCase() !== itemName.toLowerCase();
            }
        });
        if (this.favorites.length < initialLength) {
            await this.saveFavorites();
            console.log(`Removed ${itemName} from favorites`);
        }
        else {
            throw new Error('Item not found in favorites');
        }
    }
    /**
     * Update last checked time and price for an item
     */
    async updateLastChecked(itemName, league, price) {
        const item = this.favorites.find(fav => fav.name.toLowerCase() === itemName.toLowerCase() &&
            fav.league === league);
        if (item) {
            item.lastChecked = new Date();
            if (price !== undefined) {
                item.lastPrice = price;
            }
            await this.saveFavorites();
        }
    }
    /**
     * Check if item is in favorites
     */
    isFavorite(itemName, league) {
        return this.favorites.some(fav => fav.name.toLowerCase() === itemName.toLowerCase() &&
            fav.league === league);
    }
    /**
     * Get favorites by league
     */
    getByLeague(league) {
        return this.favorites.filter(fav => fav.league === league);
    }
    /**
     * Clear all favorites
     */
    async clear() {
        this.favorites = [];
        await this.saveFavorites();
        console.log('All favorites cleared');
    }
    /**
     * Export favorites to JSON string
     */
    export() {
        return JSON.stringify(this.favorites, null, 2);
    }
    /**
     * Import favorites from JSON string
     */
    async import(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            // Validate structure
            if (!Array.isArray(imported)) {
                throw new Error('Invalid format: expected array');
            }
            for (const item of imported) {
                if (!item.name || !item.league) {
                    throw new Error('Invalid format: missing required fields');
                }
            }
            this.favorites = imported;
            await this.saveFavorites();
            console.log(`Imported ${imported.length} favorites`);
        }
        catch (error) {
            throw new Error(`Failed to import favorites: ${error.message || 'Unknown error'}`);
        }
    }
}
exports.FavoritesManager = FavoritesManager;
//# sourceMappingURL=favorites.js.map