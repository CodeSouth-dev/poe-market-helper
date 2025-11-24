# Path of Exile Market Helper

A powerful desktop application for live Path of Exile market data and advanced crafting assistance, featuring a **hybrid Electron + Python architecture** for maximum capabilities.

## Architecture

This application uses a **dual-server architecture**:

- **Frontend**: Electron desktop app with beautiful UI (TypeScript/HTML/CSS)
- **Backend**: Python FastAPI server with headless browser capabilities (Playwright)

**Why Python Backend?**
- ✅ **Headless Browser**: Scrape JavaScript-rendered sites (poe.ninja/builds, React apps)
- ✅ **Comprehensive Mod Database**: Access to 1000+ mods from poedb.tw
- ✅ **Advanced Scraping**: Better tools for web scraping (BeautifulSoup, Playwright)
- ✅ **Future Features**: OCR, game automation, map crafting, and more

See [`backend/README.md`](backend/README.md) for detailed backend documentation.

## Features

### Market Analysis
✅ **Live Market Search**: Real-time price data from poe.ninja
✅ **Multiple Leagues**: Support for all current PoE leagues
✅ **Favorites System**: Save and quickly recheck items
✅ **Price Statistics**: Min, max, median prices with listing counts
✅ **Caching**: Reduces API calls with intelligent caching

### Crafting Prediction ⚡ NEW
✅ **Best Method Calculator**: Find the cheapest way to craft desired mods
✅ **Cost Analysis**: Real-time pricing for Chaos, Fossil, Essence, and Alteration methods
✅ **Success Probabilities**: Expected attempts and costs based on mod weights
✅ **Base Recommendations**: Determine whether to buy white, rare, fractured, or influenced bases
✅ **RePoE Integration**: Comprehensive game data for accurate calculations
✅ **Multiple Methods**: Compare Chaos spam, Fossils, Essences, Alterations, Harvest, Recombinators, and more
✅ **Comprehensive Mod Database**: 1000+ mods from poedb.tw via Python backend
✅ **Build-Based Crafting**: Analyze popular builds to find profitable crafting targets
✅ **Web Search Fallback**: 🆕 Automatically searches Reddit, forums, and community guides when other sources fail

### UI/UX
✅ **Professional UI**: Clean, game-themed interface with tab-based navigation
✅ **Rich Visualizations**: Color-coded method cards with step-by-step guides

## Quick Start

### Prerequisites
- **Node.js 16+** (Download from [nodejs.org](https://nodejs.org))
- **Python 3.10+** (Download from [python.org](https://python.org))
- Internet connection for poe.ninja API

### Installation

#### 1. Setup Frontend (Electron)

```bash
# Install Node.js dependencies
npm install

# Build TypeScript
npm run build
```

#### 2. Setup Backend (Python)

```bash
# Navigate to backend directory
cd backend

# Run setup script (Linux/Mac)
./setup.sh

# Or manually:
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

### Running the Application

You need to run **BOTH** servers:

#### Terminal 1: Start Python Backend
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python main.py

# Or use the start script (Linux/Mac):
./start.sh
```

Backend will be available at: `http://localhost:8000`

#### Terminal 2: Start Electron Frontend
```bash
# From project root
npm start
```

**Note**: The Python backend enables advanced features like build scraping and comprehensive mod database. You can run the frontend without it, but some features will be limited.

See [`backend/INTEGRATION.md`](backend/INTEGRATION.md) for detailed integration instructions.

## Usage

### Market Search Tab
1. **Search Items**: Type any PoE item name (e.g., "Tabula Rasa", "Divine Orb")
2. **Select League**: Choose your current league
3. **View Results**: See real-time prices, statistics, and listings
4. **Add Favorites**: Save frequently checked items
5. **Refresh**: Update prices with one click

#### Example Searches
- `Tabula Rasa` - Popular leveling unique
- `Divine Orb` - Currency item
- `Shaper's Touch` - Unique gloves
- `The Baron` - Unique helmet
- `Belly of the Beast` - Unique chest

### Crafting Prediction Tab ⚡ NEW
1. **Enter Base Item**: Type the base item name (e.g., "Vaal Regalia", "Steel Ring")
2. **Select Item Class**: Choose from dropdown (Body Armour, Ring, etc.)
3. **Add Desired Mods**: Click "+ Add Mod" and enter:
   - Mod name (e.g., "increased Energy Shield", "maximum Life")
   - Type (Prefix or Suffix)
4. **Calculate**: Click "Calculate Best Crafting Method"
5. **Review Results**: See recommended method, costs, probabilities, and steps

#### Example Crafting Scenarios
- **ES Chest**: Vaal Regalia with +% ES and flat ES
- **Life Ring**: Steel Ring with +maximum Life and +all Resistances
- **Caster Weapon**: Wand with +Spell Damage and +Cast Speed

See [CRAFTING_FEATURE.md](CRAFTING_FEATURE.md) for detailed documentation.

## Project Structure

```
poe-market-helper/
├── src/                    # Frontend (Electron)
│   ├── main.ts             # Electron main process
│   ├── index.html          # UI interface
│   ├── api/
│   │   └── poeNinja.ts     # poe.ninja API wrapper
│   └── utils/
│       ├── cache.ts        # Caching system
│       └── favorites.ts    # Favorites management
│
├── backend/                # Backend (Python)
│   ├── main.py             # FastAPI server
│   ├── scrapers/           # Web scrapers
│   │   ├── poe_ninja.py    # Build scraper (Playwright)
│   │   └── poedb_scraper.py # Mod database scraper
│   ├── database/           # Database models
│   │   ├── models.py       # SQLAlchemy models
│   │   └── mod_db.py       # Mod database handler
│   ├── api/                # API endpoints
│   │   ├── builds.py       # Build analysis
│   │   ├── crafting.py     # Crafting calculations
│   │   └── market.py       # Market insights
│   └── README.md           # Backend documentation
│
├── data/                   # Runtime data storage
│   └── poe_mods.db         # SQLite mod database
├── package.json            # Node.js dependencies
└── tsconfig.json           # TypeScript config
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

### Frontend Stack
- **Electron** - Desktop app framework
- **TypeScript** - Type-safe JavaScript
- **HTML/CSS/JS** - User interface

### Backend Stack
- **Python 3.10+** - Backend language
- **FastAPI** - Web framework
- **Playwright** - Headless browser for scraping
- **SQLAlchemy** - Database ORM
- **BeautifulSoup** - HTML parsing
- **SQLite** - Local database

### APIs & Data Sources
- **poe.ninja API** - Live market data and builds
- **poedb.tw** - Comprehensive mod database (scraped)
- **RePoE** - Game data integration

## Extending the App

### Add New Features
1. Edit `src/index.html` for UI changes
2. Modify `src/api/poeNinja.ts` for API enhancements
3. Update `src/main.ts` for new IPC handlers

### Future Enhancements

**Market Features:**
- [ ] Price history graphs
- [ ] Profit calculations
- [ ] Auto-refresh timers
- [ ] Export/import favorites
- [ ] Multiple language support

**Crafting Features:**
- [ ] PoEDB API integration for real-time mod data
- [ ] Harvest crafting support
- [ ] Influenced mod crafting (Shaper, Elder, Conqueror)
- [ ] Veiled mod analysis
- [ ] Trade API integration for base availability
- [ ] Path of Building integration
- [ ] Multi-step crafting paths (alt-aug-regal chains)

## License

MIT License - Feel free to modify and distribute!

---

**Need Help?** Check the console (F12) for error messages, or modify the code to fit your needs!
