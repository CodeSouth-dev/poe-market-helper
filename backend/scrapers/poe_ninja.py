"""
PoE.ninja Scraper with Playwright (Headless Browser)
This ACTUALLY WORKS because it executes JavaScript!

Capabilities:
- Scrape builds from poe.ninja/builds (React/Next.js rendered)
- Scrape market data from API endpoints
- Extract data from JavaScript-rendered pages
"""
from playwright.async_api import async_playwright, Browser, Page
from typing import List, Dict, Optional, Any
import asyncio
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class PoeNinjaScraper:
    def __init__(self):
        self.base_url = "https://poe.ninja"
        self.timeout = 30000  # 30 seconds

    async def scrape_builds(self, league: str) -> List[Dict[str, Any]]:
        """
        Scrape builds from poe.ninja using headless browser
        Executes JavaScript and waits for React to render!

        Args:
            league: League name (e.g., "Affliction", "Standard")

        Returns:
            List of build dictionaries with character info, items, skills
        """
        builds = []

        async with async_playwright() as p:
            try:
                # Launch headless browser
                logger.info("Launching headless browser...")
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    viewport={'width': 1920, 'height': 1080}
                )
                page = await context.new_page()

                # Navigate to builds page
                url = f"{self.base_url}/builds/{league.lower().replace(' ', '-')}"
                logger.info(f"Navigating to: {url}")
                await page.goto(url, wait_until="networkidle", timeout=self.timeout)

                # Wait for React to render the builds
                try:
                    logger.info("Waiting for builds to load...")
                    await page.wait_for_selector(
                        ".build-card, .character-row, [class*='Build'], table",
                        timeout=10000
                    )
                    logger.info("Builds loaded!")
                except Exception as e:
                    logger.warning(f"Selector wait failed: {e}, trying alternative methods...")

                # Method 1: Extract from Next.js __NEXT_DATA__
                logger.info("Trying to extract Next.js data...")
                next_data = await page.evaluate("""
                    () => {
                        try {
                            return window.__NEXT_DATA__ || null;
                        } catch (e) {
                            return null;
                        }
                    }
                """)

                if next_data and "props" in next_data:
                    logger.info("Found Next.js data!")
                    page_props = next_data.get("props", {}).get("pageProps", {})

                    # Try different possible data locations
                    if "builds" in page_props:
                        builds.extend(self._parse_nextjs_builds(page_props["builds"]))
                    elif "snapshot" in page_props:
                        builds.extend(self._parse_nextjs_builds(page_props["snapshot"]))
                    elif "data" in page_props:
                        builds.extend(self._parse_nextjs_builds(page_props["data"]))

                # Method 2: Extract from DOM elements
                if not builds:
                    logger.info("Trying DOM extraction...")
                    build_elements = await page.query_selector_all(
                        ".build-card, .character-row, [class*='Build'], tr"
                    )

                    for element in build_elements[:100]:  # Limit to 100 builds
                        try:
                            # Extract build data from DOM
                            build_data = await element.evaluate("""
                                (el) => {
                                    // Try to extract common build information
                                    const getText = (selector) => {
                                        const elem = el.querySelector(selector);
                                        return elem ? elem.textContent.trim() : null;
                                    };

                                    return {
                                        name: getText('[class*="name"]') || getText('.name'),
                                        class: getText('[class*="class"]') || getText('.class'),
                                        level: getText('[class*="level"]') || getText('.level'),
                                        skill: getText('[class*="skill"]') || getText('.skill'),
                                        dps: getText('[class*="dps"]') || getText('.dps'),
                                        life: getText('[class*="life"]') || getText('.life'),
                                        energy_shield: getText('[class*="es"]') || getText('.es')
                                    };
                                }
                            """)

                            if build_data and (build_data.get("name") or build_data.get("class")):
                                builds.append(self._normalize_build(build_data))

                        except Exception as e:
                            logger.debug(f"Error parsing build element: {e}")
                            continue

                # Method 3: Listen for API responses
                if not builds:
                    logger.info("Trying to capture API responses...")
                    api_data = []

                    async def handle_response(response):
                        if "/api/data" in response.url or "/builds" in response.url:
                            try:
                                data = await response.json()
                                api_data.append(data)
                                logger.info(f"Captured API response from: {response.url}")
                            except:
                                pass

                    page.on("response", handle_response)

                    # Trigger any lazy-loaded API calls
                    await page.wait_for_timeout(3000)

                    # Parse API data
                    for data in api_data:
                        if isinstance(data, list):
                            builds.extend([self._normalize_build(b) for b in data])
                        elif isinstance(data, dict):
                            if "builds" in data:
                                builds.extend([self._normalize_build(b) for b in data["builds"]])
                            elif "snapshot" in data:
                                builds.extend([self._normalize_build(b) for b in data["snapshot"]])

                await browser.close()

            except Exception as e:
                logger.error(f"Error scraping builds: {e}")
                raise

        logger.info(f"Scraped {len(builds)} builds")
        return builds

    def _parse_nextjs_builds(self, data: Any) -> List[Dict[str, Any]]:
        """Parse builds from Next.js page props"""
        builds = []

        if isinstance(data, list):
            for item in data:
                builds.append(self._normalize_build(item))
        elif isinstance(data, dict):
            # Try common data structures
            for key in ["builds", "characters", "data", "items"]:
                if key in data and isinstance(data[key], list):
                    for item in data[key]:
                        builds.append(self._normalize_build(item))
                    break

        return builds

    def _normalize_build(self, raw_build: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize build data to consistent format"""
        return {
            "name": raw_build.get("name") or raw_build.get("character") or "Unknown",
            "class": raw_build.get("class") or raw_build.get("className") or "Unknown",
            "level": self._parse_int(raw_build.get("level")),
            "mainSkill": raw_build.get("skill") or raw_build.get("mainSkill") or raw_build.get("main_skill") or "Unknown",
            "dps": self._parse_int(raw_build.get("dps") or raw_build.get("totalDps")),
            "life": self._parse_int(raw_build.get("life") or raw_build.get("maxLife")),
            "energyShield": self._parse_int(raw_build.get("energy_shield") or raw_build.get("energyShield") or raw_build.get("es")),
            "items": raw_build.get("items", []),
            "url": raw_build.get("url") or raw_build.get("poeUrl"),
            "timestamp": datetime.utcnow().isoformat()
        }

    def _parse_int(self, value: Any) -> Optional[int]:
        """Safely parse integer from various formats"""
        if value is None:
            return None
        try:
            if isinstance(value, str):
                # Remove commas and 'k' suffix
                value = value.replace(',', '').replace('k', '000').replace('K', '000')
            return int(float(value))
        except:
            return None

    async def scrape_market_data(self, league: str, category: str) -> List[Dict]:
        """
        Scrape market data (currency, items, etc.)
        This works with regular API calls (no JS needed)

        Args:
            league: League name
            category: Category (currency, fragments, divination-cards, etc.)

        Returns:
            List of market items with prices
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                # Navigate to API endpoint directly
                api_url = f"{self.base_url}/api/data/{category}Overview?league={league}"
                logger.info(f"Fetching market data from: {api_url}")

                response = await page.goto(api_url, timeout=self.timeout)

                if response.status != 200:
                    raise Exception(f"API returned status {response.status}")

                # Extract JSON data
                content = await page.content()

                # Parse pre tag content (API returns JSON in <pre> tag)
                data = await page.evaluate("""
                    () => {
                        const pre = document.querySelector('pre');
                        if (pre) {
                            return JSON.parse(pre.textContent);
                        }
                        return null;
                    }
                """)

                if not data:
                    # Try parsing entire body as JSON
                    try:
                        data = json.loads(content)
                    except:
                        data = {}

                await browser.close()
                return data.get("lines", [])

            except Exception as e:
                logger.error(f"Error scraping market data: {e}")
                await browser.close()
                raise


# Example usage
async def main():
    scraper = PoeNinjaScraper()

    print("Scraping builds from poe.ninja...")
    builds = await scraper.scrape_builds("Standard")
    print(f"Found {len(builds)} builds")
    if builds:
        print("\nExample build:")
        print(json.dumps(builds[0], indent=2))

    print("\nScraping market data...")
    market = await scraper.scrape_market_data("Standard", "currency")
    print(f"Found {len(market)} currency items")


if __name__ == "__main__":
    asyncio.run(main())
