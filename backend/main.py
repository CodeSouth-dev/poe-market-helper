"""
PoE Market Helper - Python Backend
FastAPI server for headless browsing, scraping, and data processing

This server provides REST API endpoints for:
- Build scraping from poe.ninja (using Playwright for JS execution)
- Mod database from poedb.tw
- Market analysis and crafting calculations
- Future: OCR, game automation, map crafting

Run with: uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
import logging

# Import our modules
from scrapers.poe_ninja import PoeNinjaScraper
from scrapers.poedb_scraper import PoeDBScraper
from database.mod_db import ModDatabase
from api import builds, crafting, market

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PoE Market Helper API",
    description="Backend for Path of Exile market analysis and crafting",
    version="2.0.0"
)

# CORS - allow Electron frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your Electron app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
logger.info("Initializing services...")
poe_ninja = PoeNinjaScraper()
poedb = PoeDBScraper()
mod_db = ModDatabase()

# Include routers
app.include_router(builds.router, prefix="/api/builds", tags=["builds"])
app.include_router(crafting.router, prefix="/api/crafting", tags=["crafting"])
app.include_router(market.router, prefix="/api/market", tags=["market"])


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "PoE Market Helper Backend",
        "version": "2.0.0",
        "endpoints": {
            "docs": "/docs",
            "builds": "/api/builds",
            "crafting": "/api/crafting",
            "market": "/api/market"
        }
    }


@app.get("/api/status")
async def get_status():
    """Get backend status and capabilities"""
    try:
        mod_stats = await mod_db.get_stats()
        return {
            "status": "operational",
            "playwright": "available",
            "mod_database": mod_stats,
            "services": {
                "build_scraper": "ready",
                "mod_scraper": "ready",
                "market_analysis": "ready"
            }
        }
    except Exception as e:
        logger.error(f"Error getting status: {e}")
        return {
            "status": "degraded",
            "error": str(e)
        }


# Build scraping endpoints
@app.post("/api/scrape/builds")
async def scrape_builds(league: str):
    """
    Scrape builds from poe.ninja using headless browser
    This ACTUALLY WORKS because Playwright can execute JavaScript!

    Args:
        league: League name (e.g., "Affliction", "Standard")

    Returns:
        {
            "success": true,
            "builds_count": 250,
            "data": [...builds...],
            "timestamp": "2025-01-15T10:30:00"
        }
    """
    try:
        logger.info(f"Scraping builds for league: {league}")
        builds = await poe_ninja.scrape_builds(league)
        return {
            "success": True,
            "builds_count": len(builds),
            "data": builds,
            "league": league
        }
    except Exception as e:
        logger.error(f"Error scraping builds: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Mod database endpoints
@app.get("/api/mods/{item_class}")
async def get_mods(
    item_class: str,
    mod_type: Optional[str] = None,  # "prefix" or "suffix"
    min_ilvl: int = 1,
    max_ilvl: int = 100,
    search: Optional[str] = None
):
    """
    Get comprehensive mod data from database
    Database populated by scraping poedb.tw

    Args:
        item_class: Item class (e.g., "Ring", "Body Armour", "universal")
        mod_type: "prefix" or "suffix" (optional, returns both if not specified)
        min_ilvl: Minimum item level
        max_ilvl: Maximum item level
        search: Search term for mod name

    Returns:
        {
            "success": true,
            "count": 150,
            "mods": [
                {
                    "name": "+# to maximum Life",
                    "type": "prefix",
                    "tier": "T1",
                    "ilvl": 82,
                    "tags": ["default"],
                    "item_classes": ["Ring", "Amulet"]
                },
                ...
            ]
        }
    """
    try:
        mods = await mod_db.get_mods(
            item_class=item_class,
            mod_type=mod_type,
            min_ilvl=min_ilvl,
            max_ilvl=max_ilvl,
            search=search
        )
        return {
            "success": True,
            "count": len(mods),
            "mods": mods
        }
    except Exception as e:
        logger.error(f"Error getting mods: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scrape/mods")
async def scrape_mods(force_refresh: bool = False):
    """
    Scrape mod database from poedb.tw
    This will take a few minutes but provides comprehensive mod data

    Args:
        force_refresh: Force refresh even if cache exists

    Returns:
        {
            "success": true,
            "prefix_count": 500,
            "suffix_count": 600,
            "total": 1100
        }
    """
    try:
        logger.info("Starting mod database scrape from poedb.tw...")
        mods = await poedb.scrape_all_mods()

        # Store in database
        await mod_db.store_mods(mods)

        return {
            "success": True,
            "prefix_count": len(mods.get("prefix", [])),
            "suffix_count": len(mods.get("suffix", [])),
            "total": len(mods.get("prefix", [])) + len(mods.get("suffix", []))
        }
    except Exception as e:
        logger.error(f"Error scraping mods: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Market data endpoints
@app.get("/api/market/{league}/{category}")
async def get_market_data(
    league: str,
    category: str,  # "currency", "fragments", "divination-cards", etc.
):
    """
    Get market data from poe.ninja

    Args:
        league: League name
        category: Data category

    Returns:
        Market data for the specified category
    """
    try:
        data = await poe_ninja.scrape_market_data(league, category)
        return {
            "success": True,
            "league": league,
            "category": category,
            "data": data
        }
    except Exception as e:
        logger.error(f"Error getting market data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    # Run server on port 8000
    # Electron app will connect to http://localhost:8000
    logger.info("Starting PoE Market Helper Backend on port 8000...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
