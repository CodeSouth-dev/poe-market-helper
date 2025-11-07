import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { PoeNinjaAPI } from './api/poeNinja';
import { CacheManager } from './utils/cache';
import { FavoritesManager } from './utils/favorites';
import { CraftingCalculator } from './api/craftingCalculator';
import { getCraftingDataLoader } from './api/craftingData';
import { browserManager } from './browserManager';
import { poeTradeOfficial } from './poeTradeOfficial';
import { priceComparisonService } from './priceComparison';
import { poeNinjaScraper } from './poeNinjaScraper';
import { poedbScraper } from './poedbScraper';
import { craftOfExileScraper } from './craftOfExileScraper';
import { pobImporter } from './pobImporter';
import { liveSearchManager } from './liveSearch';
import { fossilOptimizer } from './fossilOptimizer';
import { automatedBaseAnalyzer } from './automatedBaseAnalyzer';
import { currencyMaterialsScraper } from './currencyMaterialsScraper';

// Initialize API and utilities
const poeAPI = new PoeNinjaAPI();
const cache = new CacheManager();
const favorites = new FavoritesManager();
const craftingCalculator = new CraftingCalculator();
const craftingData = getCraftingDataLoader();

let mainWindow: BrowserWindow;

function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
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
app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  // Cleanup browser sessions and live searches before quitting
  await browserManager.shutdown();
  liveSearchManager.shutdown();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for communication between main and renderer processes
ipcMain.handle('search-item', async (event: any, itemName: string, league: string = 'Crucible') => {
  try {
    console.log(`Searching for item: ${itemName} in league: ${league}`);
    const result = await poeAPI.searchItem(itemName, league);
    await cache.set(`${league}-${itemName}`, result);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Search error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-favorites', async () => {
  try {
    return { success: true, data: await favorites.getAll() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-favorite', async (event: any, item: any) => {
  try {
    await favorites.add(item);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-favorite', async (event: any, itemName: string) => {
  try {
    await favorites.remove(itemName);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Crafting-related IPC handlers
ipcMain.handle('initialize-crafting', async (event: any, league: string) => {
  try {
    console.log('Initializing crafting data...');
    await craftingCalculator.initialize(league);
    return { success: true, message: 'Crafting data loaded successfully' };
  } catch (error: any) {
    console.error('Crafting initialization error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('calculate-crafting', async (event: any, params: {
  desiredMods: Array<{ name: string; type: 'prefix' | 'suffix'; weight?: number }>;
  baseItemName: string;
  itemClass: string;
  league: string;
}) => {
  try {
    console.log('Calculating crafting methods for:', params);
    const result = await craftingCalculator.calculateBestMethod(
      params.desiredMods,
      params.baseItemName,
      params.itemClass,
      params.league
    );
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Crafting calculation error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('search-mods', async (event: any, query: string, itemClass?: string) => {
  try {
    if (!craftingData.isLoaded()) {
      await craftingData.loadAll();
    }
    const results = craftingData.searchMods(query, itemClass);
    return { success: true, data: results };
  } catch (error: any) {
    console.error('Mod search error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('search-base-items', async (event: any, query: string) => {
  try {
    if (!craftingData.isLoaded()) {
      await craftingData.loadAll();
    }
    const allItems = Array.from((craftingData as any)['baseItems'].values());
    const results = allItems.filter((item: any) =>
      item.name.toLowerCase().includes(query.toLowerCase()) &&
      item.drop_enabled
    ).slice(0, 50);
    return { success: true, data: results };
  } catch (error: any) {
    console.error('Base item search error:', error);
    return { success: false, error: error.message };
  }
});

// Market analysis IPC handlers
ipcMain.handle('get-leagues', async () => {
  try {
    const leagues = await poeAPI.getLeagues();
    return { success: true, data: leagues };
  } catch (error: any) {
    console.error('Get leagues error:', error);
    return { success: false, error: error.message };
  }
});

// Cache for market insights data (manual refresh only)
let marketInsightsCache: {
  popular: any[];
  profitable: any[];
  trending: any[];
  league: string;
  timestamp: Date;
} | null = null;

ipcMain.handle('get-popular-items', async (event: any, league: string, limit: number = 20) => {
  try {
    const items = await poeAPI.getPopularItems(league, limit);
    return { success: true, data: items };
  } catch (error: any) {
    console.error('Get popular items error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-profitable-items', async (event: any, league: string, limit: number = 20) => {
  try {
    const items = await poeAPI.getProfitableItems(league, limit);
    return { success: true, data: items };
  } catch (error: any) {
    console.error('Get profitable items error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-trending-items', async (event: any, league: string, limit: number = 10) => {
  try {
    const items = await poeAPI.getTrendingItems(league, limit);
    return { success: true, data: items };
  } catch (error: any) {
    console.error('Get trending items error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-build-craftable-items', async (event: any, league: string, limit: number = 20) => {
  try {
    const items = await poeAPI.getBuildCraftableItems(league, limit);
    return { success: true, data: items };
  } catch (error: any) {
    console.error('Get build craftable items error:', error);
    return { success: false, error: error.message };
  }
});

// Load all market insights data with caching
ipcMain.handle('load-market-insights', async (event: any, league: string) => {
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
  } catch (error: any) {
    console.error('Load market insights error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-cached-market-insights', async (event: any, league: string) => {
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
let buildDataCache: any = null;
let buildDataTimestamp: Date | null = null;

ipcMain.handle('scrape-builds', async (event: any, league: string) => {
  try {
    console.log(`Scraping builds for league: ${league}`);
    // Use the enhanced browser-based scraper
    const scrapedData = await poeNinjaScraper.scrapeBuilds(league);

    // Cache the scraped data
    buildDataCache = scrapedData;
    buildDataTimestamp = new Date();

    return {
      success: true,
      data: scrapedData,
      cached: false,
      timestamp: buildDataTimestamp
    };
  } catch (error: any) {
    console.error('Scrape builds error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-cached-builds', async (event: any) => {
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
ipcMain.handle('poe-trade-check-auth', async () => {
  try {
    const isAuth = await poeTradeOfficial.checkAuthentication();
    return { success: true, data: { authenticated: isAuth } };
  } catch (error: any) {
    console.error('Check auth error:', error);
    return { success: false, error: error.message };
  }
});

// Prompt user to login with visible browser
ipcMain.handle('poe-trade-login', async () => {
  try {
    const success = await poeTradeOfficial.promptLogin();
    return { success: true, data: { loggedIn: success } };
  } catch (error: any) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
});

// Get item price from official trade site
ipcMain.handle('poe-trade-get-price', async (event: any, itemName: string, league: string) => {
  try {
    const price = await poeTradeOfficial.getItemPrice(itemName, league);
    return { success: true, data: { itemName, price } };
  } catch (error: any) {
    console.error('Get price error:', error);
    return { success: false, error: error.message };
  }
});

// Compare base prices for crafting
ipcMain.handle('poe-trade-compare-bases', async (event: any, baseTypes: string[], league: string) => {
  try {
    const comparison = await poeTradeOfficial.compareBasePrices(baseTypes, league);
    return { success: true, data: comparison };
  } catch (error: any) {
    console.error('Compare bases error:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// Price Comparison and Profit Analysis
// ============================================================================

// Compare item price across all sources
ipcMain.handle('compare-item-price', async (event: any, itemName: string, league: string) => {
  try {
    const comparison = await priceComparisonService.compareItemPrice(itemName, league);
    return { success: true, data: comparison };
  } catch (error: any) {
    console.error('Compare price error:', error);
    return { success: false, error: error.message };
  }
});

// Find arbitrage opportunities
ipcMain.handle('find-arbitrage', async (event: any, itemNames: string[], league: string, minProfit: number) => {
  try {
    const opportunities = await priceComparisonService.findArbitrageOpportunities(itemNames, league, minProfit);
    return { success: true, data: opportunities };
  } catch (error: any) {
    console.error('Find arbitrage error:', error);
    return { success: false, error: error.message };
  }
});

// Analyze crafting profit
ipcMain.handle('analyze-crafting-profit', async (event: any, baseItem: string, craftedItem: string, craftingCost: number, league: string) => {
  try {
    const analysis = await priceComparisonService.analyzeCraftingProfit(baseItem, craftedItem, craftingCost, league);
    return { success: true, data: analysis };
  } catch (error: any) {
    console.error('Analyze crafting profit error:', error);
    return { success: false, error: error.message };
  }
});

// Compare multiple crafting routes
ipcMain.handle('compare-crafting-routes', async (event: any, routes: any[], league: string) => {
  try {
    const analyses = await priceComparisonService.compareCraftingRoutes(routes, league);
    return { success: true, data: analyses };
  } catch (error: any) {
    console.error('Compare crafting routes error:', error);
    return { success: false, error: error.message };
  }
});

// Get market summary
ipcMain.handle('get-market-summary', async (event: any, itemNames: string[], league: string) => {
  try {
    const summary = await priceComparisonService.getMarketSummary(itemNames, league);
    return { success: true, data: summary };
  } catch (error: any) {
    console.error('Get market summary error:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// Browser Management
// ============================================================================

// Get browser session stats
ipcMain.handle('get-browser-stats', async () => {
  try {
    const stats = browserManager.getStats();
    return { success: true, data: stats };
  } catch (error: any) {
    console.error('Get browser stats error:', error);
    return { success: false, error: error.message };
  }
});

// Cleanup idle browser sessions
ipcMain.handle('cleanup-browsers', async () => {
  try {
    await browserManager.closeAll();
    return { success: true, message: 'All browser sessions closed' };
  } catch (error: any) {
    console.error('Cleanup browsers error:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// Enhanced Build Scraping (Browser-based)
// ============================================================================

// Get popular craftable items filtered by wealth
ipcMain.handle('get-popular-craftable-items', async (event: any, league: string, minWealth: number, maxWealth: number) => {
  try {
    const items = await poeNinjaScraper.getPopularCraftableItems(league, minWealth, maxWealth);
    return { success: true, data: items };
  } catch (error: any) {
    console.error('Get popular craftable items error:', error);
    return { success: false, error: error.message };
  }
});

// Get build statistics
ipcMain.handle('get-build-stats', async (event: any, league: string) => {
  try {
    const stats = await poeNinjaScraper.getBuildStats(league);
    return { success: true, data: stats };
  } catch (error: any) {
    console.error('Get build stats error:', error);
    return { success: false, error: error.message };
  }
});

// Get popular items by slot with percentages
ipcMain.handle('get-popular-items-by-slot', async (event: any, league: string, slot: string) => {
  try {
    const items = await poeNinjaScraper.getPopularItemsBySlot(league, slot);
    return { success: true, data: items };
  } catch (error: any) {
    console.error('Get popular items by slot error:', error);
    return { success: false, error: error.message };
  }
});

// Get weapon configuration analysis
ipcMain.handle('get-weapon-analysis', async (event: any, league: string) => {
  try {
    const analysis = await poeNinjaScraper.getWeaponAnalysis(league);
    return { success: true, data: analysis };
  } catch (error: any) {
    console.error('Get weapon analysis error:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// PoeDB Integration (Modifiers and Base Items)
// ============================================================================

// Scrape modifiers from poedb.tw
ipcMain.handle('scrape-poedb-modifiers', async (event: any, itemClass: string) => {
  try {
    const modifiers = await poedbScraper.scrapeModifiers(itemClass);
    return { success: true, data: modifiers };
  } catch (error: any) {
    console.error('Scrape poedb modifiers error:', error);
    return { success: false, error: error.message };
  }
});

// Scrape base items from poedb.tw
ipcMain.handle('scrape-poedb-base-items', async (event: any, itemClass: string) => {
  try {
    const baseItems = await poedbScraper.scrapeBaseItems(itemClass);
    return { success: true, data: baseItems };
  } catch (error: any) {
    console.error('Scrape poedb base items error:', error);
    return { success: false, error: error.message };
  }
});

// Get best ilvl for desired mods
ipcMain.handle('get-best-ilvl-for-mods', async (event: any, itemClass: string, desiredMods: string[]) => {
  try {
    const recommendation = await poedbScraper.getBestIlvlForMods(itemClass, desiredMods);
    return { success: true, data: recommendation };
  } catch (error: any) {
    console.error('Get best ilvl error:', error);
    return { success: false, error: error.message };
  }
});

// Clear poedb cache
ipcMain.handle('clear-poedb-cache', async () => {
  try {
    await poedbScraper.clearCache();
    return { success: true, message: 'PoeDB cache cleared' };
  } catch (error: any) {
    console.error('Clear poedb cache error:', error);
    return { success: false, error: error.message };
  }
});

// ==================== Craft of Exile Integration ====================

// Simulate crafting with specific method
ipcMain.handle('craft-simulate', async (event: any, baseItem: string, itemLevel: number, desiredMods: string[], method: string) => {
  try {
    const result = await craftOfExileScraper.simulateCrafting(
      baseItem,
      itemLevel,
      desiredMods,
      method as any
    );
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Craft simulation error:', error);
    return { success: false, error: error.message };
  }
});

// Get mod weights for base item
ipcMain.handle('craft-get-mod-weights', async (event: any, baseItem: string, itemLevel: number) => {
  try {
    const result = await craftOfExileScraper.getModWeights(baseItem, itemLevel);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Mod weights error:', error);
    return { success: false, error: error.message };
  }
});

// Calculate crafting cost
ipcMain.handle('craft-calculate-cost', async (event: any, baseItem: string, itemLevel: number, desiredMods: string[], currencyPrices: any) => {
  try {
    const result = await craftOfExileScraper.calculateCraftingCost(
      baseItem,
      itemLevel,
      desiredMods,
      currencyPrices
    );
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Crafting cost calculation error:', error);
    return { success: false, error: error.message };
  }
});

// Get crafting guide
ipcMain.handle('craft-get-guide', async (event: any, itemType: string, targetMods: string[]) => {
  try {
    const result = await craftOfExileScraper.getCraftingGuide(itemType, targetMods);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Crafting guide error:', error);
    return { success: false, error: error.message };
  }
});

// Compare crafting methods
ipcMain.handle('craft-compare-methods', async (event: any, baseItem: string, itemLevel: number, desiredMods: string[]) => {
  try {
    const result = await craftOfExileScraper.compareCraftingMethods(
      baseItem,
      itemLevel,
      desiredMods
    );
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Crafting method comparison error:', error);
    return { success: false, error: error.message };
  }
});

// Clear craft of exile cache
ipcMain.handle('clear-craft-cache', async () => {
  try {
    await craftOfExileScraper.clearCache();
    return { success: true, message: 'Craft of Exile cache cleared' };
  } catch (error: any) {
    console.error('Clear craft cache error:', error);
    return { success: false, error: error.message };
  }
});

// Get top base items by class
ipcMain.handle('craft-get-bases-by-class', async (event: any, itemClass: string, itemLevel: number) => {
  try {
    const result = await craftOfExileScraper.getTopBasesByClass(itemClass, itemLevel);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Get bases by class error:', error);
    return { success: false, error: error.message };
  }
});

// Get available mods for item class
ipcMain.handle('craft-get-mods-for-class', async (event: any, itemClass: string, itemLevel: number, modType: string) => {
  try {
    const result = await craftOfExileScraper.getModsForItemClass(
      itemClass,
      itemLevel,
      modType as any
    );
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Get mods for class error:', error);
    return { success: false, error: error.message };
  }
});

// Open trade site for base item
ipcMain.handle('open-trade-site', async (event: any, baseName: string, league: string) => {
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
  } catch (error: any) {
    console.error('Open trade site error:', error);
    return { success: false, error: error.message };
  }
});

// ==================== Path of Building Import ====================

// Import PoB code
ipcMain.handle('pob-import', async (event: any, pobCode: string, league: string) => {
  try {
    const result = await pobImporter.importBuild(pobCode, league);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('PoB import error:', error);
    return { success: false, error: error.message };
  }
});

// Get PoB build summary (quick overview)
ipcMain.handle('pob-get-summary', async (event: any, pobCode: string, league: string) => {
  try {
    const result = await pobImporter.getBuildSummary(pobCode, league);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('PoB summary error:', error);
    return { success: false, error: error.message };
  }
});

// ==================== Live Search & Notifications ====================

// Create live search
ipcMain.handle('live-search-create', async (event: any, filter: any) => {
  try {
    const searchId = await liveSearchManager.createSearch(filter);
    return { success: true, searchId };
  } catch (error: any) {
    console.error('Create live search error:', error);
    return { success: false, error: error.message };
  }
});

// Stop live search
ipcMain.handle('live-search-stop', async (event: any, searchId: string) => {
  try {
    const stopped = liveSearchManager.stopSearch(searchId);
    return { success: stopped };
  } catch (error: any) {
    console.error('Stop live search error:', error);
    return { success: false, error: error.message };
  }
});

// Resume live search
ipcMain.handle('live-search-resume', async (event: any, searchId: string) => {
  try {
    const resumed = liveSearchManager.resumeSearch(searchId);
    return { success: resumed };
  } catch (error: any) {
    console.error('Resume live search error:', error);
    return { success: false, error: error.message };
  }
});

// Delete live search
ipcMain.handle('live-search-delete', async (event: any, searchId: string) => {
  try {
    const deleted = liveSearchManager.deleteSearch(searchId);
    return { success: deleted };
  } catch (error: any) {
    console.error('Delete live search error:', error);
    return { success: false, error: error.message };
  }
});

// Get all active searches
ipcMain.handle('live-search-get-active', async () => {
  try {
    const searches = liveSearchManager.getActiveSearches();
    return { success: true, data: searches };
  } catch (error: any) {
    console.error('Get active searches error:', error);
    return { success: false, error: error.message };
  }
});

// Get results for a search
ipcMain.handle('live-search-get-results', async (event: any, searchId: string) => {
  try {
    const results = liveSearchManager.getResults(searchId);
    return { success: true, data: results };
  } catch (error: any) {
    console.error('Get search results error:', error);
    return { success: false, error: error.message };
  }
});

// Create underpriced search
ipcMain.handle('live-search-underpriced', async (event: any, itemName: string, typicalPrice: number, discount: number, league: string) => {
  try {
    const searchId = await liveSearchManager.createUnderpricedSearch(itemName, typicalPrice, discount, league);
    return { success: true, searchId };
  } catch (error: any) {
    console.error('Create underpriced search error:', error);
    return { success: false, error: error.message };
  }
});

// Get live search statistics
ipcMain.handle('live-search-stats', async () => {
  try {
    const stats = liveSearchManager.getStatistics();
    return { success: true, data: stats };
  } catch (error: any) {
    console.error('Get search stats error:', error);
    return { success: false, error: error.message };
  }
});

// ==================== Fossil Optimization ====================

// Find best fossil combination
ipcMain.handle('fossil-optimize', async (event: any, baseItem: string, desiredMods: string[], league: string) => {
  try {
    const result = await fossilOptimizer.findBestCombination(baseItem, desiredMods, league);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Fossil optimization error:', error);
    return { success: false, error: error.message };
  }
});

// ==================== Automated Base Analyzer ====================

// Start automated base analysis
ipcMain.handle('automated-analyzer-start', async (event: any) => {
  try {
    await automatedBaseAnalyzer.startAutomatedAnalysis();
    return { success: true };
  } catch (error: any) {
    console.error('Start automated analyzer error:', error);
    return { success: false, error: error.message };
  }
});

// Stop automated base analysis
ipcMain.handle('automated-analyzer-stop', async (event: any) => {
  try {
    automatedBaseAnalyzer.stopAutomatedAnalysis();
    return { success: true };
  } catch (error: any) {
    console.error('Stop automated analyzer error:', error);
    return { success: false, error: error.message };
  }
});

// Run analysis now (manual trigger)
ipcMain.handle('automated-analyzer-run-now', async (event: any, league: string) => {
  try {
    const results = await automatedBaseAnalyzer.runFullAnalysis(league);
    return { success: true, data: results };
  } catch (error: any) {
    console.error('Run automated analysis error:', error);
    return { success: false, error: error.message };
  }
});

// Get all BUY recommendations
ipcMain.handle('automated-analyzer-get-buy-recommendations', async (event: any) => {
  try {
    const results = await automatedBaseAnalyzer.getBuyRecommendations();
    return { success: true, data: results };
  } catch (error: any) {
    console.error('Get BUY recommendations error:', error);
    return { success: false, error: error.message };
  }
});

// Get all CRAFT recommendations
ipcMain.handle('automated-analyzer-get-craft-recommendations', async (event: any) => {
  try {
    const results = await automatedBaseAnalyzer.getCraftRecommendations();
    return { success: true, data: results };
  } catch (error: any) {
    console.error('Get CRAFT recommendations error:', error);
    return { success: false, error: error.message };
  }
});

// Get recommendations for specific item class
ipcMain.handle('automated-analyzer-get-recommendations-by-class', async (event: any, itemClass: string) => {
  try {
    const results = await automatedBaseAnalyzer.getRecommendationsForClass(itemClass);
    return { success: true, data: results };
  } catch (error: any) {
    console.error('Get recommendations by class error:', error);
    return { success: false, error: error.message };
  }
});

// ==================== Currency & Materials Pricing ====================

// Get all currency and materials pricing
ipcMain.handle('currency-get-all-pricing', async (event: any, league: string) => {
  try {
    const result = await currencyMaterialsScraper.scrapeAllPricing(league || 'Standard');
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Get all pricing error:', error);
    return { success: false, error: error.message };
  }
});

// Get specific category pricing
ipcMain.handle('currency-get-category', async (event: any, category: string, league: string) => {
  try {
    const result = await currencyMaterialsScraper.getCategoryPricing(category, league || 'Standard');
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Get category pricing error:', error);
    return { success: false, error: error.message };
  }
});

// Get price for specific item
ipcMain.handle('currency-get-price', async (event: any, itemName: string, league: string) => {
  try {
    const price = await currencyMaterialsScraper.getPrice(itemName, league || 'Standard');
    return { success: true, data: price };
  } catch (error: any) {
    console.error('Get item price error:', error);
    return { success: false, error: error.message };
  }
});

// Search for currency/materials
ipcMain.handle('currency-search', async (event: any, query: string, league: string) => {
  try {
    const results = await currencyMaterialsScraper.searchItems(query, league || 'Standard');
    return { success: true, data: results };
  } catch (error: any) {
    console.error('Search currency error:', error);
    return { success: false, error: error.message };
  }
});

// Get most expensive items
ipcMain.handle('currency-get-most-expensive', async (event: any, limit: number, league: string) => {
  try {
    const results = await currencyMaterialsScraper.getMostExpensive(limit || 20, league || 'Standard');
    return { success: true, data: results };
  } catch (error: any) {
    console.error('Get most expensive error:', error);
    return { success: false, error: error.message };
  }
});

// Get rising items (investment opportunities)
ipcMain.handle('currency-get-rising', async (event: any, minChange: number, league: string) => {
  try {
    const results = await currencyMaterialsScraper.getRisingItems(minChange || 5, league || 'Standard');
    return { success: true, data: results };
  } catch (error: any) {
    console.error('Get rising items error:', error);
    return { success: false, error: error.message };
  }
});

// Listen for new listings from live search
liveSearchManager.on('newListing', (data) => {
  // Send notification to frontend
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('live-search-new-listing', data);
  }
});
