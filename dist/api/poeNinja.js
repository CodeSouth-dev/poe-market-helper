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
        // Enrich results with calculated metrics
        const enrichedResults = filteredResults.map(item => this.enrichItemData(item));
        // Calculate statistics
        const prices = enrichedResults.map(item => item.chaosValue).filter(price => price > 0);
        const totalListings = enrichedResults.reduce((sum, item) => sum + (item.listingCount || item.count || 0), 0);
        // Calculate total volume per hour
        const totalVolume = enrichedResults.reduce((sum, item) => sum + (item.volumePerHour || 0), 0);
        // Find most popular item (highest listing count)
        const mostPopular = enrichedResults.length > 0
            ? enrichedResults.reduce((prev, current) => (current.listingCount || 0) > (prev.listingCount || 0) ? current : prev)
            : undefined;
        // Calculate average confidence
        const confidenceLevels = enrichedResults
            .map(item => item.confidenceLevel)
            .filter((level) => level !== undefined);
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
            return response.data.lines.filter((item) => {
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
     * Get available leagues from Path of Exile official API
     */
    async getLeagues() {
        try {
            const response = await axios_1.default.get('https://api.pathofexile.com/leagues', {
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
                .filter((league) => !league.event) // Exclude events
                .map((league) => league.id);
            return leagues.length > 0 ? leagues : this.getFallbackLeagues();
        }
        catch (error) {
            console.error('Failed to fetch leagues:', error);
            return this.getFallbackLeagues();
        }
    }
    /**
     * Get fallback leagues when API fails
     */
    getFallbackLeagues() {
        return ['Settlers', 'Hardcore Settlers', 'Standard', 'Hardcore'];
    }
    /**
     * Enrich item data with calculated metrics
     */
    enrichItemData(item) {
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
    calculateConfidenceLevel(item) {
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
    calculateVolumePerHour(item) {
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
    isItemPopular(item) {
        const listingCount = item.listingCount || item.count || 0;
        const chaosValue = item.chaosValue || 0;
        // Popular items have high listing counts
        // Or high value items with decent listing counts
        return listingCount >= 100 || (chaosValue >= 100 && listingCount >= 20);
    }
    /**
     * Calculate average confidence from multiple items
     */
    calculateAverageConfidence(levels) {
        if (levels.length === 0)
            return 'medium';
        const weights = { high: 3, medium: 2, low: 1 };
        const avgWeight = levels.reduce((sum, level) => sum + weights[level], 0) / levels.length;
        if (avgWeight >= 2.5)
            return 'high';
        if (avgWeight >= 1.5)
            return 'medium';
        return 'low';
    }
    /**
     * Get adaptive value display (chooses best currency to display)
     */
    getAdaptiveValue(item) {
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
    formatAdaptiveValue(item) {
        const { value, currency } = this.getAdaptiveValue(item);
        const formatted = value.toFixed(2);
        const symbols = {
            chaos: 'c',
            divine: 'd',
            exalted: 'ex'
        };
        return `${formatted}${symbols[currency] || currency}`;
    }
}
exports.PoeNinjaAPI = PoeNinjaAPI;
//# sourceMappingURL=poeNinja.js.map