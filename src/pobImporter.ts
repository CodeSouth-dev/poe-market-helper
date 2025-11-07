/**
 * Path of Building (PoB) Import
 * Parses PoB pastebin codes and extracts build information
 */

import * as zlib from 'zlib';
import { promisify } from 'util';
import { parseStringPromise } from 'xml2js';
import { PoeNinjaAPI } from './api/poeNinja';
import { priceComparisonService } from './priceComparison';

const inflate = promisify(zlib.inflate);

export interface PoBItem {
  slot: string;
  name: string;
  type: string;
  rarity: string;
  requiredMods: string[];
  optionalMods: string[];
  estimatedCost: number;
  links?: number;
}

export interface PoBBuild {
  buildName: string;
  className: string;
  ascendancy: string;
  level: number;
  mainSkill: string;
  supportGems: string[];
  items: PoBItem[];
  totalCost: number;
  missingItems: string[];
  keystones: string[];
  craftingRecommendations: Array<{
    slot: string;
    baseItem: string;
    desiredMods: string[];
    craftingMethod: string;
    estimatedCost: number;
  }>;
}

export class PoBImporter {
  private poeAPI: PoeNinjaAPI;

  constructor() {
    this.poeAPI = new PoeNinjaAPI();
  }

  /**
   * Import and parse a PoB pastebin code
   */
  async importBuild(pobCode: string, league: string = 'Standard'): Promise<PoBBuild> {
    console.log('\n📋 Importing Path of Building code...');

    try {
      // Remove PoB prefix if present
      const cleanCode = pobCode.replace(/^https?:\/\/pastebin\.com\/(raw\/)?/, '').trim();

      // Decode base64
      const decodedBuffer = Buffer.from(cleanCode, 'base64');

      // Decompress
      const inflated = await inflate(decodedBuffer);
      const xmlString = inflated.toString('utf-8');

      // Parse XML
      const parsedXML = await parseStringPromise(xmlString);

      console.log('   ✅ Successfully parsed PoB code');

      // Extract build information
      const build = await this.extractBuildInfo(parsedXML, league);

      console.log(`\n📊 Build Summary:`);
      console.log(`   Name: ${build.buildName}`);
      console.log(`   Class: ${build.className} (${build.ascendancy})`);
      console.log(`   Level: ${build.level}`);
      console.log(`   Main Skill: ${build.mainSkill}`);
      console.log(`   Total Cost: ${build.totalCost.toFixed(0)}c`);
      console.log(`   Items: ${build.items.length}`);
      console.log(`   Missing: ${build.missingItems.length}`);

      return build;

    } catch (error: any) {
      console.error('   ❌ Failed to import PoB code:', error.message);
      throw new Error('Invalid PoB code: ' + error.message);
    }
  }

  /**
   * Extract build information from parsed XML
   */
  private async extractBuildInfo(xml: any, league: string): Promise<PoBBuild> {
    const pathOfBuilding = xml.PathOfBuilding;

    // Extract build name
    const buildName = pathOfBuilding.Build?.[0]?.$.name || 'Unnamed Build';

    // Extract character info
    const level = parseInt(pathOfBuilding.Build?.[0]?.$.level) || 90;
    const className = pathOfBuilding.Build?.[0]?.$.className || 'Unknown';
    const ascendancy = pathOfBuilding.Build?.[0]?.$.ascendClassName || 'None';

    // Extract main skill
    const skills = pathOfBuilding.Skills?.[0]?.Skill || [];
    const mainSkillData = skills.find((s: any) => s.$.enabled === 'true') || skills[0];
    const mainSkill = mainSkillData?.$.mainActiveSkill || 'Unknown';

    // Extract support gems
    const gems = mainSkillData?.Gem || [];
    const supportGems = gems
      .filter((g: any) => g.$.enabled === 'true' && g.$.nameSpec)
      .map((g: any) => g.$.nameSpec)
      .slice(1, 6); // Skip main skill, take up to 5 supports

    // Extract keystones
    const spec = pathOfBuilding.Tree?.[0]?.Spec?.[0];
    const nodes = spec?.nodes?.split(',') || [];
    const keystones = this.identifyKeystones(nodes);

    // Extract items
    const itemSet = pathOfBuilding.Items?.[0]?.ItemSet?.[0];
    const itemSlots = itemSet?.Slot || [];

    const items: PoBItem[] = [];
    const missingItems: string[] = [];

    for (const slot of itemSlots) {
      const slotName = slot.$.name;
      const itemData = slot.Item?.[0];

      if (itemData) {
        const itemText = itemData._ || itemData;
        const parsedItem = this.parseItem(slotName, itemText);

        // Get price estimate
        try {
          const priceResult = await priceComparisonService.compareItemPrice(
            parsedItem.name,
            league
          );

          if (priceResult.lowestPrice && priceResult.lowestPrice.price) {
            parsedItem.estimatedCost = priceResult.lowestPrice.price;
          } else if (priceResult.averagePrice > 0) {
            parsedItem.estimatedCost = priceResult.averagePrice;
          } else {
            parsedItem.estimatedCost = this.estimateItemCost(parsedItem);
          }
        } catch (error) {
          parsedItem.estimatedCost = this.estimateItemCost(parsedItem);
        }

        items.push(parsedItem);
      } else {
        missingItems.push(slotName);
      }
    }

    // Calculate total cost
    const totalCost = items.reduce((sum, item) => sum + item.estimatedCost, 0);

    // Generate crafting recommendations
    const craftingRecommendations = this.generateCraftingRecommendations(items);

    return {
      buildName,
      className,
      ascendancy,
      level,
      mainSkill,
      supportGems,
      items,
      totalCost,
      missingItems,
      keystones,
      craftingRecommendations
    };
  }

  /**
   * Parse item text from PoB
   */
  private parseItem(slot: string, itemText: string): PoBItem {
    const lines = itemText.split('\n');

    // Extract item name (first line after rarity)
    const rarityLine = lines.find(l => l.startsWith('Rarity:'));
    const rarity = rarityLine?.split(':')[1]?.trim() || 'Normal';
    const nameIndex = lines.indexOf(rarityLine || '') + 1;
    const name = lines[nameIndex]?.trim() || 'Unknown';
    const type = lines[nameIndex + 1]?.trim() || 'Unknown';

    // Extract mods
    const requiredMods: string[] = [];
    const optionalMods: string[] = [];

    // Look for explicit mods (after a separator line)
    let inExplicitMods = false;
    for (const line of lines) {
      if (line.includes('--------')) {
        inExplicitMods = true;
        continue;
      }

      if (inExplicitMods && line.trim() && !line.startsWith('Rarity:') && !line.startsWith('Requirements:')) {
        // Check if it's a high-value mod
        if (this.isHighValueMod(line)) {
          requiredMods.push(line.trim());
        } else {
          optionalMods.push(line.trim());
        }
      }
    }

    // Extract links (for weapons/armor)
    const socketsLine = lines.find(l => l.startsWith('Sockets:'));
    const links = this.extractLinks(socketsLine || '');

    return {
      slot,
      name,
      type,
      rarity,
      requiredMods,
      optionalMods,
      estimatedCost: 0,
      links
    };
  }

  /**
   * Check if a mod is high value
   */
  private isHighValueMod(mod: string): boolean {
    const highValuePatterns = [
      /\+\d+ to Level of Socketed/i,
      /\+\d+% to (Fire|Cold|Lightning|Chaos) Resistance/i,
      /\+\d+ to maximum Life/i,
      /\+\d+% increased Energy Shield/i,
      /\+\d+% increased Critical Strike/i,
      /Curse/i,
      /Additional/i,
      /Cannot be/i
    ];

    return highValuePatterns.some(pattern => pattern.test(mod));
  }

  /**
   * Extract number of links from socket line
   */
  private extractLinks(socketsLine: string): number {
    if (!socketsLine) return 0;

    // Count connected sockets (e.g., "R-G-B-R" = 4-link)
    const socketGroups = socketsLine.split(':')[1]?.trim().split(' ') || [];
    let maxLinks = 0;

    for (const group of socketGroups) {
      const links = group.split('-').length;
      maxLinks = Math.max(maxLinks, links);
    }

    return maxLinks;
  }

  /**
   * Estimate item cost based on properties
   */
  private estimateItemCost(item: PoBItem): number {
    let baseCost = 1;

    // Rarity multiplier
    if (item.rarity === 'Unique') baseCost = 10;
    if (item.rarity === 'Rare') baseCost = 5;

    // Mod multiplier
    baseCost += item.requiredMods.length * 20;
    baseCost += item.optionalMods.length * 5;

    // Links multiplier
    if (item.links) {
      if (item.links === 6) baseCost *= 50;
      else if (item.links === 5) baseCost *= 10;
      else if (item.links === 4) baseCost *= 2;
    }

    return Math.max(baseCost, 1);
  }

  /**
   * Identify notable keystones from passive tree nodes
   */
  private identifyKeystones(nodes: string[]): string[] {
    // Common keystone node IDs (simplified - real ones are more complex)
    const keystoneMap: Record<string, string> = {
      '26725': 'Chaos Inoculation',
      '11150': 'Resolute Technique',
      '32763': 'Vaal Pact',
      '6230': 'Acrobatics',
      '61834': 'Blood Magic',
      '36949': 'Eldritch Battery',
      '54307': 'Ghost Reaver',
      '2311': 'Point Blank',
      '18436': 'Iron Reflexes',
      '33631': 'Unwavering Stance'
    };

    const foundKeystones: string[] = [];
    for (const node of nodes) {
      if (keystoneMap[node]) {
        foundKeystones.push(keystoneMap[node]);
      }
    }

    return foundKeystones;
  }

  /**
   * Generate crafting recommendations for missing/upgradeable items
   */
  private generateCraftingRecommendations(items: PoBItem[]): Array<any> {
    const recommendations: Array<any> = [];

    for (const item of items) {
      // Only recommend crafting for rare items with specific mods
      if (item.rarity === 'Rare' && item.requiredMods.length > 0) {
        recommendations.push({
          slot: item.slot,
          baseItem: item.type,
          desiredMods: item.requiredMods,
          craftingMethod: this.suggestCraftingMethod(item.requiredMods.length),
          estimatedCost: item.estimatedCost * 0.6 // Crafting usually cheaper than buying
        });
      }
    }

    return recommendations;
  }

  /**
   * Suggest crafting method based on number of desired mods
   */
  private suggestCraftingMethod(modCount: number): string {
    if (modCount === 1) return 'Essence + Bench Craft';
    if (modCount === 2) return 'Alteration + Regal + Bench Craft';
    if (modCount >= 3) return 'Chaos Spam or Fossil Crafting';
    return 'Chaos Orb Spam';
  }

  /**
   * Get simplified build summary for quick overview
   */
  async getBuildSummary(pobCode: string, league: string = 'Standard'): Promise<{
    name: string;
    cost: number;
    mainSkill: string;
    itemCount: number;
  }> {
    const build = await this.importBuild(pobCode, league);

    return {
      name: build.buildName,
      cost: build.totalCost,
      mainSkill: build.mainSkill,
      itemCount: build.items.length
    };
  }
}

// Singleton instance
export const pobImporter = new PoBImporter();
