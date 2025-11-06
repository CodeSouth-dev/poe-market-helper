import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { PoeNinjaAPI } from './api/poeNinja';
import { CacheManager } from './utils/cache';
import { FavoritesManager } from './utils/favorites';

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('get-favorites', async () => {
  try {
    return { success: true, data: await favorites.getAll() };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('add-favorite', async (event, item: any) => {
  try {
    await favorites.add(item);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('remove-favorite', async (event, itemName: string) => {
  try {
    await favorites.remove(itemName);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});
