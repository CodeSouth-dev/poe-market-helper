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
const electron_1 = require("electron");
const path = __importStar(require("path"));
const poeNinja_1 = require("./api/poeNinja");
const cache_1 = require("./utils/cache");
const favorites_1 = require("./utils/favorites");
const craftingCalculator_1 = require("./api/craftingCalculator");
const craftingData_1 = require("./api/craftingData");
const browserManager_1 = require("./browserManager");
const poeTradeOfficial_1 = require("./poeTradeOfficial");
const priceComparison_1 = require("./priceComparison");
const poeNinjaScraper_1 = require("./poeNinjaScraper");
const poedbScraper_1 = require("./poedbScraper");
const craftOfExileScraper_1 = require("./craftOfExileScraper");
// Initialize API and utilities
const poeAPI = new poeNinja_1.PoeNinjaAPI();
const cache = new cache_1.CacheManager();
const favorites = new favorites_1.FavoritesManager();
const craftingCalculator = new craftingCalculator_1.CraftingCalculator();
const craftingData = (0, craftingData_1.getCraftingDataLoader)();
let mainWindow;
function createWindow() {
    // Create the browser window
    mainWindow = new electron_1.BrowserWindow({
        height: 800,
        width: 1200,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false // Simplified for beginner - in production use preload scripts
        },
        title: 'Path of Exile Market Helper'
    });
    // Load the HTML file
    mainWindow.loadFile(path.join(__dirname, '../src/index.html'));
    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}
// App event listeners
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', async () => {
    // Cleanup browser sessions before quitting
    await browserManager_1.browserManager.shutdown();
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
// IPC handlers for communication between main and renderer processes
electron_1.ipcMain.handle('search-item', async (event, itemName, league = 'Crucible') => {
    try {
        console.log(`Searching for item: ${itemName} in league: ${league}`);
        const result = await poeAPI.searchItem(itemName, league);
        await cache.set(`${league}-${itemName}`, result);
        return { success: true, data: result };
    }
    catch (error) {
        console.error('Search error:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('get-favorites', async () => {
    try {
        return { success: true, data: await favorites.getAll() };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('add-favorite', async (event, item) => {
    try {
        await favorites.add(item);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('remove-favorite', async (event, itemName) => {
    try {
        await favorites.remove(itemName);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// Crafting-related IPC handlers
electron_1.ipcMain.handle('initialize-crafting', async (event, league) => {
    try {
        console.log('Initializing crafting data...');
        await craftingCalculator.initialize(league);
        return { success: true, message: 'Crafting data loaded successfully' };
    }
    catch (error) {
        console.error('Crafting initialization error:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('calculate-crafting', async (event, params) => {
    try {
        console.log('Calculating crafting methods for:', params);
        const result = await craftingCalculator.calculateBestMethod(params.desiredMods, params.baseItemName, params.itemClass, params.league);
        return { success: true, data: result };
    }
    catch (error) {
        console.error('Crafting calculation error:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('search-mods', async (event, query, itemClass) => {
    try {
        if (!craftingData.isLoaded()) {
            await craftingData.loadAll();
        }
        const results = craftingData.searchMods(query, itemClass);
        return { success: true, data: results };
    }
    catch (error) {
        console.error('Mod search error:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('search-base-items', async (event, query) => {
    try {
        if (!craftingData.isLoaded()) {
            await craftingData.loadAll();
        }
        const allItems = Array.from(craftingData['baseItems'].values());
        const results = allItems.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()) &&
            item.drop_enabled).slice(0, 50);
        return { success: true, data: results };
    }
    catch (error) {
        console.error('Base item search error:', error);
        return { success: false, error: error.message };
    }
});
// Market analysis IPC handlers
electron_1.ipcMain.handle('get-leagues', async () => {
    try {
        const leagues = await poeAPI.getLeagues();
        return { success: true, data: leagues };
    }
    catch (error) {
        console.error('Get leagues error:', error);
        return { success: false, error: error.message };
    }
});
// Cache for market insights data (manual refresh only)
let marketInsightsCache = null;
electron_1.ipcMain.handle('get-popular-items', async (event, league, limit = 20) => {
    try {
        const items = await poeAPI.getPopularItems(league, limit);
        return { success: true, data: items };
    }
    catch (error) {
        console.error('Get popular items error:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('get-profitable-items', async (event, league, limit = 20) => {
    try {
        const items = await poeAPI.getProfitableItems(league, limit);
        return { success: true, data: items };
    }
    catch (error) {
        console.error('Get profitable items error:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('get-trending-items', async (event, league, limit = 10) => {
    try {
        const items = await poeAPI.getTrendingItems(league, limit);
        return { success: true, data: items };
    }
    catch (error) {
        console.error('Get trending items error:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('get-build-craftable-items', async (event, league, limit = 20) => {
    try {
        const items = await poeAPI.getBuildCraftableItems(league, limit);
        return { success: true, data: items };
    }
    catch (error) {
        console.error('Get build craftable items error:', error);
        return { success: false, error: error.message };
    }
});
// Load all market insights data with caching
electron_1.ipcMain.handle('load-market-insights', async (event, league) => {
    try {
        console.log(`Loading market insights for league: ${league}`);
        // Fetch all data in parallel
        const [popularResult, profitableResult, trendingResult] = await Promise.all([
            poeAPI.getPopularItems(league, 20),
            poeAPI.getBuildCraftableItems(league, 20),
            poeAPI.getTrendingItems(league, 10)
        ]);
        // Cache the results
        marketInsightsCache = {
            popular: popularResult,
            profitable: profitableResult,
            trending: trendingResult,
            league,
            timestamp: new Date()
        };
        return {
            success: true,
            data: marketInsightsCache,
            cached: false
        };
    }
    catch (error) {
        console.error('Load market insights error:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('get-cached-market-insights', async (event, league) => {
    if (marketInsightsCache && marketInsightsCache.league === league) {
        return {
            success: true,
            data: marketInsightsCache,
            cached: true
        };
    }
    return { success: false, error: 'No cached market insights for this league' };
});
// Scrape builds from poe.ninja (manual refresh only)
let buildDataCache = null;
let buildDataTimestamp = null;
electron_1.ipcMain.handle('scrape-builds', async (event, league) => {
    try {
        console.log(`Scraping builds for league: ${league}`);
        // Use the enhanced browser-based scraper
        const scrapedData = await poeNinjaScraper_1.poeNinjaScraper.scrapeBuilds(league);
        // Cache the scraped data
        buildDataCache = scrapedData;
        buildDataTimestamp = new Date();
        return {
            success: true,
            data: scrapedData,
            cached: false,
            timestamp: buildDataTimestamp
        };
    }
    catch (error) {
        console.error('Scrape builds error:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('get-cached-builds', async (event) => {
    if (buildDataCache && buildDataTimestamp) {
        return {
            success: true,
            data: buildDataCache,
            cached: true,
            timestamp: buildDataTimestamp
        };
    }
    return { success: false, error: 'No cached build data available' };
});
// ============================================================================
// Browser-based Trading Integration (pathofexile.com/trade)
// ============================================================================
// Check if user is authenticated with official trade site
electron_1.ipcMain.handle('poe-trade-check-auth', async () => {
    try {
        const isAuth = await poeTradeOfficial_1.poeTradeOfficial.checkAuthentication();
        return { success: true, data: { authenticated: isAuth } };
    }
    catch (error) {
        console.error('Check auth error:', error);
        return { success: false, error: error.message };
    }
});
// Prompt user to login with visible browser
electron_1.ipcMain.handle('poe-trade-login', async () => {
    try {
        const success = await poeTradeOfficial_1.poeTradeOfficial.promptLogin();
        return { success: true, data: { loggedIn: success } };
    }
    catch (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
    }
});
// Get item price from official trade site
electron_1.ipcMain.handle('poe-trade-get-price', async (event, itemName, league) => {
    try {
        const price = await poeTradeOfficial_1.poeTradeOfficial.getItemPrice(itemName, league);
        return { success: true, data: { itemName, price } };
    }
    catch (error) {
        console.error('Get price error:', error);
        return { success: false, error: error.message };
    }
});
// Compare base prices for crafting
electron_1.ipcMain.handle('poe-trade-compare-bases', async (event, baseTypes, league) => {
    try {
        const comparison = await poeTradeOfficial_1.poeTradeOfficial.compareBasePrices(baseTypes, league);
        return { success: true, data: comparison };
    }
    catch (error) {
        console.error('Compare bases error:', error);
        return { success: false, error: error.message };
    }
});
// ============================================================================
// Price Comparison and Profit Analysis
// ============================================================================
// Compare item price across all sources
electron_1.ipcMain.handle('compare-item-price', async (event, itemName, league) => {
    try {
        const comparison = await priceComparison_1.priceComparisonService.compareItemPrice(itemName, league);
        return { success: true, data: comparison };
    }
    catch (error) {
        console.error('Compare price error:', error);
        return { success: false, error: error.message };
    }
});
// Find arbitrage opportunities
electron_1.ipcMain.handle('find-arbitrage', async (event, itemNames, league, minProfit) => {
    try {
        const opportunities = await priceComparison_1.priceComparisonService.findArbitrageOpportunities(itemNames, league, minProfit);
        return { success: true, data: opportunities };
    }
    catch (error) {
        console.error('Find arbitrage error:', error);
        return { success: false, error: error.message };
    }
});
// Analyze crafting profit
electron_1.ipcMain.handle('analyze-crafting-profit', async (event, baseItem, craftedItem, craftingCost, league) => {
    try {
        const analysis = await priceComparison_1.priceComparisonService.analyzeCraftingProfit(baseItem, craftedItem, craftingCost, league);
        return { success: true, data: analysis };
    }
    catch (error) {
        console.error('Analyze crafting profit error:', error);
        return { success: false, error: error.message };
    }
});
// Compare multiple crafting routes
electron_1.ipcMain.handle('compare-crafting-routes', async (event, routes, league) => {
    try {
        const analyses = await priceComparison_1.priceComparisonService.compareCraftingRoutes(routes, league);
        return { success: true, data: analyses };
    }
    catch (error) {
        console.error('Compare crafting routes error:', error);
        return { success: false, error: error.message };
    }
});
// Get market summary
electron_1.ipcMain.handle('get-market-summary', async (event, itemNames, league) => {
    try {
        const summary = await priceComparison_1.priceComparisonService.getMarketSummary(itemNames, league);
        return { success: true, data: summary };
    }
    catch (error) {
        console.error('Get market summary error:', error);
        return { success: false, error: error.message };
    }
});
// ============================================================================
// Browser Management
// ============================================================================
// Get browser session stats
electron_1.ipcMain.handle('get-browser-stats', async () => {
    try {
        const stats = browserManager_1.browserManager.getStats();
        return { success: true, data: stats };
    }
    catch (error) {
        console.error('Get browser stats error:', error);
        return { success: false, error: error.message };
    }
});
// Cleanup idle browser sessions
electron_1.ipcMain.handle('cleanup-browsers', async () => {
    try {
        await browserManager_1.browserManager.closeAll();
        return { success: true, message: 'All browser sessions closed' };
    }
    catch (error) {
        console.error('Cleanup browsers error:', error);
        return { success: false, error: error.message };
    }
});
// ============================================================================
// Enhanced Build Scraping (Browser-based)
// ============================================================================
// Get popular craftable items filtered by wealth
electron_1.ipcMain.handle('get-popular-craftable-items', async (event, league, minWealth, maxWealth) => {
    try {
        const items = await poeNinjaScraper_1.poeNinjaScraper.getPopularCraftableItems(league, minWealth, maxWealth);
        return { success: true, data: items };
    }
    catch (error) {
        console.error('Get popular craftable items error:', error);
        return { success: false, error: error.message };
    }
});
// Get build statistics
electron_1.ipcMain.handle('get-build-stats', async (event, league) => {
    try {
        const stats = await poeNinjaScraper_1.poeNinjaScraper.getBuildStats(league);
        return { success: true, data: stats };
    }
    catch (error) {
        console.error('Get build stats error:', error);
        return { success: false, error: error.message };
    }
});
// Get popular items by slot with percentages
electron_1.ipcMain.handle('get-popular-items-by-slot', async (event, league, slot) => {
    try {
        const items = await poeNinjaScraper_1.poeNinjaScraper.getPopularItemsBySlot(league, slot);
        return { success: true, data: items };
    }
    catch (error) {
        console.error('Get popular items by slot error:', error);
        return { success: false, error: error.message };
    }
});
// Get weapon configuration analysis
electron_1.ipcMain.handle('get-weapon-analysis', async (event, league) => {
    try {
        const analysis = await poeNinjaScraper_1.poeNinjaScraper.getWeaponAnalysis(league);
        return { success: true, data: analysis };
    }
    catch (error) {
        console.error('Get weapon analysis error:', error);
        return { success: false, error: error.message };
    }
});
// ============================================================================
// PoeDB Integration (Modifiers and Base Items)
// ============================================================================
// Scrape modifiers from poedb.tw
electron_1.ipcMain.handle('scrape-poedb-modifiers', async (event, itemClass) => {
    try {
        const modifiers = await poedbScraper_1.poedbScraper.scrapeModifiers(itemClass);
        return { success: true, data: modifiers };
    }
    catch (error) {
        console.error('Scrape poedb modifiers error:', error);
        return { success: false, error: error.message };
    }
});
// Scrape base items from poedb.tw
electron_1.ipcMain.handle('scrape-poedb-base-items', async (event, itemClass) => {
    try {
        const baseItems = await poedbScraper_1.poedbScraper.scrapeBaseItems(itemClass);
        return { success: true, data: baseItems };
    }
    catch (error) {
        console.error('Scrape poedb base items error:', error);
        return { success: false, error: error.message };
    }
});
// Get best ilvl for desired mods
electron_1.ipcMain.handle('get-best-ilvl-for-mods', async (event, itemClass, desiredMods) => {
    try {
        const recommendation = await poedbScraper_1.poedbScraper.getBestIlvlForMods(itemClass, desiredMods);
        return { success: true, data: recommendation };
    }
    catch (error) {
        console.error('Get best ilvl error:', error);
        return { success: false, error: error.message };
    }
});
// Clear poedb cache
electron_1.ipcMain.handle('clear-poedb-cache', async () => {
    try {
        await poedbScraper_1.poedbScraper.clearCache();
        return { success: true, message: 'PoeDB cache cleared' };
    }
    catch (error) {
        console.error('Clear poedb cache error:', error);
        return { success: false, error: error.message };
    }
});
// ==================== Craft of Exile Integration ====================
// Simulate crafting with specific method
electron_1.ipcMain.handle('craft-simulate', async (event, baseItem, itemLevel, desiredMods, method) => {
    try {
        const result = await craftOfExileScraper_1.craftOfExileScraper.simulateCrafting(baseItem, itemLevel, desiredMods, method);
        return { success: true, data: result };
    }
    catch (error) {
        console.error('Craft simulation error:', error);
        return { success: false, error: error.message };
    }
});
// Get mod weights for base item
electron_1.ipcMain.handle('craft-get-mod-weights', async (event, baseItem, itemLevel) => {
    try {
        const result = await craftOfExileScraper_1.craftOfExileScraper.getModWeights(baseItem, itemLevel);
        return { success: true, data: result };
    }
    catch (error) {
        console.error('Mod weights error:', error);
        return { success: false, error: error.message };
    }
});
// Calculate crafting cost
electron_1.ipcMain.handle('craft-calculate-cost', async (event, baseItem, itemLevel, desiredMods, currencyPrices) => {
    try {
        const result = await craftOfExileScraper_1.craftOfExileScraper.calculateCraftingCost(baseItem, itemLevel, desiredMods, currencyPrices);
        return { success: true, data: result };
    }
    catch (error) {
        console.error('Crafting cost calculation error:', error);
        return { success: false, error: error.message };
    }
});
// Get crafting guide
electron_1.ipcMain.handle('craft-get-guide', async (event, itemType, targetMods) => {
    try {
        const result = await craftOfExileScraper_1.craftOfExileScraper.getCraftingGuide(itemType, targetMods);
        return { success: true, data: result };
    }
    catch (error) {
        console.error('Crafting guide error:', error);
        return { success: false, error: error.message };
    }
});
// Compare crafting methods
electron_1.ipcMain.handle('craft-compare-methods', async (event, baseItem, itemLevel, desiredMods) => {
    try {
        const result = await craftOfExileScraper_1.craftOfExileScraper.compareCraftingMethods(baseItem, itemLevel, desiredMods);
        return { success: true, data: result };
    }
    catch (error) {
        console.error('Crafting method comparison error:', error);
        return { success: false, error: error.message };
    }
});
// Clear craft of exile cache
electron_1.ipcMain.handle('clear-craft-cache', async () => {
    try {
        await craftOfExileScraper_1.craftOfExileScraper.clearCache();
        return { success: true, message: 'Craft of Exile cache cleared' };
    }
    catch (error) {
        console.error('Clear craft cache error:', error);
        return { success: false, error: error.message };
    }
});
// Get top base items by class
electron_1.ipcMain.handle('craft-get-bases-by-class', async (event, itemClass, itemLevel) => {
    try {
        const result = await craftOfExileScraper_1.craftOfExileScraper.getTopBasesByClass(itemClass, itemLevel);
        return { success: true, data: result };
    }
    catch (error) {
        console.error('Get bases by class error:', error);
        return { success: false, error: error.message };
    }
});
// Get available mods for item class
electron_1.ipcMain.handle('craft-get-mods-for-class', async (event, itemClass, itemLevel, modType) => {
    try {
        const result = await craftOfExileScraper_1.craftOfExileScraper.getModsForItemClass(itemClass, itemLevel, modType);
        return { success: true, data: result };
    }
    catch (error) {
        console.error('Get mods for class error:', error);
        return { success: false, error: error.message };
    }
});
