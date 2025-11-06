import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { PoeNinjaAPI } from './api/poeNinja';
import { CacheManager } from './utils/cache';
import { FavoritesManager } from './utils/favorites';
import { analyzeProfitability, createCraftingMethod } from './utils/craftingCalculator';
import { CraftingMethodType } from './types/crafting';
import { buildCraftingChain, getAdvancedTactics } from './utils/craftingCalculatorEnhanced';
import { ItemBase, TargetMod, CRAFTING_CONCEPTS } from './types/craftingEnhanced';

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

ipcMain.handle('build-crafting-chain', async (event, data: {
  baseItem: string;
  ilvl: number;
  strategy: string;
  league: string;
}) => {
  try {
    console.log(`Building crafting chain for ${data.baseItem} (ilvl ${data.ilvl}) using ${data.strategy}`);

    // Create ItemBase object
    const itemBase: ItemBase = {
      name: data.baseItem,
      baseType: 'unknown', // Would need to determine from base name
      ilvl: data.ilvl,
      influenceType: 'none',
    };

    // Create some default target mods (in a real app, user would specify these)
    const targetMods: TargetMod[] = [
      {
        modName: 'High Life',
        tier: 1,
        type: 'prefix',
        isRequired: true,
        ilvlRequired: 86,
        weight: 100,
        tags: ['life'],
      },
    ];

    const chain = await buildCraftingChain(itemBase, targetMods, data.strategy, data.league);

    console.log(`Crafting chain built successfully. Total cost: ${chain.totalCost} chaos`);

    return { success: true, data: chain };
  } catch (error) {
    console.error('Crafting chain build error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-advanced-tactics', async () => {
  try {
    const tactics = getAdvancedTactics();
    return { success: true, data: tactics };
  } catch (error) {
    console.error('Failed to get advanced tactics:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-crafting-education', async () => {
  try {
    return { success: true, data: CRAFTING_CONCEPTS };
  } catch (error) {
    console.error('Failed to get crafting education:', error);
    return { success: false, error: error.message };
  }
});
