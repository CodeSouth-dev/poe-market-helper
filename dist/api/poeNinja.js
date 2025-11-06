"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoeNinjaAPI = void 0;
const axios_1 = __importDefault(require("axios"));
class PoeNinjaAPI {
    constructor() {
        this.baseUrl = 'https://poe.ninja/api/data';
        this.timeout = 10000; // 10 seconds
    }
    /**
     * Search for an item across different categories
     */
    async searchItem(itemName, league) {
        const searchTerm = itemName.toLowerCase().trim();
        let allResults = [];
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
            }
            catch (error) {
                console.warn(`Failed to search category ${category}:`, error.message);
                // Continue with other categories
            }
        }
        // Filter and sort results
        const filteredResults = allResults.filter(item => item.name.toLowerCase().includes(searchTerm) ||
            (item.baseType && item.baseType.toLowerCase().includes(searchTerm)));
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
    async searchCategory(searchTerm, league, category) {
        const endpoint = this.getCategoryEndpoint(category);
        const url = `${this.baseUrl}/${endpoint}`;
        const params = {
            league,
            type: category,
            language: 'en'
        };
        try {
            const response = await axios_1.default.get(url, {
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
        }
        catch (error) {
            if (error.code === 'ECONNABORTED') {
                throw new Error(`Timeout searching ${category}`);
            }
            throw new Error(`Failed to search ${category}: ${error.message}`);
        }
    }
    /**
     * Get the correct endpoint for each category
     */
    getCategoryEndpoint(category) {
        const currencyTypes = ['Currency', 'Fragment'];
        return currencyTypes.includes(category) ? 'currencyoverview' : 'itemoverview';
    }
    /**
     * Calculate median from array of numbers
     */
    calculateMedian(numbers) {
        if (numbers.length === 0)
            return 0;
        const sorted = [...numbers].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }
    /**
     * Get available leagues by testing the API
     */
    async getLeagues() {
        try {
            // Known possible leagues to test
            const leaguesToTest = [
                'Settlers of Kalguur',
                'Settlers',
                'Keepers of the Flame',
                'Keepers',
                'Standard',
                'Hardcore',
                'SSF Standard',
                'SSF Hardcore'
            ];
            const validLeagues = [];
            // Test each league by attempting to fetch currency data
            for (const league of leaguesToTest) {
                try {
                    const url = `${this.baseUrl}/currencyoverview`;
                    const response = await axios_1.default.get(url, {
                        params: { league, type: 'Currency' },
                        timeout: 5000
                    });
                    if (response.data && response.data.lines && response.data.lines.length > 0) {
                        validLeagues.push(league);
                    }
                }
                catch (error) {
                    // League doesn't exist or API error, skip it
                    continue;
                }
            }
            // Always include Standard as fallback
            if (validLeagues.length === 0) {
                validLeagues.push('Standard', 'Hardcore');
            }
            console.log('Available leagues:', validLeagues);
            return validLeagues;
        }
        catch (error) {
            console.error('Failed to fetch leagues:', error);
            return ['Keepers of the Flame', 'Standard', 'Hardcore']; // Fallback with current league
        }
    }
    /**
     * Get popular/high-demand items based on listing counts
     */
    async getPopularItems(league, limit = 20) {
        const allItems = [];
        // Categories most relevant for trading
        const categories = [
            'UniqueWeapon',
            'UniqueArmour',
            'UniqueAccessory',
            'UniqueJewel',
            'UniqueFlask',
            'Gem'
        ];
        for (const category of categories) {
            try {
                const items = await this.searchCategory('', league, category);
                allItems.push(...items);
            }
            catch (error) {
                console.warn(`Failed to fetch ${category}:`, error);
            }
        }
        // Sort by listing count (higher = more demand) and value
        const popularItems = allItems
            .filter(item => item.listingCount && item.listingCount > 10) // At least 10 listings
            .sort((a, b) => {
            // Combine listing count and value for popularity score
            const scoreA = (a.listingCount || 0) * 0.7 + (a.chaosValue || 0) * 0.3;
            const scoreB = (b.listingCount || 0) * 0.7 + (b.chaosValue || 0) * 0.3;
            return scoreB - scoreA;
        })
            .slice(0, limit);
        return popularItems;
    }
    /**
     * Get items with best profit margins for crafting
     * Compare item value to crafting material costs
     */
    async getProfitableItems(league, limit = 20) {
        const allItems = [];
        // Focus on items that can be crafted
        const categories = [
            'UniqueWeapon',
            'UniqueArmour',
            'UniqueAccessory',
            'UniqueJewel'
        ];
        for (const category of categories) {
            try {
                const items = await this.searchCategory('', league, category);
                allItems.push(...items);
            }
            catch (error) {
                console.warn(`Failed to fetch ${category}:`, error);
            }
        }
        // Calculate profit margins
        const profitableItems = allItems
            .filter(item => item.chaosValue > 10 && item.listingCount && item.listingCount > 5)
            .map(item => {
            const sellPrice = item.chaosValue;
            const listings = item.listingCount || 0;
            // Estimate crafting cost (simplified - would need actual crafting data)
            // Higher value items generally have higher crafting costs
            const estimatedCraftCost = sellPrice * 0.3; // Rough estimate
            const profitMargin = sellPrice - estimatedCraftCost;
            // Demand indicator based on listing count
            let demand = 'Low';
            if (listings > 50)
                demand = 'High';
            else if (listings > 20)
                demand = 'Medium';
            return {
                item,
                profitMargin,
                sellPrice,
                demand
            };
        })
            .sort((a, b) => b.profitMargin - a.profitMargin)
            .slice(0, limit);
        return profitableItems;
    }
    /**
     * Get trending items (recent price increases)
     */
    async getTrendingItems(league, limit = 10) {
        const allItems = [];
        const categories = [
            'UniqueWeapon',
            'UniqueArmour',
            'UniqueAccessory',
            'Gem'
        ];
        for (const category of categories) {
            try {
                const items = await this.searchCategory('', league, category);
                allItems.push(...items);
            }
            catch (error) {
                console.warn(`Failed to fetch ${category}:`, error);
            }
        }
        // Items with higher value and good listing counts are likely trending
        const trending = allItems
            .filter(item => item.chaosValue > 5 && item.listingCount && item.listingCount > 10)
            .sort((a, b) => {
            // Sort by value * listing count (proxy for demand)
            const scoreA = a.chaosValue * Math.log(a.listingCount || 1);
            const scoreB = b.chaosValue * Math.log(b.listingCount || 1);
            return scoreB - scoreA;
        })
            .slice(0, limit);
        return trending;
    }
}
exports.PoeNinjaAPI = PoeNinjaAPI;
