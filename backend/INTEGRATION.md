# Frontend Integration Guide

This guide shows how to integrate the Python backend with your existing Electron frontend.

## Overview

The integration keeps your existing UI but replaces the scraping and mod database logic with calls to the Python backend API.

**Architecture**:
```
Electron Frontend (Port varies)
    ↓ HTTP requests
Python Backend (Port 8000)
    ↓ Scraping
External Sites (poe.ninja, poedb.tw, etc.)
```

## Step 1: Start Both Servers

### Terminal 1: Start Python Backend

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python main.py
```

Backend will run on: `http://localhost:8000`

### Terminal 2: Start Electron Frontend

```bash
cd ..  # Back to project root
npm start
```

## Step 2: Modify Electron Frontend

You need to update the frontend to call the Python API instead of using the built-in scrapers.

### Option A: Create API Client (Recommended)

Create a new file `src/api/pythonBackend.ts`:

```typescript
/**
 * Python Backend API Client
 * Calls the FastAPI backend for scraping and data
 */

const BACKEND_URL = 'http://localhost:8000';

export class PythonBackendAPI {
  private baseUrl: string;

  constructor(baseUrl: string = BACKEND_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Check if backend is running
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/`);
      const data = await response.json();
      return data.status === 'online';
    } catch {
      return false;
    }
  }

  /**
   * Scrape builds from poe.ninja (using Playwright!)
   */
  async scrapeBuilds(league: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/scrape/builds?league=${league}`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`Failed to scrape builds: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get mods from database
   */
  async getMods(
    itemClass: string,
    modType?: string,
    minIlvl: number = 1,
    maxIlvl: number = 100,
    search?: string
  ): Promise<any> {
    const params = new URLSearchParams({
      min_ilvl: minIlvl.toString(),
      max_ilvl: maxIlvl.toString()
    });

    if (modType) params.append('mod_type', modType);
    if (search) params.append('search', search);

    const response = await fetch(
      `${this.baseUrl}/api/mods/${itemClass}?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get mods: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Scrape mod database from poedb.tw
   */
  async scrapeMods(forceRefresh: boolean = false): Promise<any> {
    const params = new URLSearchParams({
      force_refresh: forceRefresh.toString()
    });

    const response = await fetch(
      `${this.baseUrl}/api/scrape/mods?${params.toString()}`,
      { method: 'POST' }
    );

    if (!response.ok) {
      throw new Error(`Failed to scrape mods: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get market data
   */
  async getMarketData(league: string, category: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/api/market/${league}/${category}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get market data: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get backend status
   */
  async getStatus(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/status`);

    if (!response.ok) {
      throw new Error(`Failed to get status: ${response.statusText}`);
    }

    return await response.json();
  }
}

export const pythonAPI = new PythonBackendAPI();
```

### Option B: Update Existing IPC Handlers

Modify `src/main.ts` to add new IPC handlers that call the Python backend:

```typescript
import { pythonAPI } from './api/pythonBackend';

// Add these IPC handlers

ipcMain.handle('python-scrape-builds', async (event: any, league: string) => {
  try {
    const result = await pythonAPI.scrapeBuilds(league);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error scraping builds from Python backend:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('python-get-mods', async (
  event: any,
  itemClass: string,
  modType?: string,
  minIlvl?: number,
  maxIlvl?: number,
  search?: string
) => {
  try {
    const result = await pythonAPI.getMods(itemClass, modType, minIlvl, maxIlvl, search);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error getting mods from Python backend:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('python-scrape-mods', async (event: any, forceRefresh: boolean = false) => {
  try {
    const result = await pythonAPI.scrapeMods(forceRefresh);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error scraping mods from Python backend:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('python-backend-status', async (event: any) => {
  try {
    const isHealthy = await pythonAPI.checkHealth();
    if (!isHealthy) {
      return { success: false, error: 'Python backend is not running' };
    }
    const status = await pythonAPI.getStatus();
    return { success: true, data: status };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
```

## Step 3: Update Frontend UI

### Update Build Scraper Button

In `src/index.html`, modify the "Scrape Builds Data" button handler:

```javascript
// OLD CODE (doesn't work with React sites):
const scrapedData = await ipcRenderer.invoke('scrape-builds', league);

// NEW CODE (uses Python backend with Playwright):
const scrapedData = await ipcRenderer.invoke('python-scrape-builds', league);
```

### Update Mod Dropdown

Replace the hardcoded `MOD_DATABASE` with dynamic loading from Python backend:

```javascript
async function loadModsForItem(itemClass, modType, itemLevel) {
  try {
    const result = await ipcRenderer.invoke(
      'python-get-mods',
      itemClass,
      modType,
      1,  // min ilvl
      itemLevel,  // max ilvl (user's item level)
      null  // no search term
    );

    if (result.success) {
      return result.data.mods;  // Returns array of mod objects
    } else {
      console.error('Failed to load mods:', result.error);
      return [];
    }
  } catch (error) {
    console.error('Error loading mods:', error);
    return [];
  }
}

// Use in populateModDropdown:
async function populateModDropdown(itemClass, modType, itemLevel) {
  const dropdown = document.getElementById('modSearch');
  dropdown.innerHTML = '<option value="">Select a mod...</option>';

  // Load mods from Python backend
  const mods = await loadModsForItem(itemClass, modType, itemLevel);

  // Populate dropdown
  mods.forEach(mod => {
    const option = document.createElement('option');
    option.value = mod.name;
    option.textContent = `${mod.name} (${mod.tier}, ilvl ${mod.ilvl})`;
    dropdown.appendChild(option);
  });
}
```

### Add Backend Status Indicator

Add a status indicator to show if the Python backend is running:

```html
<!-- Add to your HTML -->
<div id="backend-status" style="position: fixed; top: 10px; right: 10px; padding: 5px 10px; border-radius: 4px;">
  <span id="backend-status-text">Checking backend...</span>
</div>
```

```javascript
// Add to your initialization code
async function checkBackendStatus() {
  const statusDiv = document.getElementById('backend-status');
  const statusText = document.getElementById('backend-status-text');

  try {
    const result = await ipcRenderer.invoke('python-backend-status');

    if (result.success) {
      statusDiv.style.backgroundColor = '#28a745';
      statusDiv.style.color = 'white';
      statusText.textContent = '✓ Python Backend Online';

      // Show mod database stats
      const modStats = result.data.mod_database;
      if (modStats && modStats.total_mods > 0) {
        statusText.textContent = `✓ Backend Online (${modStats.total_mods} mods loaded)`;
      }
    } else {
      statusDiv.style.backgroundColor = '#dc3545';
      statusDiv.style.color = 'white';
      statusText.textContent = '✗ Python Backend Offline';
    }
  } catch (error) {
    statusDiv.style.backgroundColor = '#dc3545';
    statusDiv.style.color = 'white';
    statusText.textContent = '✗ Python Backend Offline';
  }
}

// Check status on load and every 30 seconds
checkBackendStatus();
setInterval(checkBackendStatus, 30000);
```

## Step 4: Initial Setup

### Scrape Mod Database (First Time Only)

Add a button to scrape the mod database from poedb.tw:

```html
<button id="scrapeMods" class="btn btn-primary">
  Scrape Mod Database from PoeDB
</button>
<div id="scrapeModsStatus"></div>
```

```javascript
document.getElementById('scrapeMods').addEventListener('click', async () => {
  const statusDiv = document.getElementById('scrapeModsStatus');
  const button = document.getElementById('scrapeMods');

  button.disabled = true;
  statusDiv.textContent = 'Scraping mods from poedb.tw... This will take 2-3 minutes...';

  try {
    const result = await ipcRenderer.invoke('python-scrape-mods', false);

    if (result.success) {
      statusDiv.textContent = `✓ Successfully scraped ${result.data.total} mods! (${result.data.prefix_count} prefixes, ${result.data.suffix_count} suffixes)`;
      statusDiv.style.color = 'green';
    } else {
      statusDiv.textContent = `✗ Error: ${result.error}`;
      statusDiv.style.color = 'red';
    }
  } catch (error) {
    statusDiv.textContent = `✗ Error: ${error.message}`;
    statusDiv.style.color = 'red';
  } finally {
    button.disabled = false;
  }
});
```

## Step 5: Testing

### 1. Test Backend Health

```javascript
// In browser console or your code:
const result = await ipcRenderer.invoke('python-backend-status');
console.log(result);
```

Expected output:
```json
{
  "success": true,
  "data": {
    "status": "operational",
    "playwright": "available",
    "mod_database": {
      "total_mods": 1100,
      "prefix_count": 550,
      "suffix_count": 550
    }
  }
}
```

### 2. Test Build Scraper

```javascript
const builds = await ipcRenderer.invoke('python-scrape-builds', 'Standard');
console.log(builds);
```

### 3. Test Mod Loading

```javascript
const mods = await ipcRenderer.invoke('python-get-mods', 'Ring', 'prefix', 1, 100);
console.log(mods);
```

## Migration Checklist

- [ ] Python backend installed and running
- [ ] Created `pythonBackend.ts` API client
- [ ] Added IPC handlers in `main.ts`
- [ ] Updated build scraper button to use Python backend
- [ ] Updated mod dropdown to load from Python backend
- [ ] Added backend status indicator
- [ ] Added "Scrape Mods" button for initial setup
- [ ] Tested all functionality
- [ ] Removed old scraping code (optional, for cleanup)

## Troubleshooting

### "Python backend offline"

1. Check if Python server is running: `http://localhost:8000`
2. Check console for errors
3. Verify CORS is enabled in `main.py`

### "Failed to scrape builds"

1. Check Python backend logs for errors
2. Verify internet connection
3. Check if poe.ninja is accessible

### "No mods loaded"

1. Run "Scrape Mod Database" button first
2. Check backend status for mod count
3. Verify database file exists: `data/poe_mods.db`

### "CORS errors"

The Python backend already has CORS enabled. If you still see CORS errors:

1. Restart Python backend
2. Check that frontend is making requests to `http://localhost:8000`
3. Verify `allow_origins=["*"]` in `main.py`

## Benefits

After integration, you'll have:

✅ **Working build scraper** - Playwright executes JavaScript, so React sites work!
✅ **1000+ mods** - Complete database from poedb.tw
✅ **Better performance** - Python handles heavy lifting
✅ **Scalable** - Easy to add new scrapers and features
✅ **Future-ready** - Foundation for OCR, automation, etc.

## Next Steps

1. Test the integration thoroughly
2. Consider adding more endpoints (market analysis, crafting calculations)
3. Implement caching in the frontend for better performance
4. Add error handling and retry logic
5. Deploy both servers together for production use
