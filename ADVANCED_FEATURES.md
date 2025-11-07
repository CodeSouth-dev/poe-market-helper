# Advanced Features Guide

This guide covers the newly implemented advanced features: PoB Import, Live Search & Notifications, and Fossil Optimization.

## Table of Contents

1. [Path of Building (PoB) Import](#path-of-building-pob-import)
2. [Live Search & Notifications](#live-search--notifications)
3. [Fossil Combination Optimizer](#fossil-combination-optimizer)
4. [Integration Examples](#integration-examples)

---

## Path of Building (PoB) Import

Instantly analyze entire builds by importing PoB pastebin codes.

### Features
- 📋 Parse PoB XML from pastebin codes
- 💰 Auto-price all items in the build
- 🎯 Extract main skill and support gems
- 🗺️ Identify passive tree keystones
- 🔨 Generate crafting recommendations
- 💎 Calculate total build cost

### Basic Import

```javascript
const result = await ipcRenderer.invoke('pob-import', pobCode, 'Standard');

if (result.success) {
  const build = result.data;

  console.log(`Build: ${build.buildName}`);
  console.log(`Class: ${build.className} (${build.ascendancy})`);
  console.log(`Level: ${build.level}`);
  console.log(`Main Skill: ${build.mainSkill}`);
  console.log(`Support Gems: ${build.supportGems.join(', ')}`);
  console.log(`Total Cost: ${build.totalCost.toFixed(0)}c`);

  // Items
  build.items.forEach(item => {
    console.log(`\n${item.slot}: ${item.name}`);
    console.log(`  Rarity: ${item.rarity}`);
    console.log(`  Cost: ${item.estimatedCost}c`);
    if (item.requiredMods.length > 0) {
      console.log(`  Required Mods:`);
      item.requiredMods.forEach(mod => console.log(`    • ${mod}`));
    }
  });

  // Keystones
  if (build.keystones.length > 0) {
    console.log(`\nKeystones: ${build.keystones.join(', ')}`);
  }

  // Crafting recommendations
  if (build.craftingRecommendations.length > 0) {
    console.log(`\nCrafting Recommendations:`);
    build.craftingRecommendations.forEach(rec => {
      console.log(`  ${rec.slot}: ${rec.baseItem}`);
      console.log(`    Mods: ${rec.desiredMods.join(', ')}`);
      console.log(`    Method: ${rec.craftingMethod}`);
      console.log(`    Est. Cost: ${rec.estimatedCost.toFixed(0)}c`);
    });
  }
}
```

### Quick Summary

```javascript
const result = await ipcRenderer.invoke('pob-get-summary', pobCode, 'Standard');

if (result.success) {
  const { name, cost, mainSkill, itemCount } = result.data;
  console.log(`${name}: ${cost}c (${mainSkill}, ${itemCount} items)`);
}
```

### Use Cases

**1. Budget Check**
```javascript
async function canAffordBuild(pobCode, budget, league) {
  const summary = await ipcRenderer.invoke('pob-get-summary', pobCode, league);

  if (summary.success) {
    if (summary.data.cost <= budget) {
      console.log(`✅ You can afford this build! (${summary.data.cost}c / ${budget}c)`);
      return true;
    } else {
      console.log(`❌ Over budget by ${summary.data.cost - budget}c`);
      return false;
    }
  }

  return false;
}
```

**2. Build Comparison**
```javascript
async function compareBuildCosts(pobCodes, league) {
  const results = [];

  for (const code of pobCodes) {
    const summary = await ipcRenderer.invoke('pob-get-summary', code, league);
    if (summary.success) {
      results.push(summary.data);
    }
  }

  // Sort by cost
  results.sort((a, b) => a.cost - b.cost);

  console.log('\nBuild Costs (cheapest to most expensive):');
  results.forEach((build, i) => {
    console.log(`${i + 1}. ${build.name}: ${build.cost}c`);
  });

  return results;
}
```

**3. Shopping List Generator**
```javascript
async function createShoppingList(pobCode, league) {
  const build = await ipcRenderer.invoke('pob-import', pobCode, league);

  if (build.success) {
    console.log(`\n🛒 Shopping List for ${build.data.buildName}\n`);

    // Sort items by cost (expensive items first)
    const sorted = [...build.data.items].sort((a, b) => b.estimatedCost - a.estimatedCost);

    console.log('PRIORITY PURCHASES:');
    sorted.forEach(item => {
      console.log(`[ ] ${item.name} (${item.slot}) - ${item.estimatedCost}c`);
      if (item.requiredMods.length > 0) {
        console.log(`    Required: ${item.requiredMods.join(', ')}`);
      }
    });

    console.log(`\nTotal Budget Needed: ${build.data.totalCost.toFixed(0)}c`);
  }
}
```

---

## Live Search & Notifications

Monitor the trade site in real-time and get notified of good deals instantly.

### Features
- 🔄 Auto-refresh searches every 30 seconds
- 🔔 Real-time notifications for new listings
- 💎 Underpriced item detection
- 📊 Search statistics
- ⏸️ Pause/resume functionality
- 🗑️ Multiple concurrent searches

### Create a Live Search

```javascript
const filter = {
  itemName: 'Shavronne\'s Wrappings',
  maxPrice: 500,
  minLinks: 6,
  league: 'Standard'
};

const result = await ipcRenderer.invoke('live-search-create', filter);

if (result.success) {
  const searchId = result.searchId;
  console.log(`✅ Live search created: ${searchId}`);
}
```

### Listen for New Listings

```javascript
// In your renderer process
const { ipcRenderer } = require('electron');

ipcRenderer.on('live-search-new-listing', (event, data) => {
  const { searchId, result } = data;

  console.log(`\n🆕 NEW LISTING FOUND!`);
  console.log(`Search: ${searchId}`);
  console.log(`Item: ${result.itemName}`);
  console.log(`Price: ${result.price}${result.currency}`);
  console.log(`Seller: ${result.seller}`);
  console.log(`Listed: ${result.listed}`);

  // Show desktop notification
  new Notification('New Deal Found!', {
    body: `${result.itemName} for ${result.price}c`,
    icon: 'path/to/icon.png'
  });

  // Play sound
  const audio = new Audio('notification.mp3');
  audio.play();
});
```

### Search Management

```javascript
// Stop a search
await ipcRenderer.invoke('live-search-stop', searchId);

// Resume a search
await ipcRenderer.invoke('live-search-resume', searchId);

// Delete a search
await ipcRenderer.invoke('live-search-delete', searchId);

// Get all active searches
const searches = await ipcRenderer.invoke('live-search-get-active');
console.log(`Active searches: ${searches.data.length}`);

// Get results for a specific search
const results = await ipcRenderer.invoke('live-search-get-results', searchId);
console.log(`Found ${results.data.length} results`);
```

### Underpriced Item Search

```javascript
// Find items 20% below market price
const result = await ipcRenderer.invoke(
  'live-search-underpriced',
  'Headhunter',      // item name
  500,               // typical price
  20,                // 20% discount
  'Standard'         // league
);

if (result.success) {
  console.log(`✅ Watching for Headhunters under 400c`);
}
```

### Search Statistics

```javascript
const stats = await ipcRenderer.invoke('live-search-stats');

if (stats.success) {
  console.log(`Total Searches: ${stats.data.totalSearches}`);
  console.log(`Active: ${stats.data.activeSearches}`);
  console.log(`Total Results: ${stats.data.totalResults}`);
  console.log(`Avg Results/Search: ${stats.data.averageResultsPerSearch.toFixed(1)}`);
}
```

### Use Cases

**1. Flip Bot**
```javascript
async function setupFlipBot(items, profitMargin, league) {
  for (const item of items) {
    // Get typical price
    const priceData = await ipcRenderer.invoke('compare-item-price', item.name, league);
    const typicalPrice = priceData.data.averagePrice;

    // Create search for items at discount
    await ipcRenderer.invoke(
      'live-search-underpriced',
      item.name,
      typicalPrice,
      profitMargin,
      league
    );

    console.log(`✅ Watching ${item.name} (buying < ${typicalPrice * (1 - profitMargin / 100)}c)`);
  }
}

// Watch for 10+ items with 15% profit margin
setupFlipBot([
  { name: 'Shavronne\'s Wrappings' },
  { name: 'Headhunter' },
  { name: 'Awakened Multistrike Support' },
  // ... more items
], 15, 'Standard');
```

**2. Crafting Base Finder**
```javascript
async function findCraftingBases(baseType, maxPrice, league) {
  const filter = {
    itemType: baseType,
    maxPrice,
    minLinks: 0,
    league
  };

  const result = await ipcRenderer.invoke('live-search-create', filter);

  if (result.success) {
    console.log(`✅ Watching for ${baseType} bases under ${maxPrice}c`);
    return result.searchId;
  }
}

// Find cheap ilvl 86 bases
findCraftingBases('Vaal Regalia', 10, 'Standard');
findCraftingBases('Hubris Circlet', 5, 'Standard');
```

---

## Fossil Combination Optimizer

Find the optimal fossil combinations for your desired mods.

### Features
- 🔍 Analyzes 1-4 fossil combinations
- 💰 Calculates cost per attempt
- 📊 Success rate estimation
- 🚫 Shows blocked mods
- 🎯 Highlights enhanced mods
- 🏆 Recommends best combo

### Basic Optimization

```javascript
const result = await ipcRenderer.invoke(
  'fossil-optimize',
  'Vaal Regalia',                    // base item
  ['+# to maximum Life',             // desired mods
   '+#% increased Energy Shield',
   '+#% to Fire Resistance'],
  'Standard'                         // league
);

if (result.success) {
  const opt = result.data;

  console.log(`\n🔨 Fossil Optimization for ${opt.baseItem}`);
  console.log(`Target Mods: ${opt.desiredMods.join(', ')}\n`);

  const best = opt.bestCombination;
  console.log(`✅ BEST COMBINATION:`);
  console.log(`   Fossils: ${best.fossils.join(' + ')}`);
  console.log(`   Resonator: ${best.resonator}`);
  console.log(`   Cost/Attempt: ${best.costPerAttempt}c`);
  console.log(`   Success Rate: ${(best.successRate * 100).toFixed(2)}%`);
  console.log(`   Avg Cost: ${best.averageCost.toFixed(0)}c`);

  if (best.blockedMods.length > 0) {
    console.log(`   Blocks: ${best.blockedMods.join(', ')}`);
  }

  if (best.enhancedMods.length > 0) {
    console.log(`   Enhances: ${best.enhancedMods.join(', ')}`);
  }

  console.log(`\n${opt.recommendation}`);

  // Show alternatives
  if (opt.allCombinations.length > 1) {
    console.log(`\nAlternative Combinations:`);
    opt.allCombinations.slice(1).forEach((combo, i) => {
      console.log(`${i + 2}. ${combo.fossils.join(' + ')} - ${combo.averageCost.toFixed(0)}c avg`);
    });
  }
}
```

### Use Cases

**1. Budget Fossil Crafting**
```javascript
async function findBudgetFossilCraft(baseItem, desiredMods, budget, league) {
  const opt = await ipcRenderer.invoke('fossil-optimize', baseItem, desiredMods, league);

  if (opt.success) {
    // Find combinations within budget
    const affordable = opt.data.allCombinations.filter(c => c.averageCost <= budget);

    if (affordable.length > 0) {
      const best = affordable[0];
      console.log(`\n✅ Affordable craft found!`);
      console.log(`${best.fossils.join(' + ')} in ${best.resonator}`);
      console.log(`Cost: ${best.averageCost.toFixed(0)}c (${budget}c budget)`);
      return best;
    } else {
      console.log(`\n❌ No affordable combinations found for ${budget}c budget`);
      console.log(`Cheapest option: ${opt.data.bestCombination.averageCost.toFixed(0)}c`);
    }
  }
}
```

**2. Crafting Profit Calculator**
```javascript
async function calculateFossilProfit(baseItem, desiredMods, sellPrice, league) {
  const opt = await ipcRenderer.invoke('fossil-optimize', baseItem, desiredMods, league);

  if (opt.success) {
    const craftCost = opt.data.bestCombination.averageCost;
    const profit = sellPrice - craftCost;
    const margin = (profit / sellPrice) * 100;

    console.log(`\n💰 Profit Analysis`);
    console.log(`Craft Cost: ${craftCost.toFixed(0)}c`);
    console.log(`Sell Price: ${sellPrice}c`);
    console.log(`Expected Profit: ${profit.toFixed(0)}c`);
    console.log(`Margin: ${margin.toFixed(1)}%`);

    if (profit > 0) {
      console.log(`✅ PROFITABLE!`);
    } else {
      console.log(`❌ NOT PROFITABLE`);
    }

    return { profitable: profit > 0, profit, margin };
  }
}

// Example: Can I profit from crafting ES chest?
calculateFossilProfit(
  'Vaal Regalia',
  ['+# to maximum Life', '+#% increased Energy Shield'],
  300,  // sells for 300c
  'Standard'
);
```

---

## Integration Examples

### Complete Crafting Workflow

```javascript
async function completeCraftingWorkflow(itemClass, league, budget) {
  console.log(`\n🎯 Complete Crafting Workflow`);
  console.log(`Item Class: ${itemClass}`);
  console.log(`Budget: ${budget}c`);

  // 1. Get top bases
  const bases = await ipcRenderer.invoke('craft-get-bases-by-class', itemClass, 86);
  console.log(`\n📦 Top Bases:`);
  bases.data.slice(0, 3).forEach(base => {
    console.log(`  • ${base.name} (${base.popularity} popular)`);
  });
  const chosenBase = bases.data[0].name;

  // 2. Get available mods
  const mods = await ipcRenderer.invoke('craft-get-mods-for-class', itemClass, 86, 'all');
  const topMods = mods.data
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(m => m.name);
  console.log(`\n📝 Top Mods: ${topMods.join(', ')}`);

  // 3. Get fossil combination
  const fossil = await ipcRenderer.invoke('fossil-optimize', chosenBase, topMods, league);
  console.log(`\n🔨 Best Fossil Combo: ${fossil.data.bestCombination.fossils.join(' + ')}`);
  console.log(`   Cost: ${fossil.data.bestCombination.averageCost.toFixed(0)}c`);

  // 4. Check if within budget
  if (fossil.data.bestCombination.averageCost <= budget) {
    console.log(`\n✅ Within budget! You can afford this craft.`);

    // 5. Set up live search for the base
    const baseSearch = await ipcRenderer.invoke('live-search-create', {
      itemName: chosenBase,
      maxPrice: budget * 0.1, // Spend 10% of budget on base
      league
    });

    console.log(`\n🔍 Live search active for ${chosenBase}`);

    return {
      base: chosenBase,
      mods: topMods,
      fossilCombo: fossil.data.bestCombination,
      searchId: baseSearch.searchId
    };
  } else {
    console.log(`\n❌ Over budget by ${(fossil.data.bestCombination.averageCost - budget).toFixed(0)}c`);
    return null;
  }
}

// Run complete workflow
completeCraftingWorkflow('Body Armour', 'Standard', 200);
```

### PoB + Live Search Integration

```javascript
async function buyoutBuild(pobCode, league) {
  // 1. Import PoB
  const build = await ipcRenderer.invoke('pob-import', pobCode, league);

  if (!build.success) {
    console.error('Failed to import PoB');
    return;
  }

  console.log(`\n🛒 Setting up live searches for ${build.data.buildName}\n`);

  // 2. Create live search for each item
  const searches = [];
  for (const item of build.data.items) {
    const filter = {
      itemName: item.name,
      maxPrice: item.estimatedCost * 1.1, // 10% margin
      league
    };

    const search = await ipcRenderer.invoke('live-search-create', filter);

    if (search.success) {
      searches.push({
        item: item.name,
        slot: item.slot,
        searchId: search.searchId
      });
      console.log(`✅ Watching ${item.slot}: ${item.name} (< ${filter.maxPrice}c)`);
    }
  }

  console.log(`\n📊 ${searches.length} live searches active`);
  console.log(`You'll be notified when items become available!`);

  return searches;
}

// Example: Auto-buy entire build
buyoutBuild('eNq1VltP2zAU/iuR30FJmnRNtQKq...', 'Standard');
```

---

## Tips & Best Practices

### For PoB Import
1. **Cache results** - Don't re-import the same build repeatedly
2. **Check missing items** - Handle builds with empty slots
3. **Validate prices** - Unique items may have wildly varying prices
4. **Use summaries** - For quick comparisons, use `pob-get-summary`

### For Live Search
1. **Limit concurrent searches** - Don't create too many (max 10-15)
2. **Use reasonable intervals** - Default 30s is good for most use cases
3. **Clean up searches** - Delete searches you're no longer using
4. **Set price filters** - Always set max price to avoid spam

### For Fossil Optimization
1. **Start simple** - Try single-fossil combos first
2. **Consider blockers** - Blocking unwanted mods can be more valuable than enhancing desired ones
3. **Update prices** - Fossil prices fluctuate; results are cached for 24h
4. **Test on cheap bases first** - Don't waste currency on expensive bases

---

## Troubleshooting

### PoB Import Issues
- **Invalid PoB code**: Make sure you copied the entire pastebin code
- **Timeout errors**: Build has too many items, try a simpler build
- **Price errors**: Item name doesn't match poe.ninja data

### Live Search Issues
- **No results**: Trade site may be blocking; check rate limits
- **Duplicate notifications**: Each new listing triggers once, this is expected
- **High memory usage**: Delete old searches to free up memory

### Fossil Optimization Issues
- **Inaccurate success rates**: Rates are estimates based on typical mod weights
- **Missing fossils**: Some niche fossils aren't included
- **Price discrepancies**: Fossil prices use defaults if poe.ninja fails

---

## Summary

These advanced features dramatically enhance the PoE Market Helper:

- 📋 **PoB Import**: Instant build analysis and cost calculation
- 🔍 **Live Search**: Real-time deal alerts and flip opportunities
- 🔨 **Fossil Optimizer**: Optimal crafting strategies with cost analysis

**Combined together**, you can:
1. Import a build from PoB
2. Calculate total cost
3. Set up live searches for all items
4. Get notified when deals appear
5. Optimize fossil crafting for missing items

**Result**: Complete automation of build planning, item acquisition, and crafting strategy! 🚀
