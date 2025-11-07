# PoE Market Helper - Python Backend

This is the Python backend for PoE Market Helper, providing headless browser capabilities, comprehensive mod database scraping, and advanced market analysis.

## Features

- **Headless Browser Scraping**: Uses Playwright to scrape JavaScript-rendered sites like poe.ninja
- **Comprehensive Mod Database**: Scrapes 1000+ mods from poedb.tw with full details
- **Market Analysis**: Advanced market data processing and crafting strategy calculations
- **REST API**: FastAPI server that the Electron frontend connects to
- **SQLite Database**: Local storage for mods, builds, and market data

## Architecture

```
backend/
├── main.py                 # FastAPI server entry point
├── requirements.txt        # Python dependencies
│
├── scrapers/              # Web scrapers
│   ├── poe_ninja.py       # poe.ninja scraper (Playwright)
│   └── poedb_scraper.py   # poedb.tw mod database scraper
│
├── database/              # Database models and handlers
│   ├── models.py          # SQLAlchemy models
│   └── mod_db.py          # Mod database interface
│
├── api/                   # API route handlers
│   ├── builds.py          # Build analysis endpoints
│   ├── crafting.py        # Crafting calculation endpoints
│   └── market.py          # Market insights endpoints
│
└── utils/                 # Utility functions
```

## Installation

### 1. Install Python 3.10+

Make sure you have Python 3.10 or higher installed:

```bash
python --version
```

### 2. Create Virtual Environment (Recommended)

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Linux/Mac:
source venv/bin/activate
# On Windows:
venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Install Playwright Browsers

Playwright requires browser binaries to be installed:

```bash
playwright install chromium
```

This will download the Chromium browser for headless scraping.

## Running the Backend

### Start the Server

```bash
# Make sure you're in the backend directory with venv activated
python main.py
```

Or using uvicorn directly:

```bash
uvicorn main:app --reload --port 8000
```

The server will start on `http://localhost:8000`

### Verify It's Working

Open your browser and navigate to:
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/
- **Status**: http://localhost:8000/api/status

You should see the FastAPI interactive documentation.

## API Endpoints

### Core Endpoints

- `GET /` - Health check
- `GET /api/status` - Backend status and capabilities

### Build Scraping

- `POST /api/scrape/builds?league={league}` - Scrape builds from poe.ninja
  - Uses headless browser to execute JavaScript
  - Returns build data with character info, items, skills

### Mod Database

- `GET /api/mods/{item_class}` - Get mods for an item class
  - Query params: `mod_type`, `min_ilvl`, `max_ilvl`, `search`
  - Example: `/api/mods/Ring?mod_type=prefix&min_ilvl=82`

- `POST /api/scrape/mods` - Scrape mod database from poedb.tw
  - Takes a few minutes
  - Stores 1000+ mods in SQLite database
  - Run this once to populate the database

### Market Data

- `GET /api/market/{league}/{category}` - Get market data
  - Categories: currency, fragments, divination-cards, etc.

## Usage Examples

### Scrape Mod Database (Run Once)

```bash
curl -X POST http://localhost:8000/api/scrape/mods
```

This will scrape all mods from poedb.tw and store them in the database. It takes 2-3 minutes.

### Get Mods for Crafting

```bash
# Get all prefix mods for Rings at ilvl 82+
curl "http://localhost:8000/api/mods/Ring?mod_type=prefix&min_ilvl=82"

# Search for life mods
curl "http://localhost:8000/api/mods/universal?search=Life"
```

### Scrape Builds

```bash
curl -X POST "http://localhost:8000/api/scrape/builds?league=Standard"
```

## Database

The backend uses SQLite for data storage:

- **Location**: `../data/poe_mods.db`
- **Tables**: mods, item_bases, builds, market_items
- **Auto-created**: Database and tables are created automatically on first run

## Development

### Hot Reload

When running with `--reload`, the server automatically restarts when you modify Python files.

### Logging

The server logs important events to console:
- Scraping progress
- API requests
- Errors and warnings

### Testing Scrapers

You can test individual scrapers:

```bash
# Test poe.ninja scraper
python scrapers/poe_ninja.py

# Test poedb scraper
python scrapers/poedb_scraper.py
```

## Troubleshooting

### "playwright not found"

Run: `playwright install chromium`

### "Port 8000 already in use"

Change the port in `main.py`:
```python
uvicorn.run(app, host="0.0.0.0", port=8001)
```

### Scraping Fails

- Check internet connection
- Some sites may block automated requests
- Try increasing timeout values in scrapers

### Database Errors

Delete the database and let it recreate:
```bash
rm ../data/poe_mods.db
python main.py
```

## Next Steps

1. **Run the backend**: `python main.py`
2. **Scrape mod database**: `POST /api/scrape/mods`
3. **Test endpoints**: Visit http://localhost:8000/docs
4. **Integrate with frontend**: See INTEGRATION.md

## Future Features

- [ ] OCR for in-game item reading
- [ ] Map crafting automation
- [ ] Advanced crafting probability calculations
- [ ] Price prediction algorithms
- [ ] Trade API integration
