# Crafting Prediction Feature

## Overview

The PoE Market Helper now includes a comprehensive crafting prediction system that helps players determine the most cost-effective way to craft items with desired modifiers.

## Features

### 1. **Multiple Crafting Method Support**
The system analyzes and compares different crafting approaches:
- **Chaos Spam**: Random rerolling with Chaos Orbs
- **Fossil Crafting**: Using fossils in resonators to influence mod pools
- **Essence Crafting**: Guaranteeing specific mods with essences
- **Alteration Spam**: Rolling magic items for 1-2 specific mods

### 2. **Cost Calculation**
- Real-time pricing from poe.ninja for all currency types
- Automatic conversion between Chaos and Divine Orbs
- Expected number of attempts calculated from probabilities
- Total cost estimation including base item purchase

### 3. **Base Item Recommendations**
The system recommends whether to purchase:
- **Normal (White) Base**: Cheapest starting point
- **Rare Base**: Pre-existing mods to build upon
- **Fractured Base**: Guaranteed locked mod
- **Influenced Base**: For special influenced mods

### 4. **Data Sources**

#### RePoE Repository
- Comprehensive game data extracted from Path of Exile files
- Includes mods, fossils, essences, base items, and crafting bench options
- Location: `data/RePoE/RePoE/data/`
- Files used:
  - `mods.json` - All possible item modifiers
  - `fossils.json` - Fossil effects and weights
  - `essences.json` - Essence mod guarantees
  - `base_items.json` - Base item types and tags
  - `crafting_bench_options.json` - Master craft options

#### poe.ninja API
- Live economy data for currency pricing
- Market availability and listing counts
- Updated prices ensure accurate cost predictions

## Architecture

### Backend (TypeScript/Electron)

```
src/
├── types/
│   └── crafting.ts          # TypeScript interfaces for crafting data
├── api/
│   ├── craftingData.ts      # RePoE data loader
│   ├── craftingCalculator.ts # Core calculation engine
│   └── poeNinja.ts          # Enhanced for currency pricing
└── main.ts                  # IPC handlers for crafting operations
```

### Frontend (HTML/JavaScript)

- Tab-based UI for switching between Market Search and Crafting Prediction
- Dynamic form for adding desired mods
- Rich display of crafting recommendations with:
  - Color-coded method cards
  - Step-by-step instructions
  - Currency requirements
  - Success probabilities

## Usage

### 1. Navigate to Crafting Tab
Click the "Crafting Prediction" tab in the main interface.

### 2. Input Desired Item
- **Base Item**: Enter the name (e.g., "Vaal Regalia", "Steel Ring")
- **Item Class**: Select from dropdown
- **League**: Choose active league

### 3. Add Desired Mods
- Click "+ Add Mod" to add each desired modifier
- Enter the mod name (e.g., "increased Energy Shield", "Life")
- Select Prefix or Suffix
- Add multiple mods as needed

### 4. Calculate
Click "Calculate Best Crafting Method" to see:
- ⭐ **Recommended method** (lowest cost)
- Alternative methods with comparison
- Total estimated cost
- Base item recommendations
- Step-by-step crafting guide

## Example Output

```
💎 Recommended Base
Type: NORMAL
Item: Vaal Regalia
Cost: 5 Chaos
Reason: Cheapest option, requires full crafting process

⭐ RECOMMENDED
Essence Crafting (Shrieking Essence of Woe)
250.5 Chaos

Description: Use Shrieking Essence of Woe to guarantee increased Energy Shield

Success Rate: 15.50%
Avg. Attempts: 7

Currency Needed:
- 7x Shrieking Essence of Woe

Steps:
1. Obtain a Vaal Regalia
2. Use Shrieking Essence of Woe to guarantee increased Energy Shield
3. Repeat until other desired mods are also hit
4. Expected attempts: 7
```

## Technical Details

### Probability Calculation

The system calculates probabilities by:
1. Loading all possible mods for the item class
2. Filtering by tags (armor, weapon, attack, etc.)
3. Applying fossil/essence weight modifiers
4. Computing combinatorial probabilities for hitting desired mods
5. Calculating expected attempts: `1 / probability`

### Fossil Optimization

For fossil crafting:
1. Identifies relevant fossils based on item tags
2. Computes weight modifications (positive/negative)
3. Simulates mod pool changes
4. Finds optimal fossil combinations
5. Calculates resonator requirements (1-4 sockets)

### Cost Optimization

The system:
1. Fetches current currency prices from poe.ninja
2. Calculates expected cost per method
3. Sorts methods by total cost (including base)
4. Recommends the cheapest viable option
5. Displays costs in Chaos or Divine based on amount

## IPC Communication

### Handlers

```typescript
// Initialize crafting data
ipcRenderer.invoke('initialize-crafting', league)

// Calculate crafting methods
ipcRenderer.invoke('calculate-crafting', {
  desiredMods: [
    { name: 'increased Energy Shield', type: 'prefix' },
    { name: 'maximum Life', type: 'prefix' }
  ],
  baseItemName: 'Vaal Regalia',
  itemClass: 'Body Armour',
  league: 'Crucible'
})

// Search for mods
ipcRenderer.invoke('search-mods', query, itemClass?)

// Search for base items
ipcRenderer.invoke('search-base-items', query)
```

## Future Enhancements

### Planned Features
- [ ] PoEDB API integration for real-time mod data
- [ ] Harvest crafting support
- [ ] Veiled mod analysis
- [ ] Multi-step crafting paths (e.g., alt-aug-regal)
- [ ] Influenced mod support (Shaper, Elder, Conqueror)
- [ ] Fractured base recommendations
- [ ] Historical crafting cost tracking
- [ ] Export crafting plans
- [ ] Integration with Path of Building

### Potential Improvements
- Monte Carlo simulation for complex crafting chains
- Machine learning for price prediction
- Community-sourced crafting recipes
- Trade API integration for base item availability

## Dependencies

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "fs-extra": "^11.1.0"
  },
  "devDependencies": {
    "@types/fs-extra": "^11.0.4",
    "@types/node": "^20.0.0",
    "electron": "^27.0.0",
    "typescript": "^5.2.0"
  }
}
```

## Installation

```bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run the application
npm start
```

## Data Updates

The RePoE data is version-controlled in `data/RePoE/`. To update:

```bash
cd data
git pull origin master  # Update RePoE data
cd ..
npm run build          # Rebuild if needed
```

## Contributing

When adding new crafting methods:

1. Add types to `src/types/crafting.ts`
2. Implement calculation in `src/api/craftingCalculator.ts`
3. Add UI components in `src/index.html`
4. Update this documentation

## License

MIT License - See LICENSE file for details
