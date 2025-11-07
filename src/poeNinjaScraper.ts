/**
 * Enhanced poe.ninja scraper using headless browser
 * Properly scrapes build data from the React-based website
 */

import { browserManager } from './browserManager';
import { RateLimiter, RateLimitPresets } from './rateLimiter';
import { BuildScrapedData, BuildSnapshot } from './api/poeNinja';

const rateLimiter = new RateLimiter(RateLimitPresets.poeNinja);
const SESSION_ID = 'poe-ninja-scraper';

export class PoeNinjaScraper {
  /**
   * Scrape build data from poe.ninja/builds using headless browser
   */
  async scrapeBuilds(league: string): Promise<BuildScrapedData> {
    console.log(`🔍 Scraping builds for league: ${league}`);

    return await rateLimiter.execute('poe.ninja', async () => {
      const page = await browserManager.createPage(SESSION_ID, true);

      try {
        const buildsUrl = `https://poe.ninja/builds/${this.normalizeLeagueName(league)}`;
        console.log(`   Loading: ${buildsUrl}`);

        // Navigate to builds page
        await page.goto(buildsUrl, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });

        // Wait for React to render the content
        await page.waitForSelector('.build-table, [class*="BuildTable"], table', {
          timeout: 15000
        });

        // Give React time to populate data
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Extract build data from the rendered page
        const buildData = await page.evaluate(() => {
          const builds: any[] = [];
          const itemUsage = new Map<string, number>();

          // Try different selectors for build rows
          const buildRows = document.querySelectorAll(
            '.build-row, [class*="BuildRow"], tbody tr, .table-row'
          );

          // @ts-ignore
          console.log(`Found ${buildRows.length} build rows`);

          buildRows.forEach((row, index) => {
            if (index > 100) return; // Limit to first 100 builds

            try {
              // Extract build name/character
              const nameElem = row.querySelector('.name, [class*="Name"], .character-name, td:first-child');
              const name = nameElem?.textContent?.trim() || `Build ${index + 1}`;

              // Extract class/ascendancy
              const classElem = row.querySelector('.class, [class*="Class"], .ascendancy, td:nth-child(2)');
              const buildClass = classElem?.textContent?.trim() || 'Unknown';

              // Extract level
              const levelElem = row.querySelector('.level, [class*="Level"], td:nth-child(3)');
              const level = parseInt(levelElem?.textContent?.trim() || '100');

              // Extract main skill
              const skillElem = row.querySelector('.skill, [class*="Skill"], .main-skill, td:nth-child(4)');
              const mainSkill = skillElem?.textContent?.trim() || 'Unknown';

              // Try to find item links or images
              const itemLinks = row.querySelectorAll('a[href*="/item/"], img[alt*="item"], .item');
              const items: any[] = [];

              itemLinks.forEach(itemElem => {
                let itemName = '';

                if (itemElem.tagName === 'IMG') {
                  itemName = itemElem.getAttribute('alt') || '';
                } else if (itemElem.tagName === 'A') {
                  itemName = itemElem.textContent?.trim() || itemElem.getAttribute('title') || '';
                }

                if (itemName && itemName.length > 2) {
                  items.push({
                    slot: 'Unknown',
                    name: itemName,
                    baseType: itemName,
                    mods: []
                  });

                  // Track item usage
                  const count = itemUsage.get(itemName) || 0;
                  itemUsage.set(itemName, count + 1);
                }
              });

              builds.push({
                name,
                class: buildClass,
                level,
                mainSkill,
                popularity: 1,
                items
              });
            } catch (error) {
              // @ts-ignore
              console.error('Error parsing build row:', error);
            }
          });

          return {
            builds,
            itemUsage: Array.from(itemUsage.entries())
          };
        });

        console.log(`   ✅ Extracted ${buildData.builds.length} builds`);
        console.log(`   📊 Found ${buildData.itemUsage.length} unique items`);

        // Convert item usage to popularItems Map
        const popularItems = new Map();
        buildData.itemUsage
          .sort((a, b) => b[1] - a[1]) // Sort by usage count
          .slice(0, 50) // Top 50 items
          .forEach(([itemName, count]) => {
            const usagePercent = (count / buildData.builds.length) * 100;
            popularItems.set(itemName, {
              name: itemName,
              baseType: itemName,
              slot: 'Unknown',
              usageCount: count,
              usagePercent: usagePercent,
              commonMods: []
            });
          });

        return {
          league,
          timestamp: new Date(),
          totalBuilds: buildData.builds.length,
          builds: buildData.builds,
          popularItems
        };

      } catch (error: any) {
        console.error(`   ❌ Failed to scrape builds:`, error.message);

        // Return empty data rather than throwing
        return {
          league,
          timestamp: new Date(),
          totalBuilds: 0,
          builds: [],
          popularItems: new Map()
        };
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Get popular craftable items based on build data
   */
  async getPopularCraftableItems(league: string, minWealth: number = 0, maxWealth: number = 1000000): Promise<Array<{
    name: string;
    usage: number;
    estimatedValue: number;
    craftingDifficulty: string;
  }>> {
    const buildData = await this.scrapeBuilds(league);
    const items: Array<{
      name: string;
      usage: number;
      estimatedValue: number;
      craftingDifficulty: string;
    }> = [];

    for (const [itemName, itemData] of buildData.popularItems.entries()) {
      // Estimate item value based on usage and type
      let estimatedValue = 10;
      let craftingDifficulty = 'Easy';

      const nameLower = itemName.toLowerCase();

      // Unique items (not craftable, skip)
      if (nameLower.includes("'s ")) continue;

      // High-value craftable bases
      if (nameLower.includes('steel ring') || nameLower.includes('opal ring') ||
          nameLower.includes('crystal belt') || nameLower.includes('stygian vise')) {
        estimatedValue = 500;
        craftingDifficulty = 'Very Hard';
      }
      else if (nameLower.includes('vaal regalia') || nameLower.includes('slink')) {
        estimatedValue = 300;
        craftingDifficulty = 'Hard';
      }
      else if (nameLower.includes('hubris') || nameLower.includes('bone helmet')) {
        estimatedValue = 200;
        craftingDifficulty = 'Hard';
      }
      else if (nameLower.includes('ring') || nameLower.includes('amulet') || nameLower.includes('belt')) {
        estimatedValue = 100;
        craftingDifficulty = 'Medium';
      }
      else if (nameLower.includes('jewel')) {
        estimatedValue = 50;
        craftingDifficulty = 'Medium';
      }

      // Adjust for influence
      if (nameLower.includes('elder') || nameLower.includes('shaper') ||
          nameLower.includes('crusader') || nameLower.includes('hunter') ||
          nameLower.includes('redeemer') || nameLower.includes('warlord')) {
        estimatedValue *= 1.5;
        craftingDifficulty = 'Very Hard';
      }

      // Filter by wealth range
      if (estimatedValue >= minWealth && estimatedValue <= maxWealth) {
        items.push({
          name: itemName,
          usage: itemData.usageCount,
          estimatedValue: Math.round(estimatedValue),
          craftingDifficulty
        });
      }
    }

    // Sort by usage (most popular first)
    items.sort((a, b) => b.usage - a.usage);

    console.log(`\n📋 Popular Craftable Items (${minWealth}-${maxWealth}c):`);
    items.slice(0, 10).forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.name} (${item.usage} builds, ~${item.estimatedValue}c, ${item.craftingDifficulty})`);
    });

    return items;
  }

  /**
   * Get build statistics
   */
  async getBuildStats(league: string): Promise<{
    topClasses: Array<{ class: string; count: number }>;
    topSkills: Array<{ skill: string; count: number }>;
    averageLevel: number;
  }> {
    const buildData = await this.scrapeBuilds(league);

    const classCount = new Map<string, number>();
    const skillCount = new Map<string, number>();
    let totalLevel = 0;

    buildData.builds.forEach(build => {
      // Count classes
      const classKey = build.class || 'Unknown';
      classCount.set(classKey, (classCount.get(classKey) || 0) + 1);

      // Count skills
      const skillKey = build.mainSkill || 'Unknown';
      skillCount.set(skillKey, (skillCount.get(skillKey) || 0) + 1);

      totalLevel += build.level || 0;
    });

    const topClasses = Array.from(classCount.entries())
      .map(([cls, count]) => ({ class: cls, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topSkills = Array.from(skillCount.entries())
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const averageLevel = buildData.builds.length > 0
      ? totalLevel / buildData.builds.length
      : 0;

    return {
      topClasses,
      topSkills,
      averageLevel
    };
  }

  /**
   * Normalize league name for URL
   */
  private normalizeLeagueName(league: string): string {
    return league.toLowerCase().replace(/\s+/g, '-');
  }
}

// Singleton instance
export const poeNinjaScraper = new PoeNinjaScraper();
