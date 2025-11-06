import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { PoeNinjaAPI } from './api/poeNinja';
import { CacheManager } from './utils/cache';
import { FavoritesManager } from './utils/favorites';
import { analyzeProfitability, createCraftingMethod } from './utils/craftingCalculator';
import { CraftingMethodType } from './types/crafting';

// Initialize API and utilities
const poeAPI = new PoeNinjaAPI();
const cache = new CacheManager();
const favorites = new FavoritesManager();

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
ipcMain.handle('search-item', async (event, itemName: string, league: string = 'Crucible') => {
  try {
    console.log(`Searching for item: ${itemName} in league: ${league}`);
    const result = await poeAPI.searchItem(itemName, league);
    await cache.set(`${league}-${itemName}`, result);
    return { success: true, data: result };
  } catch (error) {
    console.error('Search error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-favorites', async () => {
  try {
    return { success: true, data: await favorites.getAll() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-favorite', async (event, item: any) => {
  try {
    await favorites.add(item);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remove-favorite', async (event, itemName: string) => {
  try {
    await favorites.remove(itemName);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('calculate-crafting', async (event, data: {
  targetItem: string;
  baseItem: string;
  league: string;
  methods: Array<{
    type: string;
    name: string;
    attempts: number;
    materials: Array<{ name: string; quantity: number }>;
  }>;
}) => {
  try {
    console.log(`Calculating profitability for ${data.targetItem} in ${data.league}`);

    // Get base item cost
    const baseItemResult = await poeAPI.searchItem(data.baseItem, data.league);
    const baseItemCost = baseItemResult.results.length > 0
      ? baseItemResult.results[0].chaosValue
      : 0;

    console.log(`Base item cost: ${baseItemCost} chaos`);

    // Convert methods from UI format to calculator format
    const craftingMethods = data.methods.map(method => {
      const methodType = method.type as CraftingMethodType;
      const craftingMethod = createCraftingMethod(
        methodType,
        method.materials,
        method.attempts,
        method.name
      );
      return { method: craftingMethod, type: methodType };
    });

    // Analyze profitability
    const analysis = await analyzeProfitability(
      data.targetItem,
      craftingMethods,
      baseItemCost,
      data.league
    );

    console.log(`Profitability analysis complete. Profit: ${analysis.profit} chaos`);

    return { success: true, data: analysis };
  } catch (error) {
    console.error('Crafting calculation error:', error);
    return { success: false, error: error.message };
  }
});
