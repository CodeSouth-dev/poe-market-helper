# Enhanced Craft of Exiles Simulator Integration

## Overview

The enhanced Craft of Exiles integration provides **COMPLETE CRAFTING STRATEGIES** - not just probabilities, but actual step-by-step crafting practices you can follow.

### Key Features

✅ **Complete Step-by-Step Strategies** - Get actionable crafting steps, not just "use chaos orbs"
✅ **Mod Blocking with Fossils** - Automatically recommend fossil combinations to block unwanted mods
✅ **Bench Crafting Integration** - Know exactly when to use crafting bench
✅ **Budget Optimization** - Find what mods are achievable within your budget
✅ **Currency Breakdown** - See exactly how much of each currency you'll need
✅ **Intelligent Caching** - Strategies cached for 7 days for instant lookup

---

## Basic Usage

### 1. Get Complete Crafting Strategy

```typescript
import { craftOfExileSimulatorEnhanced } from './craftOfExileSimulatorEnhanced';

// Define what you want to craft
const strategy = await craftOfExileSimulatorEnhanced.getCraftingStrategy(
  'Vaal Regalia',           // Base item
  86,                       // Item level
  [                         // Desired mods
    '+2 to Level of Socketed Gems',
    'Increased Energy Shield',
    'Maximum Life'
  ],
  [],                       // Blocked mods (optional)
  {
    budget: 150,           // Budget in chaos
    allowMetacrafting: false
  }
);

// Returns complete strategy with steps
console.log(strategy);
```

**Output:**
```typescript
{
  baseItem: 'Vaal Regalia',
  itemLevel: 86,
  desiredMods: ['+2 to Level of Socketed Gems', ...],
  method: 'Fossil Crafting',
  methodType: 'fossil',

  // Step-by-step crafting plan
  steps: [
    {
      stepNumber: 1,
      action: 'Acquire Vaal Regalia base',
      actionType: 'check',
      details: 'Purchase a Vaal Regalia with item level 86+...',
      cost: 1
    },
    {
      stepNumber: 2,
      action: 'Prepare clean base',
      actionType: 'currency',
      details: 'Use Orb of Scouring to make it white...',
      cost: 1
    },
    {
      stepNumber: 3,
      action: 'Acquire fossils: Pristine Fossil, Dense Fossil',
      actionType: 'fossil',
      details: 'These fossils weight life and ES mods...',
      cost: 10
    },
    // ... more steps
  ],

  // Economics
  averageCost: 145,
  averageAttempts: 29,
  successRate: 0.034,

  // Currency breakdown
  currencyBreakdown: [
    {
      currency: 'Fossils + Resonators',
      amount: 29,
      costPerUnit: 5,
      totalCost: 145
    }
  ],

  difficulty: 'intermediate',
  estimatedTime: '15-30 minutes',
  warnings: ['⚠️ Low success rate - prepare for many attempts'],
  tips: [
    '💡 Recommended fossils: Pristine Fossil, Dense Fossil',
    '💡 Fossils block certain mod tags, increasing your chance...'
  ]
}
```

---

### 2. Optimize for Budget

Find what mods are achievable within your budget:

```typescript
const optimization = await craftOfExileSimulatorEnhanced.optimizeForBudget(
  'Steel Ring',
  84,
  [
    '+100 to maximum Life',
    '+120% Total Elemental Resistances',
    '+50% Physical Damage',
    'Increased Attack Speed'
  ],
  100  // Budget: 100 chaos
);

console.log(optimization);
```

**Output:**
```typescript
{
  budget: 100,

  // What you CAN get
  achievableMods: [
    '+100 to maximum Life',
    '+120% Total Elemental Resistances'
  ],

  // What's too expensive
  unreachableMods: [
    '+50% Physical Damage',
    'Increased Attack Speed'
  ],

  // Best strategy for achievable mods
  recommendedStrategy: { ... },

  // Alternative approaches
  alternatives: [ ... ]
}
```

---

### 3. Get Fossil Recommendations (Mod Blocking)

Find which fossils to use to block unwanted mods:

```typescript
const fossilCombos = await craftOfExileSimulatorEnhanced.getFossilCombinations(
  ['+2 to Level of Socketed Gems', 'Increased Spell Damage'],
  ['physical', 'attack']  // Block physical and attack mods
);

console.log(fossilCombos);
```

**Output:**
```typescript
[
  {
    fossils: ['Metallic Fossil'],
    blockedTags: ['physical'],
    guaranteedTags: ['lightning'],
    resonatorType: 'Primitive Chaotic Resonator',
    costPerAttempt: 5,
    increaseChanceFor: ['Increased Spell Damage']
  },
  // ... more combinations
]
```

---

## Advanced Usage

### Complete Crafting Workflow

Use the `SmartCraftingOptimizer` for a complete workflow:

```typescript
import { smartCraftingOptimizer } from './smartCraftingOptimizer';

const goal = {
  baseItem: 'Hubris Circlet',
  itemLevel: 86,
  itemClass: 'Helmet',
  desiredMods: [
    '+2 to Level of Socketed Gems',
    'Increased Energy Shield',
    'Maximum Life',
    'Cold Resistance'
  ],
  budget: 200,
  league: 'Standard',
  riskMode: false
};

// Get complete plan with budget optimization and fossil recommendations
const plan = await smartCraftingOptimizer.getCompleteCraftingPlan(goal);

console.log(plan);
```

**Output:**
```typescript
{
  // Full crafting strategy with step-by-step instructions
  strategy: {
    steps: [ ... ],
    averageCost: 185,
    successRate: 0.028,
    currencyBreakdown: [ ... ]
  },

  // Budget analysis
  budgetOptimization: {
    achievableMods: [...],
    unreachableMods: []
  },

  // Fossil recommendations (if using fossil method)
  fossilRecommendations: [
    { fossils: ['Dense Fossil', 'Pristine Fossil'], ... }
  ],

  // Aggregated warnings and tips
  warnings: [
    '⚠️ Low success rate - prepare for many attempts',
    '⚠️ Moderate cost - budget accordingly'
  ],

  tips: [
    '💡 Recommended fossils: Dense Fossil, Pristine Fossil',
    '💡 Check trade sites for similar items - buying might be cheaper'
  ]
}
```

---

## Integration with Main Process (IPC Handlers)

Add these IPC handlers to `main.ts`:

```typescript
import { craftOfExileSimulatorEnhanced } from './craftOfExileSimulatorEnhanced';
import { smartCraftingOptimizer } from './smartCraftingOptimizer';

// Get complete crafting strategy
ipcMain.handle('craft-get-strategy', async (event, baseItem, itemLevel, desiredMods, blockedMods, options) => {
  try {
    const strategy = await craftOfExileSimulatorEnhanced.getCraftingStrategy(
      baseItem,
      itemLevel,
      desiredMods,
      blockedMods || [],
      options || {}
    );

    return { success: true, data: strategy };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Optimize for budget
ipcMain.handle('craft-optimize-budget', async (event, baseItem, itemLevel, desiredMods, budget) => {
  try {
    const optimization = await craftOfExileSimulatorEnhanced.optimizeForBudget(
      baseItem,
      itemLevel,
      desiredMods,
      budget
    );

    return { success: true, data: optimization };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Get fossil recommendations
ipcMain.handle('craft-get-fossils', async (event, desiredMods, blockedTags) => {
  try {
    const fossils = await craftOfExileSimulatorEnhanced.getFossilCombinations(
      desiredMods,
      blockedTags
    );

    return { success: true, data: fossils };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Complete crafting plan
ipcMain.handle('craft-get-complete-plan', async (event, goal) => {
  try {
    const plan = await smartCraftingOptimizer.getCompleteCraftingPlan(goal);

    return { success: true, data: plan };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Clear strategy cache
ipcMain.handle('craft-clear-strategy-cache', async () => {
  try {
    await craftOfExileSimulatorEnhanced.clearCache();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
```

---

## Frontend Usage (Renderer Process)

```typescript
const { ipcRenderer } = require('electron');

// Example: Get crafting strategy
async function getCraftingStrategy() {
  const result = await ipcRenderer.invoke(
    'craft-get-strategy',
    'Vaal Regalia',
    86,
    ['+2 to Level of Socketed Gems', 'Increased Energy Shield'],
    [], // No blocked mods
    { budget: 150 }
  );

  if (result.success) {
    const strategy = result.data;

    // Display step-by-step instructions
    strategy.steps.forEach(step => {
      console.log(`Step ${step.stepNumber}: ${step.action}`);
      console.log(`  ${step.details}`);
      if (step.cost) {
        console.log(`  Cost: ${step.cost}c`);
      }
    });

    console.log(`\n💰 Total Average Cost: ${strategy.averageCost}c`);
    console.log(`📊 Success Rate: ${(strategy.successRate * 100).toFixed(2)}%`);
    console.log(`⏱️ Estimated Time: ${strategy.estimatedTime}`);
  }
}

// Example: Optimize for budget
async function optimizeForBudget() {
  const result = await ipcRenderer.invoke(
    'craft-optimize-budget',
    'Steel Ring',
    84,
    ['+100 Life', '+120% Resistances', 'Physical Damage'],
    100  // 100 chaos budget
  );

  if (result.success) {
    const opt = result.data;

    if (opt.unreachableMods.length > 0) {
      console.log('⚠️ These mods are too expensive for your budget:');
      opt.unreachableMods.forEach(mod => console.log(`  - ${mod}`));

      console.log('\n✅ You can achieve:');
      opt.achievableMods.forEach(mod => console.log(`  - ${mod}`));
    } else {
      console.log('✅ All mods are achievable within budget!');
    }
  }
}

// Example: Get complete plan
async function getCompletePlan() {
  const goal = {
    baseItem: 'Hubris Circlet',
    itemLevel: 86,
    itemClass: 'Helmet',
    desiredMods: ['+2 to Socketed Gems', 'ES', 'Life'],
    budget: 200,
    league: 'Standard'
  };

  const result = await ipcRenderer.invoke('craft-get-complete-plan', goal);

  if (result.success) {
    const plan = result.data;

    console.log('📋 Complete Crafting Plan\n');

    // Show strategy
    console.log(`Method: ${plan.strategy.method}`);
    console.log(`Difficulty: ${plan.strategy.difficulty}`);
    console.log(`Cost: ${plan.strategy.averageCost}c\n`);

    // Show steps
    console.log('Steps:');
    plan.strategy.steps.forEach(step => {
      console.log(`  ${step.stepNumber}. ${step.action}`);
    });

    // Show warnings
    if (plan.warnings.length > 0) {
      console.log('\nWarnings:');
      plan.warnings.forEach(w => console.log(`  ${w}`));
    }

    // Show tips
    if (plan.tips.length > 0) {
      console.log('\nTips:');
      plan.tips.forEach(t => console.log(`  ${t}`));
    }
  }
}
```

---

## UI Integration Example

```html
<div class="crafting-strategy-container">
  <h2>Crafting Strategy</h2>

  <!-- Input form -->
  <div class="form-group">
    <label>Base Item:</label>
    <input type="text" id="baseItem" placeholder="Vaal Regalia" />
  </div>

  <div class="form-group">
    <label>Item Level:</label>
    <input type="number" id="itemLevel" value="86" />
  </div>

  <div class="form-group">
    <label>Desired Mods:</label>
    <textarea id="desiredMods" placeholder="One mod per line"></textarea>
  </div>

  <div class="form-group">
    <label>Budget (chaos):</label>
    <input type="number" id="budget" value="150" />
  </div>

  <button onclick="getStrategy()">Get Strategy</button>

  <!-- Results display -->
  <div id="results" style="margin-top: 20px;"></div>
</div>

<script>
async function getStrategy() {
  const baseItem = document.getElementById('baseItem').value;
  const itemLevel = parseInt(document.getElementById('itemLevel').value);
  const desiredMods = document.getElementById('desiredMods').value.split('\n').filter(m => m.trim());
  const budget = parseInt(document.getElementById('budget').value);

  const goal = {
    baseItem,
    itemLevel,
    itemClass: 'Body Armour', // Determine from baseItem
    desiredMods,
    budget,
    league: 'Standard'
  };

  const result = await ipcRenderer.invoke('craft-get-complete-plan', goal);

  if (result.success) {
    displayStrategy(result.data);
  } else {
    alert('Error: ' + result.error);
  }
}

function displayStrategy(plan) {
  const resultsDiv = document.getElementById('results');

  let html = `
    <div class="strategy-card">
      <h3>${plan.strategy.method}</h3>
      <div class="stats">
        <span>💰 ${plan.strategy.averageCost}c</span>
        <span>📊 ${(plan.strategy.successRate * 100).toFixed(2)}%</span>
        <span>⏱️ ${plan.strategy.estimatedTime}</span>
        <span>🎯 ${plan.strategy.difficulty}</span>
      </div>

      <h4>Step-by-Step Instructions:</h4>
      <ol class="steps-list">
        ${plan.strategy.steps.map(step => `
          <li>
            <strong>${step.action}</strong>
            <p>${step.details}</p>
            ${step.cost ? `<span class="cost">${step.cost}c</span>` : ''}
          </li>
        `).join('')}
      </ol>

      ${plan.warnings.length > 0 ? `
        <div class="warnings">
          <h4>Warnings:</h4>
          <ul>${plan.warnings.map(w => `<li>${w}</li>`).join('')}</ul>
        </div>
      ` : ''}

      ${plan.tips.length > 0 ? `
        <div class="tips">
          <h4>Tips:</h4>
          <ul>${plan.tips.map(t => `<li>${t}</li>`).join('')}</ul>
        </div>
      ` : ''}
    </div>
  `;

  resultsDiv.innerHTML = html;
}
</script>
```

---

## Key Differences from Old Integration

| Feature | Old Integration | Enhanced Integration |
|---------|----------------|---------------------|
| **Output** | Just probabilities | Complete step-by-step strategies |
| **Mod Blocking** | ❌ Not supported | ✅ Fossil-based mod blocking |
| **Bench Crafting** | ❌ Not included | ✅ Knows when to use bench |
| **Budget Optimization** | ❌ Basic cost only | ✅ Shows what's achievable |
| **Currency Breakdown** | ❌ Total only | ✅ Detailed breakdown |
| **Caching** | 24 hours | 7 days (strategies change less) |
| **Actionable** | Low | High - can follow steps directly |

---

## Performance & Caching

- **First request**: 5-10 seconds (interacts with Craft of Exiles)
- **Cached requests**: < 1ms (instant)
- **Cache duration**: 7 days
- **Cache location**: `data/craftofexile-strategies/`

---

## Best Practices

1. **Always check budget optimization first** - Know what's achievable
2. **Use fossil recommendations** - Greatly improve success rates
3. **Follow steps in order** - They're optimized for efficiency
4. **Check trade before crafting** - Buying might be cheaper
5. **Cache clearing** - Only clear when game patches change crafting mechanics

---

## Troubleshooting

**Issue**: Strategy generation fails
**Solution**: The simulator might have UI changes. Fallback logic will provide estimated strategy.

**Issue**: Budget optimization says everything is unreachable
**Solution**: Your budget might be too low. Try increasing it or targeting fewer mods.

**Issue**: Fossil recommendations are empty
**Solution**: Not all mod combinations benefit from fossil blocking. Consider other methods.

---

## Summary

The enhanced Craft of Exiles integration transforms the tool from a **probability calculator** into a **complete crafting assistant** that gives you actionable, step-by-step instructions including:

✅ Exact fossils to use
✅ When to use bench crafts
✅ Mod blocking strategies
✅ Budget-optimized outcomes
✅ Currency breakdowns

**Result**: You get PRACTICES, not just information! 🎯
