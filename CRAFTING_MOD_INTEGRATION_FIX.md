# Crafting Mod Integration Fix

## Current Issues Identified

### ❌ Problems:
1. **No Mod Weights Displayed**: Frontend uses hardcoded MOD_DATABASE without weight information
2. **Backend Not Used**: RePoE mod data with actual spawn weights exists in backend but isn't called
3. **No Mod Blocking UI**: No interface for fossil blocking or metacrafting options
4. **Hardcoded Mod List**: MOD_DATABASE in index.html is static and incomplete

### ✅ What Exists (Working):
- Backend: `craftingData.searchMods()` - Returns mods with spawn weights from RePoE
- Backend: `craftingData.getModsForItemClass()` - Returns mods filtered by item tags
- IPC Handler: `search-mods` - Already implemented in main.ts
- Mod types in RePoE include:
  - `name`: Mod name
  - `type`: prefix/suffix
  - `spawn_weights`: Array of {tag, weight} objects
  - `stats`: Mod values
  - `required_level`: ilvl requirement

## Required Fixes

### 1. Add IPC Handler for Getting Mods with Weights

**File**: `src/main.ts`

Add new handler after line 153:

```typescript
ipcMain.handle('get-mods-for-item', async (event: any, params: {
  itemClass: string;
  modType: 'prefix' | 'suffix';
  itemLevel: number;
  baseItemName?: string;
}) => {
  try {
    if (!craftingData.isLoaded()) {
      await craftingData.loadAll();
    }

    const baseItem = params.baseItemName
      ? craftingData.getBaseItem(params.baseItemName)
      : null;

    const tags = baseItem?.tags || [params.itemClass.toLowerCase()];

    // Get all mods for this item class
    const allMods = craftingData.getModsForItemClass(params.itemClass, tags);

    // Filter by type and ilvl
    const filteredMods = allMods
      .filter(mod => mod.type === params.modType)
      .filter(mod => mod.required_level <= params.itemLevel)
      .map(mod => ({
        name: mod.name,
        type: mod.type,
        requiredLevel: mod.required_level,
        weight: getModWeight(mod, tags),
        stats: mod.stats,
        spawnWeights: mod.spawn_weights
      }))
      .filter(mod => mod.weight > 0) // Only show rollable mods
      .sort((a, b) => b.weight - a.weight); // Sort by weight (higher = more common)

    return { success: true, data: filteredMods };
  } catch (error: any) {
    console.error('Get mods error:', error);
    return { success: false, error: error.message };
  }
});

// Helper to get mod weight for specific item tags
function getModWeight(mod: any, tags: string[]): number {
  if (!mod.spawn_weights || mod.spawn_weights.length === 0) return 0;

  // Find weight for matching tags
  for (const sw of mod.spawn_weights) {
    if (tags.some(tag => tag.toLowerCase() === sw.tag.toLowerCase())) {
      return sw.weight;
    }
  }

  return 0;
}
```

### 2. Update Frontend to Call Backend for Mods

**File**: `src/index.html`

Replace the `getModsForItemClass` function (around line 1186) with:

```javascript
async function getModsForItemClass(itemClass, modType, itemLevel = 100) {
    if (!itemClass) return [];

    try {
        const result = await window.api.invoke('get-mods-for-item', {
            itemClass,
            modType,
            itemLevel,
            baseItemName: document.getElementById('craftBaseItem')?.value || null
        });

        if (result.success) {
            return result.data;
        } else {
            console.error('Failed to get mods:', result.error);
            return [];
        }
    } catch (error) {
        console.error('Error fetching mods:', error);
        return [];
    }
}
```

### 3. Update Mod Display to Show Weights

**File**: `src/index.html`

Update the mod dropdown display (around line 1753) to show weights:

```javascript
// Current code shows:
modItem.innerHTML = `
    <div style="color: #ffd700;">${mod.name}</div>
    <div style="color: #888; font-size: 11px;">${mod.tier}, ilvl ${mod.ilvl}+</div>
`;

// Replace with:
modItem.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
            <div style="color: #ffd700;">${mod.name}</div>
            <div style="color: #888; font-size: 11px;">
                ilvl ${mod.requiredLevel || mod.ilvl || 0}+
                ${mod.tier ? '• ' + mod.tier : ''}
            </div>
        </div>
        <div style="text-align: right;">
            <div style="color: #4ade80; font-weight: bold; font-size: 13px;">
                ${formatModWeight(mod.weight)}
            </div>
            <div style="color: #888; font-size: 10px;">
                ${getChanceLabel(mod.weight)}
            </div>
        </div>
    </div>
`;

// Add helper functions before the function
function formatModWeight(weight) {
    if (!weight || weight === 0) return 'Blocked';
    if (weight >= 2000) return weight;
    if (weight >= 1000) return weight;
    return weight;
}

function getChanceLabel(weight) {
    if (!weight || weight === 0) return 'Cannot roll';
    if (weight >= 2000) return 'Very Common';
    if (weight >= 1000) return 'Common';
    if (weight >= 500) return 'Uncommon';
    if (weight >= 250) return 'Rare';
    if (weight >= 100) return 'Very Rare';
    return 'Extremely Rare';
}
```

### 4. Add Mod Blocking UI

**File**: `src/index.html`

Add after the "Desired Mods" section (after line 815):

```html
<!-- Mod Blocking Options -->
<div style="margin-bottom: 20px; background: rgba(138, 43, 226, 0.1); border-left: 4px solid #8a2be2; padding: 15px; border-radius: 5px;">
    <h3 style="color: #8a2be2; margin-bottom: 15px;">🚫 Mod Blocking Options (Advanced)</h3>
    <p style="color: #ccc; font-size: 13px; margin-bottom: 15px;">
        Block unwanted mods to increase chances of hitting desired mods. Costs extra currency!
    </p>

    <div style="margin-bottom: 15px;">
        <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="useFossilBlocking" style="width: 18px; height: 18px; margin-right: 10px;">
            <div>
                <span style="color: #ffd700; font-weight: bold;">Use Fossil Blocking</span>
                <p style="color: #aaa; font-size: 12px; margin: 5px 0 0 0;">
                    Fossils can block entire mod groups (e.g., Metallic blocks physical mods)
                </p>
            </div>
        </label>
    </div>

    <div style="margin-bottom: 15px;">
        <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="useMetacrafting" style="width: 18px; height: 18px; margin-right: 10px;">
            <div>
                <span style="color: #ffd700; font-weight: bold;">Use Metacrafting</span>
                <p style="color: #aaa; font-size: 12px; margin: 5px 0 0 0;">
                    Crafting bench options like "Prefixes Cannot Be Changed" (2 divine each)
                </p>
            </div>
        </label>
    </div>

    <div id="modBlockingOptions" style="display: none; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 5px; margin-top: 10px;">
        <label style="color: #ffd700; display: block; margin-bottom: 8px;">Select Mod Tags to Block:</label>
        <div id="blockableTagsList" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;">
            <!-- Dynamically populated -->
        </div>
    </div>
</div>
```

### 5. Add JavaScript for Mod Blocking

**File**: `src/index.html`

Add before the crafting form submit handler (around line 2228):

```javascript
// Mod blocking functionality
const useFossilBlocking = document.getElementById('useFossilBlocking');
const useMetacrafting = document.getElementById('useMetacrafting');
const modBlockingOptions = document.getElementById('modBlockingOptions');
const blockableTagsList = document.getElementById('blockableTagsList');

if (useFossilBlocking) {
    useFossilBlocking.addEventListener('change', function() {
        if (this.checked || useMetacrafting?.checked) {
            modBlockingOptions.style.display = 'block';
            updateBlockableTags();
        } else if (!useMetacrafting?.checked) {
            modBlockingOptions.style.display = 'none';
        }
    });
}

if (useMetacrafting) {
    useMetacrafting.addEventListener('change', function() {
        if (this.checked || useFossilBlocking?.checked) {
            modBlockingOptions.style.display = 'block';
            updateBlockableTags();
        } else if (!useFossilBlocking?.checked) {
            modBlockingOptions.style.display = 'none';
        }
    });
}

function updateBlockableTags() {
    const commonTags = [
        'physical', 'fire', 'cold', 'lightning', 'chaos',
        'attack', 'caster', 'life', 'mana', 'defense',
        'speed', 'critical', 'elemental'
    ];

    blockableTagsList.innerHTML = commonTags.map(tag => `
        <label style="display: flex; align-items: center; color: #ccc; cursor: pointer;">
            <input type="checkbox" class="block-tag" value="${tag}"
                   style="margin-right: 6px; width: 16px; height: 16px;">
            <span style="font-size: 13px;">${tag}</span>
        </label>
    `).join('');
}
```

### 6. Update Crafting Calculation to Include Blocking

**File**: `src/index.html`

Update the crafting form submit handler to include blocking options:

```javascript
// In the craftingForm submit handler, add after collecting desiredMods:
const modBlocking = {
    useFossilBlocking: document.getElementById('useFossilBlocking')?.checked || false,
    useMetacrafting: document.getElementById('useMetacrafting')?.checked || false,
    blockedTags: Array.from(document.querySelectorAll('.block-tag:checked'))
        .map(cb => cb.value)
};

// Add to craftingGoal:
const craftingGoal = {
    baseItem,
    itemLevel,
    itemClass,
    desiredMods,
    budget: 1000,
    league,
    riskMode,
    modBlocking  // Add this
};
```

## Testing Checklist

After implementing:

- [ ] Mods load from RePoE backend (not hardcoded)
- [ ] Mod weights display in dropdown
- [ ] Weight labels show (Common, Rare, etc.)
- [ ] ilvl requirements correct
- [ ] Mod blocking checkboxes appear
- [ ] Fossil blocking option works
- [ ] Metacrafting option works
- [ ] Blocked tags are sent to calculation
- [ ] Calculation accounts for blocking costs

## Benefits

✅ **Real Data**: Uses actual PoE mod weights from RePoE
✅ **Informed Choices**: Users see which mods are rare vs common
✅ **Advanced Strategies**: Fossil blocking and metacrafting options
✅ **Better Estimates**: Calculations account for blocked mods
✅ **Future-Proof**: Auto-updates when RePoE data updates
