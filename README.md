# Path of Exile Market Helper

A standalone desktop application for live Path of Exile market data and crafting assistance.

## Features

### Market Analysis
✅ **Live Market Search**: Real-time price data from poe.ninja
✅ **Multiple Leagues**: Support for all current PoE leagues
✅ **Favorites System**: Save and quickly recheck items
✅ **Price Statistics**: Min, max, median prices with listing counts
✅ **Caching**: Reduces API calls with intelligent caching

### Crafting Tools
🎓 **Advanced Crafting Chain Builder**: Educational step-by-step crafting guides
- **Item Level (ilvl) Support**: Track ilvl requirements for mod tiers (T1-T5)
- **8 Crafting Strategies**: From beginner to expert level
- **Probability Calculations**: Success rates and expected attempts
- **Cost Analysis**: Real-time material cost calculation per step
- **Educational Explanations**: Learn what each step does and why

⚔️ **Advanced Tactics Library**:
- Mod Blocking strategies
- Metacrafting techniques (Cannot Roll Attack/Caster)
- Imprint Alt-Spam methods
- Awakener's Orb combinations
- Fracture Fossil strategies

📚 **Crafting Education System**:
- Item level and mod tier concepts
- Mod weighting and probabilities
- Prefix vs Suffix explained
- Blocking mods techniques
- Multi-step crafting chains

💰 **Simple Profitability Calculator**: Quick craft vs buy comparison

✅ **Professional UI**: Clean, game-themed interface with collapsible tips

## Quick Start

### Prerequisites
- Node.js 16+ (Download from [nodejs.org](https://nodejs.org))
- Internet connection for poe.ninja API

### Installation & Running

1. **Extract/Download** this project folder
2. **Open Terminal/Command Prompt** in the project directory
3. **Run setup**:
   ```bash
   # On Windows
   npm install && npm run dev
   
   # On Mac/Linux
   ./setup.sh
   ```

### Alternative Manual Setup
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start the application
npm start
```

## Usage

### Market Search
1. **Search Items**: Type any PoE item name (e.g., "Tabula Rasa", "Divine Orb")
2. **Select League**: Choose your current league
3. **View Results**: See real-time prices, statistics, and listings
4. **Add Favorites**: Save frequently checked items
5. **Refresh**: Update prices with one click

### Advanced Crafting Chain Builder
1. **Enter Base Item**: The item you want to craft (e.g., "Vaal Regalia", "Stygian Vise")
2. **Select Item Level (ilvl)**: Choose from 50, 64, 73, 81, or 86
   - ilvl 86 = Can roll T1 mods (highest tier)
   - ilvl 81 = Can roll T2 mods
   - ilvl 73 = Can roll T3 mods
   - Lower ilvls = Lower tier mods available
3. **Choose Crafting Strategy**:
   - **Beginner**: Alt-Regal-Multimod, Essence Spam, Fossil Spam
   - **Intermediate**: Alt-Regal-Annul, Harvest Reforge
   - **Advanced**: Alt-Recombinator, Eldritch Crafting
   - **Expert**: Metacraft-Exalt
4. **Build Chain**: See step-by-step instructions with:
   - Material requirements per step
   - Expected attempts and success rates
   - Cost breakdown
   - Educational tips and explanations
5. **Learn Advanced Tactics**: Click "Show Advanced Tactics" for:
   - Mod blocking techniques
   - Metacrafting strategies
   - Cost-effective crafting methods
6. **Study Crafting Guide**: Click "Crafting Guide" to learn:
   - How ilvl affects available mods
   - Mod weighting and probabilities
   - Prefix vs Suffix mechanics
   - Multi-step crafting processes

### Simple Profitability Calculator
1. **Enter Target Item**: The finished item you want to craft
2. **Enter Base Item**: The base item needed
3. **Add Crafting Methods**: Click "Add Crafting Method"
4. **Calculate**: See which method is cheapest and if it's profitable vs buying

### Example Searches
- `Tabula Rasa` - Popular leveling unique
- `Divine Orb` - Currency item
- `Shaper's Touch` - Unique gloves
- `The Baron` - Unique helmet
- `Belly of the Beast` - Unique chest

## Project Structure

```
poe-market-helper/
├── src/
│   ├── main.ts                    # Electron main process & IPC handlers
│   ├── index.html                 # UI interface (search + crafting calculator)
│   ├── api/
│   │   └── poeNinja.ts            # poe.ninja API wrapper
│   ├── types/
│   │   └── crafting.ts            # Crafting data structures & types
│   └── utils/
│       ├── cache.ts               # Caching system
│       ├── favorites.ts           # Favorites management
│       └── craftingCalculator.ts  # Crafting profitability engine
├── data/                          # Runtime data storage
├── package.json                   # Dependencies
└── tsconfig.json                  # TypeScript config
```

## How It Works

1. **User Input**: Enter item name and select league
2. **API Search**: Queries poe.ninja across multiple item categories
3. **Data Processing**: Filters results and calculates statistics
4. **Caching**: Stores results for 5 minutes to reduce API calls
5. **Display**: Shows formatted results in an easy-to-read table

## Troubleshooting

### "npm not found"
- Install Node.js from nodejs.org
- Restart your terminal

### "Module not found" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### "Port already in use"
- Close any other Electron apps
- Restart your computer if needed

### No search results
- Check spelling of item name
- Try searching for base type (e.g., "Gloves" instead of specific unique)
- Verify league selection

## Development

Built with:
- **Electron** - Desktop app framework
- **TypeScript** - Type-safe JavaScript
- **poe.ninja API** - Live market data
- **HTML/CSS/JS** - User interface

## Extending the App

### Add New Features
1. Edit `src/index.html` for UI changes
2. Modify `src/api/poeNinja.ts` for API enhancements
3. Update `src/main.ts` for new IPC handlers

### Future Enhancements
- [ ] Craft of Exile integration
- [ ] Price history graphs
- [x] Profit calculations (Crafting Profitability Calculator)
- [ ] Auto-refresh timers
- [ ] Export/import favorites
- [ ] Multiple language support
- [ ] Save crafting recipes for later use
- [ ] Bulk crafting profitability analysis

## License

MIT License - Feel free to modify and distribute!

---

**Need Help?** Check the console (F12) for error messages, or modify the code to fit your needs!
