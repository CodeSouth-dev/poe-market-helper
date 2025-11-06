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
// Initialize API and utilities
const poeAPI = new poeNinja_1.PoeNinjaAPI();
const cache = new cache_1.CacheManager();
const favorites = new favorites_1.FavoritesManager();
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
electron_1.ipcMain.handle('search-item', async (_event, itemName, league = 'Crucible') => {
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
electron_1.ipcMain.handle('add-favorite', async (_event, item) => {
    try {
        await favorites.add(item);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('remove-favorite', async (_event, itemName) => {
    try {
        await favorites.remove(itemName);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// Get available leagues from poe.ninja/PoE API
electron_1.ipcMain.handle('get-leagues', async () => {
    try {
        console.log('Fetching available leagues...');
        const leagues = await poeAPI.getLeagues();
        return { success: true, data: leagues };
    }
    catch (error) {
        console.error('Failed to fetch leagues:', error);
        return { success: false, error: error.message };
    }
});
//# sourceMappingURL=main.js.map