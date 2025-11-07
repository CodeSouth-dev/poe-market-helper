"""
PoeDB Scraper - Get comprehensive mod database
Scrapes from poedb.tw for complete mod information

Provides:
- All prefix and suffix mods
- Tier information
- Item level requirements
- Item class applicability
- Tags and spawn weights
"""
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from typing import List, Dict, Any
import asyncio
import re
import logging

logger = logging.getLogger(__name__)


class PoeDBScraper:
    def __init__(self):
        self.base_url = "https://poedb.tw/us"
        self.timeout = 30000

    async def scrape_all_mods(self) -> Dict[str, List[Dict]]:
        """
        Scrape ALL mod affixes from poedb
        This gets us a complete, up-to-date mod database

        Returns:
            {
                "prefix": [...],
                "suffix": [...]
            }
        """
        all_mods = {
            "prefix": [],
            "suffix": []
        }

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                # Scrape prefix mods
                logger.info("Scraping prefix mods from poedb.tw...")
                prefix_url = f"{self.base_url}/mod.php?type=prefix"
                await page.goto(prefix_url, wait_until="networkidle", timeout=self.timeout)
                await page.wait_for_selector("table", timeout=10000)

                # Get page HTML
                html = await page.content()
                soup = BeautifulSoup(html, 'html.parser')

                # Parse mod table
                all_mods["prefix"] = self.parse_mod_table(soup, "prefix")
                logger.info(f"Found {len(all_mods['prefix'])} prefix mods")

                # Scrape suffix mods
                logger.info("Scraping suffix mods from poedb.tw...")
                suffix_url = f"{self.base_url}/mod.php?type=suffix"
                await page.goto(suffix_url, wait_until="networkidle", timeout=self.timeout)
                await page.wait_for_selector("table", timeout=10000)

                html = await page.content()
                soup = BeautifulSoup(html, 'html.parser')

                all_mods["suffix"] = self.parse_mod_table(soup, "suffix")
                logger.info(f"Found {len(all_mods['suffix'])} suffix mods")

            except Exception as e:
                logger.error(f"Error scraping mods: {e}")
                raise
            finally:
                await browser.close()

        return all_mods

    def parse_mod_table(self, soup: BeautifulSoup, mod_type: str) -> List[Dict]:
        """
        Parse mod table from poedb HTML
        Extracts: name, tier, ilvl, tags, spawn weights

        Args:
            soup: BeautifulSoup object of page HTML
            mod_type: "prefix" or "suffix"

        Returns:
            List of mod dictionaries
        """
        mods = []
        tables = soup.find_all('table', {'class': 'table'})

        for table in tables:
            rows = table.find_all('tr')

            # Find header row to determine column indices
            header_cols = []
            for row in rows:
                if row.find('th'):
                    header_cols = [th.text.strip().lower() for th in row.find_all('th')]
                    break

            # Parse data rows
            for row in rows:
                cols = row.find_all('td')
                if len(cols) < 3:  # Need at least name, tier, ilvl
                    continue

                try:
                    # Extract mod data (column positions may vary)
                    # Common format: [Name, Tier, iLvl, Tags, ...]
                    mod_name = cols[0].text.strip()

                    # Skip empty or header rows
                    if not mod_name or mod_name.lower() in ['name', 'mod']:
                        continue

                    tier = cols[1].text.strip() if len(cols) > 1 else "T1"
                    ilvl_text = cols[2].text.strip() if len(cols) > 2 else "1"
                    tags = cols[3].text.strip() if len(cols) > 3 else ""

                    # Parse ilvl (might be "68" or "68-84" or "68+")
                    ilvl = self._parse_ilvl(ilvl_text)

                    # Determine applicable item classes from tags
                    item_classes = self.parse_tags(tags)

                    # Extract stat values from mod name
                    stat_ranges = self._extract_stat_ranges(mod_name)

                    mod = {
                        "name": mod_name,
                        "type": mod_type,
                        "tier": tier,
                        "ilvl": ilvl,
                        "tags": tags.split(',') if tags else [],
                        "item_classes": item_classes,
                        "stat_ranges": stat_ranges,
                        "source": "poedb"
                    }

                    mods.append(mod)

                except Exception as e:
                    logger.debug(f"Error parsing row: {e}")
                    continue

        return mods

    def _parse_ilvl(self, ilvl_text: str) -> int:
        """Parse item level from text like '68', '68-84', '68+'"""
        try:
            # Extract first number
            match = re.search(r'(\d+)', ilvl_text)
            if match:
                return int(match.group(1))
        except:
            pass
        return 1

    def _extract_stat_ranges(self, mod_name: str) -> List[Dict[str, Any]]:
        """
        Extract stat value ranges from mod name
        Examples:
            "+# to maximum Life" -> no range (variable)
            "+(20-30) to maximum Life" -> [{min: 20, max: 30}]
            "+(20-30)% to Fire Resistance, +(10-15)% to Lightning Resistance" -> two ranges
        """
        ranges = []

        # Find all (min-max) patterns
        pattern = r'\((\d+)-(\d+)\)'
        matches = re.findall(pattern, mod_name)

        for match in matches:
            ranges.append({
                "min": int(match[0]),
                "max": int(match[1])
            })

        return ranges

    def parse_tags(self, tags: str) -> List[str]:
        """
        Parse tags to determine which item classes this mod applies to

        Args:
            tags: Comma-separated tags from poedb

        Returns:
            List of applicable item classes
        """
        item_classes = []
        tag_lower = tags.lower()

        # Map tags to item classes
        tag_mappings = {
            'ring': ['Ring'],
            'jewellery': ['Ring', 'Amulet'],
            'amulet': ['Amulet'],
            'belt': ['Belt'],
            'body': ['Body Armour'],
            'armour': ['Body Armour', 'Helmet', 'Gloves', 'Boots'],
            'helmet': ['Helmet'],
            'helm': ['Helmet'],
            'gloves': ['Gloves'],
            'boots': ['Boots'],
            'shield': ['Shield'],
            'weapon': ['Sword', 'Axe', 'Mace', 'Bow', 'Wand', 'Dagger', 'Claw', 'Staff', 'Sceptre'],
            'sword': ['Sword'],
            'axe': ['Axe'],
            'mace': ['Mace'],
            'bow': ['Bow'],
            'wand': ['Wand'],
            'dagger': ['Dagger'],
            'claw': ['Claw'],
            'staff': ['Staff'],
            'sceptre': ['Sceptre'],
            'quiver': ['Quiver'],
            'jewel': ['Jewel'],
            'flask': ['Flask']
        }

        # Check each tag mapping
        for tag, classes in tag_mappings.items():
            if tag in tag_lower:
                item_classes.extend(classes)

        # Remove duplicates
        item_classes = list(set(item_classes))

        # Default to universal if no specific class found
        if not item_classes:
            item_classes.append("universal")

        return item_classes

    async def scrape_item_bases(self) -> List[Dict]:
        """
        Scrape all item bases (for accurate ilvl requirements, implicit mods, etc.)

        Returns:
            List of base item dictionaries
        """
        bases = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                # Scrape from poedb item database
                url = f"{self.base_url}/item.php"
                logger.info(f"Scraping item bases from: {url}")

                await page.goto(url, wait_until="networkidle", timeout=self.timeout)
                await page.wait_for_selector("table", timeout=10000)

                html = await page.content()
                soup = BeautifulSoup(html, 'html.parser')

                # Parse base items...
                # (Similar parsing logic as mods)
                tables = soup.find_all('table', {'class': 'table'})

                for table in tables:
                    rows = table.find_all('tr')[1:]  # Skip header

                    for row in rows:
                        cols = row.find_all('td')
                        if len(cols) < 2:
                            continue

                        try:
                            base_name = cols[0].text.strip()
                            base_type = cols[1].text.strip() if len(cols) > 1 else ""

                            base = {
                                "name": base_name,
                                "type": base_type,
                                "source": "poedb"
                            }

                            bases.append(base)

                        except Exception as e:
                            logger.debug(f"Error parsing base: {e}")
                            continue

            except Exception as e:
                logger.error(f"Error scraping bases: {e}")
                raise
            finally:
                await browser.close()

        logger.info(f"Scraped {len(bases)} item bases")
        return bases


# Example usage
async def main():
    scraper = PoeDBScraper()

    print("Scraping mod database from poedb.tw...")
    print("This may take a few minutes...\n")

    mods = await scraper.scrape_all_mods()

    print(f"\nTotal prefixes: {len(mods['prefix'])}")
    print(f"Total suffixes: {len(mods['suffix'])}")
    print(f"Total mods: {len(mods['prefix']) + len(mods['suffix'])}")

    if mods['prefix']:
        print("\nExample prefix mod:")
        print(mods['prefix'][0])

    if mods['suffix']:
        print("\nExample suffix mod:")
        print(mods['suffix'][0])


if __name__ == "__main__":
    asyncio.run(main())
