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
electron_1.app.on('window-all-closed', () => {
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
});
electron_1.ipcMain.handle('get-favorites', async () => {
    try {
        return { success: true, data: await favorites.getAll() };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
});
electron_1.ipcMain.handle('add-favorite', async (event, item) => {
    try {
        await favorites.add(item);
        return { success: true };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
});
electron_1.ipcMain.handle('remove-favorite', async (event, itemName) => {
    try {
        await favorites.remove(itemName);
        return { success: true };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
});
electron_1.ipcMain.handle('search-map-crafting', async (event, itemName, league = 'Crucible') => {
    try {
        console.log(`Searching for map crafting item: ${itemName} in league: ${league}`);
        const result = await poeAPI.searchMapCrafting(itemName, league);
        await cache.set(`map-${league}-${itemName}`, result);
        return { success: true, data: result };
    }
    catch (error) {
        console.error('Map crafting search error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
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
