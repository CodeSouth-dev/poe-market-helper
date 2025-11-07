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
  // Cleanup browser sessions before quitting
  await browserManager.shutdown();
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
    const scrapedData = await poeAPI.scrapeBuilds(league);

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
