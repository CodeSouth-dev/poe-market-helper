# Slot Analysis & PoeDB Integration Guide

## Overview

Enhanced build analysis features that show you:
- **Which items sell fastest** (by tracking build usage %)
- **Best bases to craft** (boots, weapons, gloves, etc.)
- **Optimal item levels** for your desired mods
- **Weapon meta analysis** (what weapons are most popular)

## New Features

### 1. Slot-Based Item Analysis

See which items are most popular in each equipment slot with exact percentages.

```javascript
// Get popular boots with usage percentages
const result = await ipcRenderer.invoke('get-popular-items-by-slot', 'Standard', 'boots');

// Returns:
// {
//   success: true,
//   data: [
//     {
//       name: "Slink Boots",
//       baseType: "Slink Boots",
//       usageCount: 35,
//       usagePercent: 35.7,  // 35.7% of builds use this!
//       builds: ["Build1", "Build2", ...]
//     },
//     {
//       name: "Two-Toned Boots",
//       usageCount: 28,
//       usagePercent: 28.6,
//       ...
//     }
//   ]
// }
```

**Supported slots:**
- `boots` - All boot bases
- `gloves` - All glove bases
- `helmet` - All helmet bases
- `body armour` - Chest pieces
- `weapon` - All weapons
- `ring` - Rings
- `amulet` - Amulets
- `belt` - Belts

**Use case:** Find which boot base is most popular, craft it, and sell fast!

### 2. Weapon Configuration Analysis

Deep dive into weapon usage across all builds.

```javascript
const result = await ipcRenderer.invoke('get-weapon-analysis', 'Standard');

// Returns:
// {
//   success: true,
//   data: {
//     mainHand: [
//       { name: "Wand of...", usagePercent: 15.3 },
//       ...
//     ],
//     offHand: [
//       { name: "Shield of...", usagePercent: 22.1 },
//       ...
//     ],
//     twoHanded: [
//       { name: "Staff of...", usagePercent: 8.7 },
//       ...
//     ],
//     weaponTypes: [
//       { type: "Wand", usagePercent: 32.5 },
//       { type: "Sword", usagePercent: 18.2 },
//       { type: "Bow", usagePercent: 15.7 },
//       ...
//     ]
//   }
// }
```

**Insights you get:**
- Most popular weapon type overall
- Main hand vs off-hand usage
- Two-handed weapon popularity
- Which specific weapons sell best

### 3. PoeDB Modifier Database

Scrape and cache modifier data from https://poedb.tw/us/Modifiers

```javascript
// Get all modifiers for weapons
const result = await ipcRenderer.invoke('scrape-poedb-modifiers', 'weapon');

// Returns:
// {
//   success: true,
//   data: [
//     {
//       name: "Tyrannical",
//       type: "prefix",
//       level: 83,
//       tags: ["damage", "physical"],
//       weight: 1000,
//       tiers: [
//         {
//           tier: "T1",
//           level: 83,
//           stats: ["155-169% increased Physical Damage"],
//           weight: 1000
//         }
//       ]
//     },
//     ...
//   ]
// }
```

**Item classes supported:**
- `weapon`, `armor`, `boots`, `gloves`, `helmet`, `ring`, `amulet`, `belt`, `jewel`

**Cache:** Data cached for 7 days to avoid excessive requests

### 4. Base Item Data from PoeDB

Get base item information including drop levels and requirements.

```javascript
const result = await ipcRenderer.invoke('scrape-poedb-base-items', 'boots');

// Returns:
// {
//   success: true,
//   data: [
//     {
//       name: "Slink Boots",
//       itemClass: "Boots",
//       dropLevel: 69,
//       requiredLevel: 69,
//       implicitMods: ["+(50-60) to maximum Energy Shield"],
//       bestIlvlForCrafting: 84  // Best ilvl for top-tier mods
//     },
//     ...
//   ]
// }
```

### 5. Recommended Item Level for Mods

Automatically calculates the best ilvl for your crafting project.

```javascript
// I want to craft "+2 to Socketed Gems" and "Tyrannical" on a weapon
const result = await ipcRenderer.invoke(
  'get-best-ilvl-for-mods',
  'weapon',
  ['+2 to Socketed Gems', 'Tyrannical', 'Merciless']
);

// Returns:
// {
//   success: true,
//   data: {
//     recommendedIlvl: 84,
//     reasoning: "Item level 84 required for all desired modifiers",
//     modDetails: [
//       { mod: "+2 to Socketed Gems", minLevel: 64 },
//       { mod: "Tyrannical", minLevel: 83 },
//       { mod: "Merciless", minLevel: 76 }
//     ]
//   }
// }
```

**This tells you:** Buy an ilvl 84 base for best chance of hitting these mods!

## Example Workflows

### Workflow 1: Find Best Boot to Craft

```javascript
// Step 1: See which boots are popular
const boots = await ipcRenderer.invoke('get-popular-items-by-slot', 'Standard', 'boots');

console.log('Top 3 most popular boots:');
boots.data.slice(0, 3).forEach((boot, i) => {
  console.log(`${i+1}. ${boot.name} - ${boot.usagePercent.toFixed(1)}% usage`);
});

// Step 2: Get base info for the most popular boot
const mostPopular = boots.data[0].name;
const baseInfo = await ipcRenderer.invoke('scrape-poedb-base-items', 'boots');
const ourBase = baseInfo.data.find(b => b.name === mostPopular);

console.log(`\nCraft ${mostPopular}:`);
console.log(`  Best ilvl: ${ourBase.bestIlvlForCrafting}`);
console.log(`  Implicit: ${ourBase.implicitMods.join(', ')}`);

// Step 3: Get available mods
const mods = await ipcRenderer.invoke('scrape-poedb-modifiers', 'boots');
console.log(`\n${mods.data.length} possible modifiers to craft`);
```

### Workflow 2: Meta Weapon Analysis

```javascript
// What weapons are hot right now?
const weaponMeta = await ipcRenderer.invoke('get-weapon-analysis', 'Standard');

console.log('\n🔥 Current Weapon Meta:');
console.log('\nMost Popular Types:');
weaponMeta.data.weaponTypes.slice(0, 5).forEach(wt => {
  console.log(`  ${wt.type}: ${wt.usagePercent.toFixed(1)}%`);
});

console.log('\nTop Main Hand Weapons:');
weaponMeta.data.mainHand.slice(0, 3).forEach(w => {
  console.log(`  ${w.name}: ${w.usagePercent.toFixed(1)}%`);
});

// Now you know: Craft Wands if they're 32%+ usage!
```

### Workflow 3: Optimal Crafting Project

```javascript
// I want to craft a high-end ring with life and resistance
const desiredMods = [
  'Maximum Life',
  'Fire Resistance',
  'Cold Resistance',
  'Lightning Resistance'
];

const ilvlRec = await ipcRenderer.invoke(
  'get-best-ilvl-for-mods',
  'ring',
  desiredMods
);

console.log(`\n🎯 Crafting Recommendation:`);
console.log(`  Buy: ${ilvlRec.data.recommendedIlvl}+ ring base`);
console.log(`  Reasoning: ${ilvlRec.data.reasoning}`);

console.log('\n  Mod Requirements:');
ilvlRec.data.modDetails.forEach(mod => {
  console.log(`    ${mod.mod}: ilvl ${mod.minLevel}+`);
});

// Check which ring base is most popular
const rings = await ipcRenderer.invoke('get-popular-items-by-slot', 'Standard', 'ring');
const bestRing = rings.data[0];

console.log(`\n  ✅ Craft on: ${bestRing.name} (${bestRing.usagePercent.toFixed(1)}% usage)`);
console.log(`  Will sell fast to ${bestRing.usageCount} builds!`);
```

## Cache Management

PoeDB data is cached for 7 days to avoid hammering their servers.

```javascript
// Clear cache if you want fresh data
await ipcRenderer.invoke('clear-poedb-cache');
```

## Performance Notes

- **First scrape:** 5-10 seconds per item class (downloads from poedb.tw)
- **Cached requests:** Instant (<1ms)
- **Cache duration:** 7 days
- **Rate limiting:** 10 req/min to poedb.tw (respectful)

## Tips

1. **Find fast-selling items:** Look for >30% usage in slot analysis
2. **Craft popular bases:** Higher % = faster sales
3. **Use recommended ilvl:** Don't waste currency on wrong item levels
4. **Check weapon meta:** 30%+ weapon type usage = hot market
5. **Combine with wealth filter:** Use `get-popular-craftable-items` for budget-aware choices

## Frontend Integration Example

```javascript
// Button: "Show me hot boots to craft"
document.getElementById('analyze-boots').addEventListener('click', async () => {
  const { ipcRenderer } = require('electron');

  // Get popular boots
  const boots = await ipcRenderer.invoke('get-popular-items-by-slot', 'Standard', 'boots');

  // Display results
  const list = document.getElementById('boot-list');
  list.innerHTML = '';

  boots.data.slice(0, 10).forEach(boot => {
    const item = document.createElement('div');
    item.className = 'boot-item';
    item.innerHTML = `
      <strong>${boot.name}</strong>
      <span class="usage">${boot.usagePercent.toFixed(1)}% usage</span>
      <span class="count">${boot.usageCount} builds</span>
      <button onclick="craftThis('${boot.name}')">Craft This!</button>
    `;
    list.appendChild(item);
  });
});
```

## Summary

These features answer:
- ❓ "Which boots sell the fastest?" → Slot analysis
- ❓ "What weapon should I craft?" → Weapon analysis
- ❓ "What ilvl do I need?" → PoeDB ilvl recommendation
- ❓ "What mods are available?" → PoeDB modifiers
- ❓ "What's the current meta?" → Build stats + weapon analysis

**Result:** Craft items that sell fast at good prices! 🚀
