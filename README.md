# Path of Exile Market Helper

A standalone desktop application for live Path of Exile market data and crafting assistance.

## Features

✅ **Live Market Search**: Real-time price data from poe.ninja
✅ **Multiple Leagues**: Support for all current PoE leagues
✅ **Favorites System**: Save and quickly recheck items
✅ **Price Statistics**: Min, max, median prices with listing counts
✅ **Caching**: Reduces API calls with intelligent caching
✅ **Professional UI**: Clean, game-themed interface

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

1. **Search Items**: Type any PoE item name (e.g., "Tabula Rasa", "Divine Orb")
2. **Select League**: Choose your current league
3. **View Results**: See real-time prices, statistics, and listings
4. **Add Favorites**: Save frequently checked items
5. **Refresh**: Update prices with one click

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
│   ├── main.ts           # Electron main process
│   ├── index.html        # UI interface
│   ├── api/
│   │   └── poeNinja.ts   # API wrapper
│   └── utils/
│       ├── cache.ts      # Caching system
│       └── favorites.ts  # Favorites management
├── data/                 # Runtime data storage
├── package.json          # Dependencies
└── tsconfig.json         # TypeScript config
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
- [ ] Profit calculations
- [ ] Auto-refresh timers
- [ ] Export/import favorites
- [ ] Multiple language support

## License

MIT License - Feel free to modify and distribute!

---

**Need Help?** Check the console (F12) for error messages, or modify the code to fit your needs!
