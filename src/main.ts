import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { PoeNinjaAPI } from './api/poeNinja';
import { CacheManager } from './utils/cache';
import { FavoritesManager } from './utils/favorites';
import { CraftingCalculator } from './api/craftingCalculator';
import { getCraftingDataLoader } from './api/craftingData';

// Fix GPU process crashes on Windows
// This disables hardware acceleration to prevent GPU errors
app.disableHardwareAcceleration();

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

app.on('window-all-closed', () => {
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
