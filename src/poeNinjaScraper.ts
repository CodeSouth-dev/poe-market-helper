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
          // @ts-ignore - document is available in browser context
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
   * Get most popular items by slot with usage percentages
   */
  async getPopularItemsBySlot(league: string, slot: string): Promise<Array<{
    name: string;
    baseType: string;
    usageCount: number;
    usagePercent: number;
    builds: string[];
  }>> {
    console.log(`\n🔍 Analyzing ${slot} slot popularity for ${league}...`);

    const buildData = await this.scrapeBuilds(league);
    const slotUsage = new Map<string, { count: number; builds: Set<string> }>();

    // Analyze each build's items for this slot
    buildData.builds.forEach(build => {
      build.items.forEach(item => {
        const itemKey = item.name || item.baseType;

        // Check if this item belongs to the requested slot
        if (this.itemMatchesSlot(itemKey, slot)) {
          const existing = slotUsage.get(itemKey) || { count: 0, builds: new Set() };
          existing.count++;
          existing.builds.add(build.name);
          slotUsage.set(itemKey, existing);
        }
      });
    });

    // Convert to array and calculate percentages
    const items = Array.from(slotUsage.entries())
      .map(([name, data]) => ({
        name,
        baseType: this.extractBaseType(name),
        usageCount: data.count,
        usagePercent: (data.count / buildData.totalBuilds) * 100,
        builds: Array.from(data.builds).slice(0, 5) // Top 5 builds using this
      }))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 20);

    console.log(`\n📊 Top ${slot} by usage:`);
    items.slice(0, 10).forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.name} - ${item.usagePercent.toFixed(1)}% (${item.usageCount} builds)`);
    });

    return items;
  }

  /**
   * Get weapon configuration analysis
   */
  async getWeaponAnalysis(league: string): Promise<{
    mainHand: Array<{ name: string; usagePercent: number }>;
    offHand: Array<{ name: string; usagePercent: number }>;
    twoHanded: Array<{ name: string; usagePercent: number }>;
    weaponTypes: Array<{ type: string; usagePercent: number }>;
  }> {
    console.log(`\n⚔️  Analyzing weapon configurations for ${league}...`);

    const buildData = await this.scrapeBuilds(league);

    const mainHandUsage = new Map<string, number>();
    const offHandUsage = new Map<string, number>();
    const twoHandedUsage = new Map<string, number>();
    const weaponTypeUsage = new Map<string, number>();

    buildData.builds.forEach(build => {
      build.items.forEach(item => {
        const itemName = (item.name || item.baseType).toLowerCase();

        // Classify weapon
        if (this.isWeapon(itemName)) {
          const weaponType = this.getWeaponType(itemName);

          // Count weapon type
          weaponTypeUsage.set(weaponType, (weaponTypeUsage.get(weaponType) || 0) + 1);

          // Count by slot
          if (this.isTwoHanded(itemName)) {
            twoHandedUsage.set(item.name, (twoHandedUsage.get(item.name) || 0) + 1);
          } else {
            // Assume main hand for one-handed weapons
            mainHandUsage.set(item.name, (mainHandUsage.get(item.name) || 0) + 1);
          }

          // Track shields and off-hand items
          if (itemName.includes('shield')) {
            offHandUsage.set(item.name, (offHandUsage.get(item.name) || 0) + 1);
          }
        }
      });
    });

    const toPercentArray = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([name, count]) => ({
          name,
          usagePercent: (count / buildData.totalBuilds) * 100
        }))
        .sort((a, b) => b.usagePercent - a.usagePercent)
        .slice(0, 10);

    const result = {
      mainHand: toPercentArray(mainHandUsage),
      offHand: toPercentArray(offHandUsage),
      twoHanded: toPercentArray(twoHandedUsage),
      weaponTypes: Array.from(weaponTypeUsage.entries())
        .map(([type, count]) => ({
          type,
          usagePercent: (count / buildData.totalBuilds) * 100
        }))
        .sort((a, b) => b.usagePercent - a.usagePercent)
    };

    console.log('\n⚔️  Weapon Type Distribution:');
    result.weaponTypes.forEach(wt => {
      console.log(`   ${wt.type}: ${wt.usagePercent.toFixed(1)}%`);
    });

    return result;
  }

  /**
   * Check if item name matches a slot
   */
  private itemMatchesSlot(itemName: string, slot: string): boolean {
    const name = itemName.toLowerCase();
    const slotLower = slot.toLowerCase();

    if (slotLower === 'boots') {
      return name.includes('boot') || name.includes('slink');
    }
    if (slotLower === 'gloves') {
      return name.includes('glove') || name.includes('gauntlet') || name.includes('mitts');
    }
    if (slotLower === 'helmet' || slotLower === 'helm') {
      return name.includes('helmet') || name.includes('helm') || name.includes('cap') || name.includes('hood');
    }
    if (slotLower === 'body armour' || slotLower === 'chest') {
      return name.includes('regalia') || name.includes('vest') || name.includes('robe') ||
             name.includes('plate') || name.includes('brigandine') || name.includes('coat') ||
             name.includes('garb') || name.includes('armour');
    }
    if (slotLower === 'weapon') {
      return this.isWeapon(name);
    }
    if (slotLower === 'ring') {
      return name.includes('ring');
    }
    if (slotLower === 'amulet') {
      return name.includes('amulet');
    }
    if (slotLower === 'belt') {
      return name.includes('belt') || name.includes('sash') || name.includes('vise');
    }

    return false;
  }

  /**
   * Check if item is a weapon
   */
  private isWeapon(itemName: string): boolean {
    const weaponKeywords = [
      'sword', 'axe', 'mace', 'dagger', 'claw', 'bow', 'staff', 'wand',
      'sceptre', 'scepter', 'foil', 'blade', 'reaver', 'cleaver'
    ];

    return weaponKeywords.some(keyword => itemName.includes(keyword));
  }

  /**
   * Check if weapon is two-handed
   */
  private isTwoHanded(itemName: string): boolean {
    const twoHandedKeywords = [
      'staff', 'bow', 'two hand', 'twohanded', '2h', 'maul', 'bastard', 'greatsword'
    ];

    return twoHandedKeywords.some(keyword => itemName.includes(keyword));
  }

  /**
   * Get weapon type classification
   */
  private getWeaponType(itemName: string): string {
    if (itemName.includes('bow')) return 'Bow';
    if (itemName.includes('wand')) return 'Wand';
    if (itemName.includes('staff')) return 'Staff';
    if (itemName.includes('claw')) return 'Claw';
    if (itemName.includes('dagger')) return 'Dagger';
    if (itemName.includes('sword') || itemName.includes('foil') || itemName.includes('blade')) return 'Sword';
    if (itemName.includes('axe') || itemName.includes('cleaver')) return 'Axe';
    if (itemName.includes('mace') || itemName.includes('sceptre') || itemName.includes('scepter')) return 'Mace/Sceptre';
    return 'Other';
  }

  /**
   * Extract base type from item name
   */
  private extractBaseType(itemName: string): string {
    // Remove prefixes like "Rare ", "Unique ", item level indicators, etc.
    let base = itemName.replace(/^(Rare|Unique|Magic|Normal)\s+/i, '');
    base = base.replace(/\s+ilvl\s*\d+/i, '');
    base = base.replace(/\s+\(\d+\)/, '');

    return base.trim();
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
