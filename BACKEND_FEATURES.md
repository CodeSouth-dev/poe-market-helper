# Backend Headless Browser & Advanced Features

## Overview

This document describes the new backend features added to the PoE Market Helper, including:

- ✅ Headless browser automation with Puppeteer
- ✅ Rate limiting to prevent spam and API blocks
- ✅ Automatic browser session management with cleanup
- ✅ Path of Exile official trade site integration with login support
- ✅ **Enhanced poe.ninja build scraper** (browser-based React rendering)
- ✅ **Wealth-filtered craftable items** (filter by your chaos budget)
- ✅ **Craft of Exile integration** (crafting simulation, cost calculator, guides)
- ✅ Price comparison across multiple sources
- ✅ Arbitrage opportunity detection
- ✅ Crafting profit analysis

## Installation

### 1. Install Dependencies

```bash
npm install
```

This will install all required dependencies including:
- `puppeteer` - Headless browser automation
- `puppeteer-extra` - Enhanced Puppeteer with plugins
- `puppeteer-extra-plugin-stealth` - Anti-detection for browser automation

### 2. First Run

When you run the application for the first time, Puppeteer will download a compatible version of Chromium automatically.

```bash
npm start
```

## Features

### 1. Rate Limiter (`src/rateLimiter.ts`)

Prevents spam and rate limiting by controlling request frequency.

**Features:**
- Token bucket algorithm with configurable limits
- Exponential backoff for failed requests
- Per-domain rate limiting
- Concurrent request limiting
- Automatic retry with increasing delays

**Presets:**
- `poeNinja`: 20 req/min, 3 concurrent, 500ms delay
- `poeTradeOfficial`: 10 req/min, 1 concurrent, 2s delay (very conservative)
- `poeTrade`: 15 req/min, 2 concurrent, 1s delay

**Usage in code:**
```typescript
import { defaultRateLimiter, RateLimiter, RateLimitPresets } from './rateLimiter';

// Use default (poe.ninja) rate limiter
const data = await defaultRateLimiter.execute('poe.ninja', async () => {
  return await axios.get(url);
});

// Create custom rate limiter
const customLimiter = new RateLimiter({
  maxRequests: 30,
  windowMs: 60000,
  minDelay: 1000,
  maxConcurrent: 5,
  retryAttempts: 3,
  retryDelayMs: 2000
});
```

### 2. Browser Manager (`src/browserManager.ts`)

Manages Puppeteer browser sessions with automatic cleanup.

**Features:**
- Session-based browser management (headless or visible)
- Automatic idle session cleanup (5 min idle timeout)
- Cookie persistence for authentication
- Page lifecycle management
- Memory-efficient with automatic resource cleanup
- Stealth plugin to avoid detection

**Key Methods:**
```typescript
// Get or create a browser session
const browser = await browserManager.getSession('my-session', true); // headless
const browser = await browserManager.getSession('login-session', false); // visible

// Create a new page
const page = await browserManager.createPage('my-session');

// Check authentication
const isAuth = await browserManager.isSessionAuthenticated('my-session', 'pathofexile.com');

// Save/load cookies
await browserManager.saveSessionCookies('my-session');
await browserManager.loadSessionCookies('my-session', page);

// Close specific session
await browserManager.closeSession('my-session');

// Close all sessions (cleanup)
await browserManager.closeAll();

// Get stats
const stats = browserManager.getStats();
```

**Auto-cleanup:**
- Sessions idle for > 5 minutes are automatically closed
- Cleanup runs every 1 minute
- All sessions closed on app exit (graceful shutdown)

### 3. Path of Exile Official Trade Integration (`src/poeTradeOfficial.ts`)

Integrates with https://www.pathofexile.com/trade with login support.

**Features:**
- Authenticated and unauthenticated access
- Login flow with visible browser (user inputs credentials)
- Session caching (login once, use forever)
- Item price lookup
- Bulk price fetching
- Base item comparison for crafting

**IPC Handlers:**

#### Check Authentication
```javascript
// Frontend
const result = await ipcRenderer.invoke('poe-trade-check-auth');
// Returns: { success: true, data: { authenticated: boolean } }
```

#### Login (Visible Browser)
```javascript
// Frontend - opens browser window for user to login
const result = await ipcRenderer.invoke('poe-trade-login');
// Returns: { success: true, data: { loggedIn: boolean } }
```

#### Get Item Price
```javascript
// Frontend
const result = await ipcRenderer.invoke('poe-trade-get-price', 'Headhunter', 'Standard');
// Returns: { success: true, data: { itemName: string, price: number | null } }
```

#### Compare Base Prices
```javascript
// Frontend
const bases = ['Assassin\'s Garb', 'Vaal Regalia', 'Carnal Armour'];
const result = await ipcRenderer.invoke('poe-trade-compare-bases', bases, 'Standard');
// Returns: {
//   success: true,
//   data: {
//     prices: Map<string, number>,
//     cheapest: { base: string, price: number },
//     mostExpensive: { base: string, price: number },
//     averagePrice: number
//   }
// }
```

### 4. Enhanced Build Scraper (`src/poeNinjaScraper.ts`)

Browser-based scraper that properly loads poe.ninja's React app to extract build data.

**Features:**
- Scrapes actual rendered build data (not just HTML)
- Tracks popular items across builds
- Filters craftable items by wealth range
- Estimates item values based on type and influence
- Build statistics (top classes, skills, average level)

**IPC Handlers:**

#### Get Popular Craftable Items (Wealth Filtered)
```javascript
// Get items you can afford to craft
const result = await ipcRenderer.invoke(
  'get-popular-craftable-items',
  'Standard',  // league
  10,          // min chaos (your minimum budget)
  500          // max chaos (your maximum budget)
);
// Returns: {
//   success: true,
//   data: [
//     {
//       name: "Steel Ring",
//       usage: 45,  // number of builds using this
//       estimatedValue: 500,
//       craftingDifficulty: "Very Hard"
//     },
//     ...
//   ]
// }
```

#### Get Build Statistics
```javascript
// See what's popular in the meta
const result = await ipcRenderer.invoke('get-build-stats', 'Standard');
// Returns: {
//   success: true,
//   data: {
//     topClasses: [
//       { class: "Pathfinder", count: 23 },
//       { class: "Juggernaut", count: 18 },
//       ...
//     ],
//     topSkills: [
//       { skill: "Lightning Strike", count: 31 },
//       { skill: "Righteous Fire", count: 22 },
//       ...
//     ],
//     averageLevel: 95.3
//   }
// }
```

#### Scrape Builds (Enhanced)
```javascript
// Now uses headless browser for better data extraction
const result = await ipcRenderer.invoke('scrape-builds', 'Standard');
// Returns build data with items and usage statistics
```

### 5. Price Comparison Service (`src/priceComparison.ts`)

Compares prices across multiple sources (poe.ninja, official trade site) and identifies profitable opportunities.

**Features:**
- Multi-source price comparison
- Arbitrage opportunity detection
- Crafting profit analysis
- Market summary statistics

**IPC Handlers:**

#### Compare Item Price
```javascript
// Compare price across all sources
const result = await ipcRenderer.invoke('compare-item-price', 'The Doctor', 'Standard');
// Returns: {
//   success: true,
//   data: {
//     itemName: string,
//     prices: PriceData[],
//     lowestPrice: PriceData,
//     highestPrice: PriceData,
//     averagePrice: number,
//     priceSpread: number,
//     profitMargin: number,
//     recommendation: 'buy' | 'sell' | 'hold' | 'insufficient-data'
//   }
// }
```

#### Find Arbitrage Opportunities
```javascript
// Find buy-low-sell-high opportunities
const items = ['The Doctor', 'Awakened Gems', 'Headhunter'];
const result = await ipcRenderer.invoke('find-arbitrage', items, 'Standard', 5); // min 5c profit
// Returns: {
//   success: true,
//   data: ItemPriceComparison[] // sorted by profit margin
// }
```

#### Analyze Crafting Profit
```javascript
// Check if crafting is profitable
const result = await ipcRenderer.invoke(
  'analyze-crafting-profit',
  'Ilvl 86 Vaal Regalia', // base item
  '+2 Socketed Gems Vaal Regalia', // target crafted item
  150, // crafting cost in chaos
  'Standard'
);
// Returns: {
//   success: true,
//   data: {
//     baseItem: string,
//     baseCost: number,
//     craftingCost: number,
//     expectedValue: number,
//     profit: number,
//     profitMargin: number,
//     roi: number,
//     risk: 'low' | 'medium' | 'high'
//   }
// }
```

#### Compare Crafting Routes
```javascript
// Compare multiple crafting methods
const routes = [
  {
    name: 'Fossil Crafting',
    baseItem: 'Vaal Regalia',
    craftedItem: '+2 Gems Vaal Regalia',
    craftingCost: 150
  },
  {
    name: 'Essence Crafting',
    baseItem: 'Vaal Regalia',
    craftedItem: '+2 Gems Vaal Regalia',
    craftingCost: 100
  }
];
const result = await ipcRenderer.invoke('compare-crafting-routes', routes, 'Standard');
// Returns: {
//   success: true,
//   data: CraftingProfitAnalysis[] // sorted by profit
// }
```

#### Get Market Summary
```javascript
// Get overall market statistics
const items = ['Divine Orb', 'Exalted Orb', 'Chaos Orb'];
const result = await ipcRenderer.invoke('get-market-summary', items, 'Standard');
// Returns: {
//   success: true,
//   data: {
//     totalItems: number,
//     itemsWithData: number,
//     buyOpportunities: number,
//     averageProfit: number,
//     topOpportunities: ItemPriceComparison[]
//   }
// }
```

### 6. Craft of Exile Integration (`src/craftOfExileScraper.ts`)

Integrates with craftofexile.com to provide crafting simulation, cost analysis, and step-by-step guides.

**Features:**
- Crafting method simulation (chaos, alt-regal, fossil, essence, harvest)
- Mod weight analysis and probability calculations
- Expected cost calculator with currency prices
- Step-by-step crafting guides
- Method comparison (cheapest vs fastest vs easiest)

**IPC Handlers:**

#### Simulate Crafting
```javascript
// Simulate crafting with specific method
const result = await ipcRenderer.invoke(
  'craft-simulate',
  'Vaal Regalia',     // base item
  86,                 // item level
  ['+1 to Socketed Gems', 'Increased ES'],  // desired mods
  'chaos'             // method: chaos, alt-regal, fossil, essence, harvest
);
// Returns: {
//   success: true,
//   data: {
//     item: string,
//     desiredMods: string[],
//     methods: CraftingMethod[],
//     cheapestMethod: { name, averageCost, averageAttempts, currency, successRate },
//     fastestMethod: { name, averageCost, averageAttempts, currency, successRate },
//     totalCost: number
//   }
// }
```

#### Get Mod Weights
```javascript
// Get probability weights for all mods on base item
const result = await ipcRenderer.invoke(
  'craft-get-mod-weights',
  'Steel Ring',
  84
);
// Returns: {
//   success: true,
//   data: [
//     { mod: string, weight: number, tier: string, level: number },
//     ...
//   ]
// }
```

#### Calculate Crafting Cost
```javascript
// Calculate expected cost with current currency prices
const currencyPrices = {
  'Chaos Orb': 1,
  'Alteration Orb': 0.2,
  'Fossils': 5
};

const result = await ipcRenderer.invoke(
  'craft-calculate-cost',
  'Hubris Circlet',
  86,
  ['+2 to Socketed Gems', 'Increased ES'],
  currencyPrices
);
// Returns: {
//   success: true,
//   data: {
//     method: string,
//     expectedCost: number,
//     expectedAttempts: number,
//     breakdown: [{ currency, amount, cost }],
//     probability: number
//   }
// }
```

#### Get Crafting Guide
```javascript
// Get step-by-step crafting guide
const result = await ipcRenderer.invoke(
  'craft-get-guide',
  'Spine Bow',
  ['+2 to Bow Gems', 'Attack Speed']
);
// Returns: {
//   success: true,
//   data: {
//     itemType: string,
//     baseItem: string,
//     recommendedIlvl: number,
//     steps: [{ step, action, expectedCost, notes }],
//     totalEstimatedCost: number,
//     difficulty: string
//   }
// }
```

#### Compare Crafting Methods
```javascript
// Compare all methods side-by-side
const result = await ipcRenderer.invoke(
  'craft-compare-methods',
  'Stygian Vise',
  86,
  ['Maximum Life', 'Resistances']
);
// Returns: {
//   success: true,
//   data: {
//     item: string,
//     methods: [{ name, cost, time, difficulty, successRate, recommended }],
//     recommendation: string
//   }
// }
```

#### Clear Craft Cache
```javascript
await ipcRenderer.invoke('clear-craft-cache');
// Clears 24-hour cache for fresh data
```

### 7. Browser Management IPC Handlers

#### Get Browser Stats
```javascript
const result = await ipcRenderer.invoke('get-browser-stats');
// Returns: {
//   success: true,
//   data: {
//     activeSessions: number,
//     totalPages: number,
//     sessions: Array<{
//       id: string,
//       pages: number,
//       idleTime: number,
//       headless: boolean
//     }>
//   }
// }
```

#### Cleanup Browsers
```javascript
// Manually close all browser sessions
const result = await ipcRenderer.invoke('cleanup-browsers');
// Returns: { success: true, message: 'All browser sessions closed' }
```

## Architecture

### Rate Limiting Flow

```
User Request
    ↓
IPC Handler
    ↓
Rate Limiter (queue + throttle)
    ↓
Execute Request (with retry)
    ↓
Return Result
```

### Browser Session Flow

```
Request Session
    ↓
Session Exists? ─Yes→ Return existing
    ↓ No
Create Browser (headless/visible)
    ↓
Set stealth mode
    ↓
Load cached cookies (if any)
    ↓
Return session
    ↓
Auto-cleanup after 5 min idle
```

### Price Comparison Flow

```
Request Price Comparison
    ↓
Fetch from poe.ninja (rate-limited)
    ↓
Fetch from official trade (rate-limited, headless browser)
    ↓
Aggregate prices
    ↓
Calculate statistics
    ↓
Generate recommendation
    ↓
Return comparison
```

### Build Scraper Flow

```
Request Build Data
    ↓
Create headless browser session
    ↓
Navigate to poe.ninja/builds (rate-limited)
    ↓
Wait for React app to render (networkidle0)
    ↓
Extract build rows from DOM
    ↓
Parse: name, class, level, skills, items
    ↓
Track item usage across builds
    ↓
Filter by wealth range (optional)
    ↓
Estimate crafting values
    ↓
Close browser, return data
    ↓
Cache for future requests
```

## Performance & Safety

### Rate Limiting
- **poe.ninja**: Safe, conservative limits (20/min)
- **Official Trade**: Very conservative (10/min, 2s delay)
- Exponential backoff on failures (1s, 2s, 4s, 8s)

### Memory Management
- Automatic browser cleanup after 5 min idle
- Page lifecycle management (close after use)
- Session data cleanup on exit

### Error Handling
- All IPC handlers wrapped with try-catch
- Detailed error logging to console
- Graceful fallbacks for missing data

## Example Use Cases

### 1. Find Profitable Crafting Bases

```javascript
// Find the cheapest base to craft on
const bases = [
  'Assassin\'s Garb',
  'Vaal Regalia',
  'Carnal Armour',
  'Sadist Garb'
];

const comparison = await ipcRenderer.invoke('poe-trade-compare-bases', bases, 'Standard');

if (comparison.success) {
  console.log(`Cheapest base: ${comparison.data.cheapest.base} at ${comparison.data.cheapest.price}c`);
  console.log(`Most expensive: ${comparison.data.mostExpensive.base} at ${comparison.data.mostExpensive.price}c`);
  console.log(`Potential profit: ${comparison.data.mostExpensive.price - comparison.data.cheapest.price}c`);
}
```

### 2. Find Items to Craft Based on Your Wealth

```javascript
// I have 200 chaos to spend - what should I craft?
const myBudget = 200;

// Get popular items in my price range
const result = await ipcRenderer.invoke(
  'get-popular-craftable-items',
  'Standard',
  50,        // min: 50c (don't want cheap items)
  myBudget   // max: 200c (my budget)
);

if (result.success) {
  console.log(`\n💰 Items you can craft with ${myBudget}c:\n`);

  result.data.forEach((item, i) => {
    console.log(`${i + 1}. ${item.name}`);
    console.log(`   Used by ${item.usage} builds`);
    console.log(`   Estimated value: ${item.estimatedValue}c`);
    console.log(`   Difficulty: ${item.craftingDifficulty}`);
    console.log('');
  });

  // Get the most popular affordable item
  const bestChoice = result.data[0];
  console.log(`🎯 Best choice: ${bestChoice.name}`);
  console.log(`   ${bestChoice.usage} builds are using this!`);
}

// Also check what builds are popular
const stats = await ipcRenderer.invoke('get-build-stats', 'Standard');
if (stats.success) {
  console.log('\n📊 Current Meta:');
  console.log('Top Classes:', stats.data.topClasses.slice(0, 3).map(c => c.class).join(', '));
  console.log('Top Skills:', stats.data.topSkills.slice(0, 3).map(s => s.skill).join(', '));
}
```

### 3. Arbitrage Bot

```javascript
// Find items with price differences between sources
const popularItems = [
  'Divine Orb',
  'The Doctor',
  'Awakened Multistrike',
  // ... more items
];

const opportunities = await ipcRenderer.invoke('find-arbitrage', popularItems, 'Standard', 10);

if (opportunities.success) {
  opportunities.data.forEach(opp => {
    if (opp.recommendation === 'buy') {
      console.log(`BUY: ${opp.itemName}`);
      console.log(`  Buy at: ${opp.lowestPrice.price}c from ${opp.lowestPrice.source}`);
      console.log(`  Sell at: ${opp.highestPrice.price}c on ${opp.highestPrice.source}`);
      console.log(`  Profit: ${opp.priceSpread}c (${opp.profitMargin.toFixed(1)}% margin)`);
    }
  });
}
```

### 4. Crafting Profit Calculator

```javascript
// Check if a crafting project is profitable
const analysis = await ipcRenderer.invoke(
  'analyze-crafting-profit',
  'Ilvl 86 Vaal Regalia',
  '+2 Duration Gems Vaal Regalia',
  200, // 200c crafting cost
  'Standard'
);

if (analysis.success) {
  const data = analysis.data;
  console.log(`Base: ${data.baseCost}c`);
  console.log(`Crafting: ${data.craftingCost}c`);
  console.log(`Total Investment: ${data.baseCost + data.craftingCost}c`);
  console.log(`Expected Sale: ${data.expectedValue}c`);
  console.log(`Profit: ${data.profit}c (${data.roi.toFixed(1)}% ROI)`);
  console.log(`Risk: ${data.risk}`);

  if (data.profit > 0) {
    console.log('✅ PROFITABLE - Go ahead!');
  } else {
    console.log('❌ NOT PROFITABLE - Skip this');
  }
}
```

## Troubleshooting

### Puppeteer fails to download Chromium

If you're behind a proxy or firewall:

```bash
# Skip Chromium download and use system Chrome
PUPPETEER_SKIP_DOWNLOAD=true npm install

# Then set Chrome path
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
```

### Rate limiting still occurring

Adjust the rate limiter presets in `src/rateLimiter.ts`:

```typescript
export const RateLimitPresets = {
  poeTradeOfficial: {
    maxRequests: 5,        // Reduce to 5 per minute
    windowMs: 60000,
    minDelay: 5000,        // Increase delay to 5 seconds
    maxConcurrent: 1,
    retryAttempts: 3,
    retryDelayMs: 3000
  }
};
```

### Browser sessions not closing

Check stats and manually cleanup:

```javascript
const stats = await ipcRenderer.invoke('get-browser-stats');
console.log(`Active sessions: ${stats.data.activeSessions}`);

// Force cleanup
await ipcRenderer.invoke('cleanup-browsers');
```

## Future Improvements

Potential enhancements:
- [ ] WebSocket support for real-time price updates
- [ ] Bulk item comparison UI
- [ ] Automated trading bot (requires user approval)
- [ ] More sophisticated arbitrage detection
- [ ] Machine learning price predictions
- [ ] Discord/Telegram notifications for opportunities

## Security Notes

- **Never commit** session cookies or authentication tokens
- Sessions are stored in `data/sessions/` (already in .gitignore)
- Login uses visible browser - user controls credentials
- No credentials stored in code

## License

MIT
