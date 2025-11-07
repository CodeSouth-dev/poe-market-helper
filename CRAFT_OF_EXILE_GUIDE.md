# Craft of Exile Integration Guide

## Overview

Integration with [craftofexile.com](https://www.craftofexile.com/) provides advanced crafting simulation and cost analysis features:

- 🎲 **Crafting Simulation** - Simulate different crafting methods
- 💰 **Cost Calculator** - Calculate expected costs for desired outcomes
- 📊 **Mod Weights** - View probability data for all mods
- 📖 **Crafting Guides** - Step-by-step guides for complex crafts
- ⚖️ **Method Comparison** - Compare chaos spam vs alt-regal vs fossils vs essence

## Features

### 1. Crafting Simulation

Simulate crafting an item with specific mods using different methods.

```javascript
const result = await ipcRenderer.invoke(
  'craft-simulate',
  'Vaal Regalia',           // base item
  86,                       // item level
  ['+1 to Level of Socketed Gems', 'Increased Energy Shield'],  // desired mods
  'chaos'                   // method: 'chaos', 'alt-regal', 'fossil', 'essence', 'harvest'
);

// Returns:
// {
//   success: true,
//   data: {
//     item: "Vaal Regalia",
//     desiredMods: ["+1 to Level of Socketed Gems", "Increased Energy Shield"],
//     methods: [
//       {
//         name: "Chaos Spam",
//         averageCost: 150,
//         averageAttempts: 300,
//         currency: "Chaos Orb",
//         successRate: 0.33,
//         description: "Spam Chaos Orbs until desired mods appear"
//       },
//       {
//         name: "Fossil Crafting",
//         averageCost: 200,
//         averageAttempts: 80,
//         currency: "Fossils",
//         successRate: 1.25,
//         description: "Use targeted fossils to force desired mods"
//       },
//       // ... more methods
//     ],
//     cheapestMethod: { name: "Alt-Regal", averageCost: 85, ... },
//     fastestMethod: { name: "Fossil Crafting", averageAttempts: 80, ... },
//     totalCost: 85
//   }
// }
```

**Crafting Methods:**
- `chaos` - Chaos Orb spam (simple, medium cost)
- `alt-regal` - Alteration + Regal (cheapest, slow)
- `fossil` - Fossil crafting (fast, expensive)
- `essence` - Essence crafting (guaranteed mod, medium)
- `harvest` - Harvest reforge (targeted, variable)

### 2. Mod Weight Analysis

Get probability weights for all available mods on a base item.

```javascript
const result = await ipcRenderer.invoke(
  'craft-get-mod-weights',
  'Steel Ring',
  84
);

// Returns:
// {
//   success: true,
//   data: [
//     {
//       mod: "Tyrannical (155-169% Physical Damage)",
//       weight: 1000,
//       tier: "T1",
//       level: 83
//     },
//     {
//       mod: "Merciless (130-154% Physical Damage)",
//       weight: 1000,
//       tier: "T2",
//       level: 76
//     },
//     // ... all available mods
//   ]
// }
```

**Use case:** Understand your odds before starting an expensive craft!

### 3. Crafting Cost Calculator

Calculate the expected cost to achieve specific mods.

```javascript
const currencyPrices = {
  'Chaos Orb': 1,
  'Exalted Orb': 180,
  'Alteration Orb': 0.2,
  'Fossils': 5
};

const result = await ipcRenderer.invoke(
  'craft-calculate-cost',
  'Hubris Circlet',
  86,
  ['+2 to Level of Socketed Gems', 'Increased Energy Shield', 'Maximum Life'],
  currencyPrices
);

// Returns:
// {
//   success: true,
//   data: {
//     method: "Alt-Regal",
//     expectedCost: 90,        // 90 chaos total
//     expectedAttempts: 450,   // 450 alterations needed
//     breakdown: [
//       {
//         currency: "Alteration Orb",
//         amount: 450,
//         cost: 0.2            // 450 * 0.2 = 90c
//       }
//     ],
//     probability: 0.22        // 22% success rate per regal
//   }
// }
```

**Workflow:**
1. Get current currency prices from poe.ninja
2. Pass them to the calculator
3. Get accurate cost estimate in chaos equivalent

### 4. Crafting Guides

Get step-by-step guides for specific crafting projects.

```javascript
const result = await ipcRenderer.invoke(
  'craft-get-guide',
  'Spine Bow',
  ['+2 to Socketed Bow Gems', 'Increased Attack Speed', 'Critical Strike Chance']
);

// Returns:
// {
//   success: true,
//   data: {
//     itemType: "Spine Bow",
//     baseItem: "Spine Bow",
//     recommendedIlvl: 86,
//     steps: [
//       {
//         step: 1,
//         action: "Acquire base item with correct item level",
//         expectedCost: 5,
//         notes: "Buy ilvl 86+ base from trade"
//       },
//       {
//         step: 2,
//         action: "Use Deafening Essence or Chaos Spam",
//         expectedCost: 150,
//         notes: "Target life/ES or damage mods"
//       },
//       {
//         step: 3,
//         action: "Craft prefix/suffix with bench",
//         expectedCost: 10,
//         notes: "Fill open affixes with useful mods"
//       },
//       {
//         step: 4,
//         action: "Divine to perfect rolls",
//         expectedCost: 20,
//         notes: "Optional - improves final value"
//       }
//     ],
//     totalEstimatedCost: 185,
//     difficulty: "Medium"
//   }
// }
```

### 5. Method Comparison

Compare all crafting methods side-by-side for the same outcome.

```javascript
const result = await ipcRenderer.invoke(
  'craft-compare-methods',
  'Stygian Vise',
  86,
  ['Maximum Life', 'Elemental Resistances', 'Strength']
);

// Returns:
// {
//   success: true,
//   data: {
//     item: "Stygian Vise",
//     methods: [
//       {
//         name: "Chaos Spam",
//         cost: 150,
//         time: "15min",
//         difficulty: "Easy",
//         successRate: 0.33,
//         recommended: false
//       },
//       {
//         name: "Alt-Regal",
//         cost: 85,
//         time: "22.5min",
//         difficulty: "Medium",
//         successRate: 0.22,
//         recommended: true    // ✅ Cheapest method
//       },
//       {
//         name: "Fossil Crafting",
//         cost: 200,
//         time: "4.0h",
//         difficulty: "Easy",
//         successRate: 1.25,
//         recommended: false
//       },
//       {
//         name: "Essence Crafting",
//         cost: 120,
//         time: "10min",
//         difficulty: "Medium",
//         successRate: 0.5,
//         recommended: false
//       }
//     ],
//     recommendation: "For budget crafting, use Alt-Regal (~85c). For faster results, use Fossil Crafting (~80 attempts). Choose based on your priorities."
//   }
// }
```

### 6. Get Top Bases by Item Class

Automatically retrieve the best base items for any item class.

```javascript
const result = await ipcRenderer.invoke(
  'craft-get-bases-by-class',
  'Body Armour',
  86
);

// Returns:
// {
//   success: true,
//   data: [
//     {
//       name: "Vaal Regalia",
//       itemLevel: 86,
//       defense: "Highest",
//       dps: "Best",
//       requirements: "Level 60",
//       popularity: "100%",
//       tags: ["meta", "popular"]
//     },
//     {
//       name: "Astral Plate",
//       itemLevel: 86,
//       defense: "High",
//       dps: "Good",
//       requirements: "Level 62",
//       popularity: "85%",
//       tags: ["meta", "popular"]
//     },
//     // ... more bases
//   ]
// }
```

**Supported Item Classes:**
- Body Armour, Helmet, Gloves, Boots, Shield
- Belt, Amulet, Ring
- Bow, Wand, One Hand Sword, Two Hand Sword
- One Hand Axe, Two Hand Axe, One Hand Mace, Sceptre
- Staff, Dagger, Claw, Quiver

### 7. Get Available Mods for Item Class

Retrieve all available mods for a specific item class and level.

```javascript
const result = await ipcRenderer.invoke(
  'craft-get-mods-for-class',
  'Body Armour',
  86,
  'all'  // 'prefix', 'suffix', or 'all'
);

// Returns:
// {
//   success: true,
//   data: [
//     {
//       name: "+# to maximum Life",
//       type: "prefix",
//       tier: "T1",
//       minLevel: 44,
//       weight: 1000,
//       stats: "+90 to +99 to maximum Life"
//     },
//     {
//       name: "+# to Level of Socketed Gems",
//       type: "prefix",
//       tier: "T1",
//       minLevel: 25,
//       weight: 100,
//       stats: "+1 to Level of Socketed Gems"
//     },
//     {
//       name: "+#% to Fire Resistance",
//       type: "suffix",
//       tier: "T1",
//       minLevel: 72,
//       weight: 1000,
//       stats: "+46% to +48% to Fire Resistance"
//     },
//     // ... more mods
//   ]
// }
```

**Mod Types:**
- `'prefix'` - Only prefix mods
- `'suffix'` - Only suffix mods
- `'all'` - Both prefix and suffix mods (default)

## Complete Workflow Examples

### Workflow 1: Find Best Crafting Method for Your Budget

```javascript
const { ipcRenderer } = require('electron');

async function findBestCraftForBudget(budget) {
  // 1. Get popular items you can afford
  const popularItems = await ipcRenderer.invoke(
    'get-popular-items-by-slot',
    'Standard',
    'ring'
  );

  // 2. For each popular item, compare crafting methods
  for (const item of popularItems.data.slice(0, 3)) {
    console.log(`\n📊 Analyzing: ${item.name}`);
    console.log(`   Used by ${item.usagePercent.toFixed(1)}% of builds`);

    // Get crafting methods comparison
    const comparison = await ipcRenderer.invoke(
      'craft-compare-methods',
      item.name,
      86,
      ['Maximum Life', 'Resistances']
    );

    // Find methods within budget
    const affordable = comparison.data.methods.filter(m => m.cost <= budget);

    if (affordable.length > 0) {
      const best = affordable.sort((a, b) => a.cost - b.cost)[0];
      console.log(`   ✅ Best method: ${best.name}`);
      console.log(`   💰 Cost: ${best.cost}c`);
      console.log(`   ⏱️  Time: ${best.time}`);
      console.log(`   🎯 Success Rate: ${(best.successRate * 100).toFixed(1)}%`);
    } else {
      console.log(`   ❌ Too expensive for ${budget}c budget`);
    }
  }
}

// Find best craft for 150 chaos budget
findBestCraftForBudget(150);
```

### Workflow 2: Calculate Profit from Crafting

```javascript
async function calculateCraftingProfit(baseItem, targetMods, sellPrice) {
  // 1. Get current currency prices
  const chaosPrices = {
    'Chaos Orb': 1,
    'Alteration Orb': 0.2,
    'Exalted Orb': 180,
    'Fossils': 5,
    'Essence': 3
  };

  // 2. Calculate crafting cost
  const costData = await ipcRenderer.invoke(
    'craft-calculate-cost',
    baseItem,
    86,
    targetMods,
    chaosPrices
  );

  const craftingCost = costData.data.expectedCost;

  // 3. Calculate profit
  const profit = sellPrice - craftingCost;
  const profitMargin = (profit / sellPrice) * 100;

  console.log(`\n💎 Crafting Profit Analysis: ${baseItem}`);
  console.log(`   Crafting Cost: ${craftingCost.toFixed(0)}c`);
  console.log(`   Sell Price: ${sellPrice}c`);
  console.log(`   Expected Profit: ${profit.toFixed(0)}c`);
  console.log(`   Profit Margin: ${profitMargin.toFixed(1)}%`);
  console.log(`   Method: ${costData.data.method}`);
  console.log(`   Attempts Needed: ${costData.data.expectedAttempts}`);

  return {
    profitable: profit > 0,
    profit,
    profitMargin,
    craftingCost,
    method: costData.data.method
  };
}

// Example: Can we profit from crafting ES helmets?
calculateCraftingProfit(
  'Hubris Circlet',
  ['+2 to Level of Socketed Gems', 'Increased Energy Shield'],
  500  // sells for 500c
);
```

### Workflow 3: Complete Crafting Project Planner

```javascript
async function planCraftingProject(itemType, desiredMods, budget, league) {
  console.log(`\n🔨 Planning Crafting Project`);
  console.log(`   Item: ${itemType}`);
  console.log(`   Budget: ${budget}c`);
  console.log(`   League: ${league}`);

  // 1. Check if this item is popular
  const slot = itemType.toLowerCase().includes('ring') ? 'ring' :
               itemType.toLowerCase().includes('boot') ? 'boots' :
               itemType.toLowerCase().includes('helm') ? 'helmet' : 'weapon';

  const popularity = await ipcRenderer.invoke(
    'get-popular-items-by-slot',
    league,
    slot
  );

  const popularItem = popularity.data.find(i => i.name.includes(itemType));

  if (popularItem) {
    console.log(`   📊 Popularity: ${popularItem.usagePercent.toFixed(1)}% of builds`);
    console.log(`   🔥 Demand: ${popularItem.usageCount} builds`);
  }

  // 2. Get best item level for mods
  const ilvlData = await ipcRenderer.invoke(
    'get-best-ilvl-for-mods',
    slot,
    desiredMods
  );

  console.log(`   📏 Recommended ilvl: ${ilvlData.data.recommendedIlvl}`);

  // 3. Compare crafting methods
  const methods = await ipcRenderer.invoke(
    'craft-compare-methods',
    itemType,
    ilvlData.data.recommendedIlvl,
    desiredMods
  );

  console.log(`\n   🎯 Crafting Methods:`);
  methods.data.methods.forEach(method => {
    const withinBudget = method.cost <= budget ? '✅' : '❌';
    console.log(`   ${withinBudget} ${method.name}: ${method.cost}c (${method.time}, ${method.difficulty})`);
  });

  // 4. Get step-by-step guide
  const guide = await ipcRenderer.invoke(
    'craft-get-guide',
    itemType,
    desiredMods
  );

  console.log(`\n   📖 Crafting Steps:`);
  guide.data.steps.forEach(step => {
    console.log(`   ${step.step}. ${step.action} (~${step.expectedCost}c)`);
    console.log(`      ${step.notes}`);
  });

  console.log(`\n   💰 Total Estimated Cost: ${guide.data.totalEstimatedCost}c`);
  console.log(`   🎓 Difficulty: ${guide.data.difficulty}`);

  // 5. Final recommendation
  console.log(`\n   ${methods.data.recommendation}`);
}

// Plan a complex crafting project
planCraftingProject(
  'Vaal Regalia',
  ['+2 to Level of Socketed Gems', 'Increased Energy Shield', 'Maximum Life'],
  300,
  'Standard'
);
```

### Workflow 4: Auto-Populate Crafting UI with Class Selection

```javascript
// When user selects an item class, automatically populate bases and mods
async function handleItemClassChange(itemClass, itemLevel = 86) {
  console.log(`\n🎯 Loading data for ${itemClass}...`);

  // 1. Get top bases for this class
  const basesResult = await ipcRenderer.invoke(
    'craft-get-bases-by-class',
    itemClass,
    itemLevel
  );

  if (basesResult.success) {
    console.log(`\n📦 Top Bases for ${itemClass}:`);
    basesResult.data.slice(0, 5).forEach((base, index) => {
      console.log(`   ${index + 1}. ${base.name}`);
      console.log(`      Defense: ${base.defense} | Popularity: ${base.popularity}`);
    });

    // Populate UI dropdown with bases
    const baseSelect = document.getElementById('baseItemSelect');
    baseSelect.innerHTML = '<option value="">Select Base...</option>';
    basesResult.data.forEach(base => {
      const option = document.createElement('option');
      option.value = base.name;
      option.textContent = `${base.name} (${base.popularity} popular)`;
      baseSelect.appendChild(option);
    });
  }

  // 2. Get available mods for this class
  const modsResult = await ipcRenderer.invoke(
    'craft-get-mods-for-class',
    itemClass,
    itemLevel,
    'all'
  );

  if (modsResult.success) {
    console.log(`\n📝 Available Mods: ${modsResult.data.length} total`);

    // Separate prefix and suffix
    const prefixes = modsResult.data.filter(m => m.type === 'prefix');
    const suffixes = modsResult.data.filter(m => m.type === 'suffix');

    console.log(`   Prefixes: ${prefixes.length} | Suffixes: ${suffixes.length}`);

    // Show top 5 most weighted mods of each type
    console.log(`\n   🔥 Top Prefixes:`);
    prefixes.sort((a, b) => b.weight - a.weight).slice(0, 5).forEach(mod => {
      console.log(`      • ${mod.name} (${mod.tier})`);
      console.log(`        ${mod.stats}`);
    });

    console.log(`\n   🔥 Top Suffixes:`);
    suffixes.sort((a, b) => b.weight - a.weight).slice(0, 5).forEach(mod => {
      console.log(`      • ${mod.name} (${mod.tier})`);
      console.log(`        ${mod.stats}`);
    });

    // Populate mod search/autocomplete
    window.availableMods = modsResult.data;
    updateModAutocomplete(modsResult.data);
  }
}

// Example: User selects "Body Armour"
handleItemClassChange('Body Armour', 86);

// Output:
// 🎯 Loading data for Body Armour...
//
// 📦 Top Bases for Body Armour:
//    1. Vaal Regalia
//       Defense: Highest | Popularity: 100%
//    2. Astral Plate
//       Defense: High | Popularity: 85%
//    3. Glorious Plate
//       Defense: High | Popularity: 70%
//    4. Occultist's Vestment
//       Defense: High | Popularity: 55%
//    5. Sadist Garb
//       Defense: High | Popularity: 40%
//
// 📝 Available Mods: 23 total
//    Prefixes: 13 | Suffixes: 10
//
//    🔥 Top Prefixes:
//       • +# to maximum Life (T1)
//         +90 to +99 to maximum Life
//       • #% increased Energy Shield (T1)
//         131% to 160% increased Energy Shield
//       • +# to maximum Energy Shield (T1)
//         +71 to +80 to maximum Energy Shield
//       • #% increased Armour (T1)
//         131% to 160% increased Armour
//       • #% increased Evasion Rating (T1)
//         131% to 160% increased Evasion Rating
//
//    🔥 Top Suffixes:
//       • +#% to Fire Resistance (T1)
//         +46% to +48% to Fire Resistance
//       • +#% to Cold Resistance (T1)
//         +46% to +48% to Cold Resistance
//       • +#% to Lightning Resistance (T1)
//         +46% to +48% to Lightning Resistance
//       • #% increased Stun and Block Recovery (T1)
//         24% to 28% increased Stun and Block Recovery
//       • +#% to Chaos Resistance (T1)
//         +33% to +35% to Chaos Resistance
```

**Use Case:**
This workflow is perfect for auto-populating your crafting UI when users select an item class. It shows the best bases and all available mods automatically, making the crafting helper much more user-friendly!

## Cache Management

Craft of Exile data is cached for 24 hours.

```javascript
// Clear cache to get fresh data
await ipcRenderer.invoke('clear-craft-cache');
```

## Performance Notes

- **First request:** 3-5 seconds (scrapes craftofexile.com)
- **Cached requests:** Instant (<1ms)
- **Cache duration:** 24 hours
- **Rate limiting:** 15 req/min (respectful to craftofexile.com)

## Tips for Best Results

1. **Always check item level requirements** - Use `get-best-ilvl-for-mods` before buying bases
2. **Compare methods first** - Different mods favor different crafting methods
3. **Consider your time** - Cheapest isn't always best if it takes hours
4. **Check market demand** - Use `get-popular-items-by-slot` to ensure you can sell
5. **Calculate profit** - Factor in base cost + crafting cost vs sell price
6. **Use fossils for targeted mods** - Often faster even if more expensive
7. **Alt-regal for budget crafts** - Cheapest method for most use cases

## Integration with Other Features

### Combine with Price Comparison

```javascript
// 1. Find popular items
const popular = await ipcRenderer.invoke('get-popular-items-by-slot', 'Standard', 'boots');

// 2. Compare base prices
const basePrices = await ipcRenderer.invoke(
  'poe-trade-compare-bases',
  popular.data.slice(0, 5).map(i => i.name),
  'Standard'
);

// 3. Calculate crafting cost
const craftCost = await ipcRenderer.invoke(
  'craft-calculate-cost',
  basePrices.data.cheapest.base,
  86,
  ['Movement Speed', 'Maximum Life'],
  { 'Essence': 3 }
);

// 4. Total project cost
const totalCost = basePrices.data.cheapest.price + craftCost.data.expectedCost;
console.log(`Total project cost: ${totalCost.toFixed(0)}c`);
```

### Combine with Build Analysis

```javascript
// 1. Get meta builds
const builds = await ipcRenderer.invoke('get-build-stats', 'Standard');

// 2. Find top skill
const topSkill = builds.data.topSkills[0].skill;

// 3. Get items for that skill (you'd need to filter builds by skill first)
// 4. Simulate crafting those items
// 5. Calculate profit potential
```

## Troubleshooting

**Issue:** Simulation takes a long time
- **Solution:** First request downloads data; subsequent requests use cache

**Issue:** Costs seem inaccurate
- **Solution:** Update currency prices regularly from poe.ninja

**Issue:** Cache is stale
- **Solution:** Call `clear-craft-cache` to force refresh

## Summary

Craft of Exile integration answers:
- ❓ "What's the cheapest way to craft this?" → Method comparison
- ❓ "How much will this craft cost?" → Cost calculator
- ❓ "What are my odds?" → Mod weights
- ❓ "Is this craft profitable?" → Combine with price comparison
- ❓ "How do I craft this step-by-step?" → Crafting guides
- ❓ "What are the best bases for this class?" → Get top bases by class
- ❓ "What mods can I get on this item?" → Get available mods for class

**Result:** Make informed crafting decisions and maximize profit! 🚀

**New Features:**
- 🎯 **Auto-populate bases** when item class is selected
- 📝 **Auto-populate mods** filtered by item class and level
- 🔥 **Weight-based sorting** to show most common mods first
- 💾 **24-hour caching** for instant responses
- 🎨 **Perfect for UI integration** - just call the IPC handlers!
