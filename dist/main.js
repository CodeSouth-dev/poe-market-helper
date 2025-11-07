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
const pobImporter_1 = require("./pobImporter");
const liveSearch_1 = require("./liveSearch");
const fossilOptimizer_1 = require("./fossilOptimizer");
const automatedBaseAnalyzer_1 = require("./automatedBaseAnalyzer");
const currencyMaterialsScraper_1 = require("./currencyMaterialsScraper");
const pohxCraftingScraper_1 = require("./pohxCraftingScraper");
const maxRollCraftingScraper_1 = require("./maxRollCraftingScraper");
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
    // Cleanup browser sessions and live searches before quitting
    await browserManager_1.browserManager.shutdown();
    liveSearch_1.liveSearchManager.shutdown();
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
// Open trade site for base item
electron_1.ipcMain.handle('open-trade-site', async (event, baseName, league) => {
    try {
        const { shell } = require('electron');
        // Construct trade site URL with base item search
        // For pathofexile.com/trade, we need to use the official trade API
        const encodedBaseName = encodeURIComponent(baseName);
        const tradeLeague = league || 'Standard';
        // Open in browser - pathofexile.com/trade with pre-filled search
        const tradeUrl = `https://www.pathofexile.com/trade/search/${tradeLeague}?q={"query":{"type":"${encodedBaseName}","filters":{"misc_filters":{"filters":{"ilvl":{"min":82}}}}}}`;
        console.log(`🔍 Opening trade site for: ${baseName} in ${tradeLeague}`);
        await shell.openExternal(tradeUrl);
        return { success: true };
    }
    catch (error) {
        console.error('Open trade site error:', error);
        return { success: false, error: error.message };
    }
});
// ==================== Path of Building Import ====================
// Import PoB code
electron_1.ipcMain.handle('pob-import', async (event, pobCode, league) => {
    try {
        const result = await pobImporter_1.pobImporter.importBuild(pobCode, league);
        return { success: true, data: result };
    }
    catch (error) {
        console.error('PoB import error:', error);
        return { success: false, error: error.message };
    }
});
// Get PoB build summary (quick overview)
electron_1.ipcMain.handle('pob-get-summary', async (event, pobCode, league) => {
    try {
        const result = await pobImporter_1.pobImporter.getBuildSummary(pobCode, league);
        return { success: true, data: result };
    }
    catch (error) {
        console.error('PoB summary error:', error);
        return { success: false, error: error.message };
    }
});
// ==================== Live Search & Notifications ====================
// Create live search
electron_1.ipcMain.handle('live-search-create', async (event, filter) => {
    try {
        const searchId = await liveSearch_1.liveSearchManager.createSearch(filter);
        return { success: true, searchId };
    }
    catch (error) {
        console.error('Create live search error:', error);
        return { success: false, error: error.message };
    }
});
// Stop live search
electron_1.ipcMain.handle('live-search-stop', async (event, searchId) => {
    try {
        const stopped = liveSearch_1.liveSearchManager.stopSearch(searchId);
        return { success: stopped };
    }
    catch (error) {
        console.error('Stop live search error:', error);
        return { success: false, error: error.message };
    }
});
// Resume live search
electron_1.ipcMain.handle('live-search-resume', async (event, searchId) => {
    try {
        const resumed = liveSearch_1.liveSearchManager.resumeSearch(searchId);
        return { success: resumed };
    }
    catch (error) {
        console.error('Resume live search error:', error);
        return { success: false, error: error.message };
    }
});
// Delete live search
electron_1.ipcMain.handle('live-search-delete', async (event, searchId) => {
    try {
        const deleted = liveSearch_1.liveSearchManager.deleteSearch(searchId);
        return { success: deleted };
    }
    catch (error) {
        console.error('Delete live search error:', error);
        return { success: false, error: error.message };
    }
});
// Get all active searches
electron_1.ipcMain.handle('live-search-get-active', async () => {
    try {
        const searches = liveSearch_1.liveSearchManager.getActiveSearches();
        return { success: true, data: searches };
    }
    catch (error) {
        console.error('Get active searches error:', error);
        return { success: false, error: error.message };
    }
});
// Get results for a search
electron_1.ipcMain.handle('live-search-get-results', async (event, searchId) => {
    try {
        const results = liveSearch_1.liveSearchManager.getResults(searchId);
        return { success: true, data: results };
    }
    catch (error) {
        console.error('Get search results error:', error);
        return { success: false, error: error.message };
    }
});
// Create underpriced search
electron_1.ipcMain.handle('live-search-underpriced', async (event, itemName, typicalPrice, discount, league) => {
    try {
        const searchId = await liveSearch_1.liveSearchManager.createUnderpricedSearch(itemName, typicalPrice, discount, league);
        return { success: true, searchId };
    }
    catch (error) {
        console.error('Create underpriced search error:', error);
        return { success: false, error: error.message };
    }
});
// Get live search statistics
electron_1.ipcMain.handle('live-search-stats', async () => {
    try {
        const stats = liveSearch_1.liveSearchManager.getStatistics();
        return { success: true, data: stats };
    }
    catch (error) {
        console.error('Get search stats error:', error);
        return { success: false, error: error.message };
    }
});
// ==================== Fossil Optimization ====================
// Find best fossil combination
electron_1.ipcMain.handle('fossil-optimize', async (event, baseItem, desiredMods, league) => {
    try {
        const result = await fossilOptimizer_1.fossilOptimizer.findBestCombination(baseItem, desiredMods, league);
        return { success: true, data: result };
    }
    catch (error) {
        console.error('Fossil optimization error:', error);
        return { success: false, error: error.message };
    }
});
// ==================== Automated Base Analyzer ====================
// Start automated base analysis
electron_1.ipcMain.handle('automated-analyzer-start', async (event) => {
    try {
        await automatedBaseAnalyzer_1.automatedBaseAnalyzer.startAutomatedAnalysis();
        return { success: true };
    }
    catch (error) {
        console.error('Start automated analyzer error:', error);
        return { success: false, error: error.message };
    }
});
// Stop automated base analysis
electron_1.ipcMain.handle('automated-analyzer-stop', async (event) => {
    try {
        automatedBaseAnalyzer_1.automatedBaseAnalyzer.stopAutomatedAnalysis();
        return { success: true };
    }
    catch (error) {
        console.error('Stop automated analyzer error:', error);
        return { success: false, error: error.message };
    }
});
// Run analysis now (manual trigger)
electron_1.ipcMain.handle('automated-analyzer-run-now', async (event, league) => {
    try {
        const results = await automatedBaseAnalyzer_1.automatedBaseAnalyzer.runFullAnalysis(league);
        return { success: true, data: results };
    }
    catch (error) {
        console.error('Run automated analysis error:', error);
        return { success: false, error: error.message };
    }
});
// Get all BUY recommendations
electron_1.ipcMain.handle('automated-analyzer-get-buy-recommendations', async (event) => {
    try {
        const results = await automatedBaseAnalyzer_1.automatedBaseAnalyzer.getBuyRecommendations();
        return { success: true, data: results };
    }
    catch (error) {
        console.error('Get BUY recommendations error:', error);
        return { success: false, error: error.message };
    }
});
// Get all CRAFT recommendations
electron_1.ipcMain.handle('automated-analyzer-get-craft-recommendations', async (event) => {
    try {
        const results = await automatedBaseAnalyzer_1.automatedBaseAnalyzer.getCraftRecommendations();
        return { success: true, data: results };
    }
    catch (error) {
        console.error('Get CRAFT recommendations error:', error);
        return { success: false, error: error.message };
    }
});
// Get recommendations for specific item class
electron_1.ipcMain.handle('automated-analyzer-get-recommendations-by-class', async (event, itemClass) => {
    try {
        const results = await automatedBaseAnalyzer_1.automatedBaseAnalyzer.getRecommendationsForClass(itemClass);
        return { success: true, data: results };
    }
    catch (error) {
        console.error('Get recommendations by class error:', error);
        return { success: false, error: error.message };
    }
});
// ==================== Currency & Materials Pricing ====================
// Get all currency and materials pricing
electron_1.ipcMain.handle('currency-get-all-pricing', async (event, league) => {
    try {
        const result = await currencyMaterialsScraper_1.currencyMaterialsScraper.scrapeAllPricing(league || 'Standard');
        return { success: true, data: result };
    }
    catch (error) {
        console.error('Get all pricing error:', error);
        return { success: false, error: error.message };
    }
});
// Get specific category pricing
electron_1.ipcMain.handle('currency-get-category', async (event, category, league) => {
    try {
        const result = await currencyMaterialsScraper_1.currencyMaterialsScraper.getCategoryPricing(category, league || 'Standard');
        return { success: true, data: result };
    }
    catch (error) {
        console.error('Get category pricing error:', error);
        return { success: false, error: error.message };
    }
});
// Get price for specific item
electron_1.ipcMain.handle('currency-get-price', async (event, itemName, league) => {
    try {
        const price = await currencyMaterialsScraper_1.currencyMaterialsScraper.getPrice(itemName, league || 'Standard');
        return { success: true, data: price };
    }
    catch (error) {
        console.error('Get item price error:', error);
        return { success: false, error: error.message };
    }
});
// Search for currency/materials
electron_1.ipcMain.handle('currency-search', async (event, query, league) => {
    try {
        const results = await currencyMaterialsScraper_1.currencyMaterialsScraper.searchItems(query, league || 'Standard');
        return { success: true, data: results };
    }
    catch (error) {
        console.error('Search currency error:', error);
        return { success: false, error: error.message };
    }
});
// Get most expensive items
electron_1.ipcMain.handle('currency-get-most-expensive', async (event, limit, league) => {
    try {
        const results = await currencyMaterialsScraper_1.currencyMaterialsScraper.getMostExpensive(limit || 20, league || 'Standard');
        return { success: true, data: results };
    }
    catch (error) {
        console.error('Get most expensive error:', error);
        return { success: false, error: error.message };
    }
});
// Get rising items (investment opportunities)
electron_1.ipcMain.handle('currency-get-rising', async (event, minChange, league) => {
    try {
        const results = await currencyMaterialsScraper_1.currencyMaterialsScraper.getRisingItems(minChange || 5, league || 'Standard');
        return { success: true, data: results };
    }
    catch (error) {
        console.error('Get rising items error:', error);
        return { success: false, error: error.message };
    }
});
// ==================== Pohx Crafting Guides ====================
// Scrape all crafting guides from pohx.net
electron_1.ipcMain.handle('pohx-scrape-all-guides', async (event) => {
    try {
        const result = await pohxCraftingScraper_1.pohxCraftingScraper.scrapeAllGuides();
        return { success: true, data: result };
    }
    catch (error) {
        console.error('Scrape Pohx guides error:', error);
        return { success: false, error: error.message };
    }
});
// Get all sections
electron_1.ipcMain.handle('pohx-get-all-sections', async (event) => {
    try {
        const sections = await pohxCraftingScraper_1.pohxCraftingScraper.getAllSections();
        return { success: true, data: sections };
    }
    catch (error) {
        console.error('Get Pohx sections error:', error);
        return { success: false, error: error.message };
    }
});
// Get guides for a specific section
electron_1.ipcMain.handle('pohx-get-section', async (event, sectionName) => {
    try {
        const guides = await pohxCraftingScraper_1.pohxCraftingScraper.getSection(sectionName);
        return { success: true, data: guides };
    }
    catch (error) {
        console.error('Get Pohx section error:', error);
        return { success: false, error: error.message };
    }
});
// Get guides by item type
electron_1.ipcMain.handle('pohx-get-by-item-type', async (event, itemType) => {
    try {
        const guides = await pohxCraftingScraper_1.pohxCraftingScraper.getGuidesByItemType(itemType);
        return { success: true, data: guides };
    }
    catch (error) {
        console.error('Get Pohx guides by item type error:', error);
        return { success: false, error: error.message };
    }
});
// Get guides by difficulty
electron_1.ipcMain.handle('pohx-get-by-difficulty', async (event, difficulty) => {
    try {
        const guides = await pohxCraftingScraper_1.pohxCraftingScraper.getGuidesByDifficulty(difficulty);
        return { success: true, data: guides };
    }
    catch (error) {
        console.error('Get Pohx guides by difficulty error:', error);
        return { success: false, error: error.message };
    }
});
// Search Pohx guides
electron_1.ipcMain.handle('pohx-search', async (event, keyword) => {
    try {
        const guides = await pohxCraftingScraper_1.pohxCraftingScraper.searchGuides(keyword);
        return { success: true, data: guides };
    }
    catch (error) {
        console.error('Search Pohx guides error:', error);
        return { success: false, error: error.message };
    }
});
// ==================== MaxRoll Crafting Guides ====================
// Scrape all crafting guides from maxroll.gg
electron_1.ipcMain.handle('maxroll-scrape-all-guides', async (event) => {
    try {
        const result = await maxRollCraftingScraper_1.maxRollCraftingScraper.scrapeAllGuides();
        return { success: true, data: result };
    }
    catch (error) {
        console.error('Scrape MaxRoll guides error:', error);
        return { success: false, error: error.message };
    }
});
// Get all sections
electron_1.ipcMain.handle('maxroll-get-all-sections', async (event) => {
    try {
        const sections = await maxRollCraftingScraper_1.maxRollCraftingScraper.getAllSections();
        return { success: true, data: sections };
    }
    catch (error) {
        console.error('Get MaxRoll sections error:', error);
        return { success: false, error: error.message };
    }
});
// Get general crafting tips
electron_1.ipcMain.handle('maxroll-get-general-tips', async (event) => {
    try {
        const tips = await maxRollCraftingScraper_1.maxRollCraftingScraper.getGeneralTips();
        return { success: true, data: tips };
    }
    catch (error) {
        console.error('Get MaxRoll tips error:', error);
        return { success: false, error: error.message };
    }
});
// Get methods by category
electron_1.ipcMain.handle('maxroll-get-by-category', async (event, category) => {
    try {
        const methods = await maxRollCraftingScraper_1.maxRollCraftingScraper.getMethodsByCategory(category);
        return { success: true, data: methods };
    }
    catch (error) {
        console.error('Get MaxRoll methods by category error:', error);
        return { success: false, error: error.message };
    }
});
// Get basic crafting methods
electron_1.ipcMain.handle('maxroll-get-basic-methods', async (event) => {
    try {
        const methods = await maxRollCraftingScraper_1.maxRollCraftingScraper.getBasicMethods();
        return { success: true, data: methods };
    }
    catch (error) {
        console.error('Get MaxRoll basic methods error:', error);
        return { success: false, error: error.message };
    }
});
// Get intermediate crafting methods
electron_1.ipcMain.handle('maxroll-get-intermediate-methods', async (event) => {
    try {
        const methods = await maxRollCraftingScraper_1.maxRollCraftingScraper.getIntermediateMethods();
        return { success: true, data: methods };
    }
    catch (error) {
        console.error('Get MaxRoll intermediate methods error:', error);
        return { success: false, error: error.message };
    }
});
// Search MaxRoll methods
electron_1.ipcMain.handle('maxroll-search', async (event, keyword) => {
    try {
        const methods = await maxRollCraftingScraper_1.maxRollCraftingScraper.searchMethods(keyword);
        return { success: true, data: methods };
    }
    catch (error) {
        console.error('Search MaxRoll methods error:', error);
        return { success: false, error: error.message };
    }
});
// Get method by name
electron_1.ipcMain.handle('maxroll-get-method-by-name', async (event, name) => {
    try {
        const method = await maxRollCraftingScraper_1.maxRollCraftingScraper.getMethodByName(name);
        return { success: true, data: method };
    }
    catch (error) {
        console.error('Get MaxRoll method by name error:', error);
        return { success: false, error: error.message };
    }
});
// ===== Smart Crafting Optimizer Handlers =====
electron_1.ipcMain.handle('smart-optimizer-get-strategy', async (event, goal) => {
    try {
        const { smartCraftingOptimizer } = await Promise.resolve().then(() => __importStar(require('./smartCraftingOptimizer')));
        const strategy = await smartCraftingOptimizer.getOptimalStrategy(goal);
        return { success: true, data: strategy };
    }
    catch (error) {
        console.error('Failed to get optimal strategy:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('smart-optimizer-quick-recommendation', async (event, params) => {
    try {
        const { smartCraftingOptimizer } = await Promise.resolve().then(() => __importStar(require('./smartCraftingOptimizer')));
        const { itemText, budget, league, riskMode } = params;
        const recommendation = await smartCraftingOptimizer.quickRecommendation(itemText, budget, league, riskMode);
        return { success: true, data: recommendation };
    }
    catch (error) {
        console.error('Failed to get quick recommendation:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('smart-optimizer-get-by-budget', async (event, params) => {
    try {
        const { smartCraftingOptimizer } = await Promise.resolve().then(() => __importStar(require('./smartCraftingOptimizer')));
        const { itemClass, budget, league } = params;
        const methods = await smartCraftingOptimizer.getMethodsByBudget(itemClass, budget, league);
        return { success: true, data: methods };
    }
    catch (error) {
        console.error('Failed to get methods by budget:', error);
        return { success: false, error: error.message };
    }
});
// Listen for new listings from live search
liveSearch_1.liveSearchManager.on('newListing', (data) => {
    // Send notification to frontend
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('live-search-new-listing', data);
    }
});
