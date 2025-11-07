# Backend Headless Browser & Advanced Features

## Overview

This document describes the new backend features added to the PoE Market Helper, including:

- ✅ Headless browser automation with Puppeteer
- ✅ Rate limiting to prevent spam and API blocks
- ✅ Automatic browser session management with cleanup
- ✅ Path of Exile official trade site integration with login support
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

### 4. Price Comparison Service (`src/priceComparison.ts`)

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

### 5. Browser Management IPC Handlers

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

### 2. Arbitrage Bot

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

### 3. Crafting Profit Calculator

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
