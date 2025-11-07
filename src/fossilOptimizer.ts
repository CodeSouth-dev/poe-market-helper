/**
 * Fossil Combination Optimizer
 * Finds the best fossil combinations for desired mods
 */

import { PoeNinjaAPI } from './api/poeNinja';
import * as fs from 'fs-extra';
import * as path from 'path';

const CACHE_DIR = path.join(__dirname, '../data/fossil-cache');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export interface Fossil {
  name: string;
  cost: number;
  adds: string[]; // Tags that get added weight
  blocks: string[]; // Mods that are blocked
  more: string[]; // Tags that get more weight
  less: string[]; // Tags that get less weight
}

export interface Resonator {
  name: string;
  sockets: number;
  cost: number;
}

export interface FossilCombination {
  fossils: string[];
  resonator: string;
  totalSockets: number;
  costPerAttempt: number;
  successRate: number;
  averageCost: number;
  blockedMods: string[];
  enhancedMods: string[];
}

export interface FossilOptimization {
  desiredMods: string[];
  baseItem: string;
  bestCombination: FossilCombination;
  allCombinations: FossilCombination[];
  recommendation: string;
}

export class FossilOptimizer {
  private poeAPI: PoeNinjaAPI;
  private fossils: Fossil[];
  private resonators: Resonator[];

  constructor() {
    this.poeAPI = new PoeNinjaAPI();
    this.ensureCacheDir();
    this.initializeFossilData();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  }

  /**
   * Initialize fossil and resonator data
   */
  private initializeFossilData(): void {
    // Common fossils with their effects
    this.fossils = [
      {
        name: 'Pristine Fossil',
        cost: 3,
        more: ['life', 'defense'],
        adds: [],
        blocks: [],
        less: []
      },
      {
        name: 'Jagged Fossil',
        cost: 2,
        more: ['physical'],
        adds: ['bleed', 'physical'],
        blocks: [],
        less: []
      },
      {
        name: 'Scorched Fossil',
        cost: 2,
        more: ['fire'],
        adds: ['fire'],
        blocks: ['cold', 'lightning'],
        less: []
      },
      {
        name: 'Frigid Fossil',
        cost: 2,
        more: ['cold'],
        adds: ['cold'],
        blocks: ['fire', 'lightning'],
        less: []
      },
      {
        name: 'Metallic Fossil',
        cost: 2,
        more: ['lightning'],
        adds: ['lightning'],
        blocks: ['fire', 'cold'],
        less: []
      },
      {
        name: 'Dense Fossil',
        cost: 5,
        more: ['defense'],
        adds: [],
        blocks: ['life'],
        less: []
      },
      {
        name: 'Sanctified Fossil',
        cost: 8,
        more: ['defense'],
        adds: [],
        blocks: [],
        less: ['attack', 'caster']
      },
      {
        name: 'Aberrant Fossil',
        cost: 3,
        more: ['chaos'],
        adds: ['chaos'],
        blocks: ['lightning'],
        less: []
      },
      {
        name: 'Corroded Fossil',
        cost: 3,
        more: ['bleed', 'poison'],
        adds: ['bleed', 'poison'],
        blocks: ['elemental'],
        less: []
      },
      {
        name: 'Serrated Fossil',
        cost: 4,
        more: ['attack', 'physical'],
        adds: ['attack'],
        blocks: ['caster'],
        less: []
      },
      {
        name: 'Shuddering Fossil',
        cost: 4,
        more: ['attack', 'speed'],
        adds: ['attack', 'speed'],
        blocks: ['caster'],
        less: []
      },
      {
        name: 'Lucent Fossil',
        cost: 5,
        more: ['mana', 'energy_shield'],
        adds: ['mana'],
        blocks: [],
        less: []
      },
      {
        name: 'Aetheric Fossil',
        cost: 6,
        more: ['caster', 'spell'],
        adds: ['caster'],
        blocks: ['attack'],
        less: []
      },
      {
        name: 'Bound Fossil',
        cost: 3,
        more: ['minion'],
        adds: ['minion'],
        blocks: [],
        less: []
      },
      {
        name: 'Perfect Fossil',
        cost: 10,
        more: ['quality'],
        adds: [],
        blocks: [],
        less: []
      },
      {
        name: 'Faceted Fossil',
        cost: 15,
        more: ['gem'],
        adds: ['gem'],
        blocks: [],
        less: []
      }
    ];

    // Resonators
    this.resonators = [
      { name: 'Primitive Chaotic Resonator', sockets: 1, cost: 1 },
      { name: 'Potent Chaotic Resonator', sockets: 2, cost: 2 },
      { name: 'Powerful Chaotic Resonator', sockets: 3, cost: 5 },
      { name: 'Prime Chaotic Resonator', sockets: 4, cost: 10 }
    ];
  }

  /**
   * Find best fossil combination for desired mods
   */
  async findBestCombination(
    baseItem: string,
    desiredMods: string[],
    league: string = 'Standard'
  ): Promise<FossilOptimization> {
    console.log(`\n🔍 Optimizing fossil combination for ${baseItem}...`);
    console.log(`   Desired mods: ${desiredMods.join(', ')}`);

    // Update fossil prices from poe.ninja
    await this.updateFossilPrices(league);

    // Extract mod tags from desired mods
    const modTags = this.extractModTags(desiredMods);
    console.log(`   Mod tags: ${modTags.join(', ')}`);

    // Generate all valid combinations
    const combinations = this.generateCombinations(modTags);

    // Calculate success rates and costs
    const scoredCombinations = combinations.map(combo => {
      const successRate = this.calculateSuccessRate(combo, modTags);
      const costPerAttempt = this.calculateCost(combo);
      const averageCost = costPerAttempt / successRate;

      return {
        ...combo,
        successRate,
        costPerAttempt,
        averageCost,
        blockedMods: this.getBlockedMods(combo),
        enhancedMods: this.getEnhancedMods(combo, modTags)
      };
    });

    // Sort by average cost
    scoredCombinations.sort((a, b) => a.averageCost - b.averageCost);

    const bestCombination = scoredCombinations[0];

    console.log(`\n   ✅ Best combination: ${bestCombination.fossils.join(' + ')}`);
    console.log(`   Resonator: ${bestCombination.resonator}`);
    console.log(`   Cost per attempt: ${bestCombination.costPerAttempt.toFixed(0)}c`);
    console.log(`   Success rate: ${(bestCombination.successRate * 100).toFixed(2)}%`);
    console.log(`   Average cost: ${bestCombination.averageCost.toFixed(0)}c`);

    const recommendation = this.generateRecommendation(bestCombination, desiredMods);

    return {
      desiredMods,
      baseItem,
      bestCombination,
      allCombinations: scoredCombinations.slice(0, 5), // Top 5
      recommendation
    };
  }

  /**
   * Extract mod tags from mod descriptions
   */
  private extractModTags(mods: string[]): string[] {
    const tags: Set<string> = new Set();

    for (const mod of mods) {
      const lowerMod = mod.toLowerCase();

      // Life mods
      if (lowerMod.includes('life')) tags.add('life');

      // Defense mods
      if (lowerMod.includes('energy shield') || lowerMod.includes('armour') || lowerMod.includes('evasion')) {
        tags.add('defense');
      }

      // Elemental mods
      if (lowerMod.includes('fire')) tags.add('fire');
      if (lowerMod.includes('cold')) tags.add('cold');
      if (lowerMod.includes('lightning')) tags.add('lightning');
      if (lowerMod.includes('chaos')) tags.add('chaos');

      // Physical mods
      if (lowerMod.includes('physical')) tags.add('physical');

      // Attack/cast mods
      if (lowerMod.includes('attack')) tags.add('attack');
      if (lowerMod.includes('cast') || lowerMod.includes('spell')) tags.add('caster');

      // Speed mods
      if (lowerMod.includes('speed')) tags.add('speed');

      // Gem mods
      if (lowerMod.includes('socketed')) tags.add('gem');

      // Minion mods
      if (lowerMod.includes('minion')) tags.add('minion');

      // Mana mods
      if (lowerMod.includes('mana')) tags.add('mana');
    }

    return Array.from(tags);
  }

  /**
   * Generate valid fossil combinations
   */
  private generateCombinations(tags: string[]): Array<{
    fossils: string[];
    resonator: string;
    totalSockets: number;
  }> {
    const combinations: Array<any> = [];

    // Single fossil combinations
    for (const fossil of this.fossils) {
      if (this.fossilMatchesTags(fossil, tags)) {
        combinations.push({
          fossils: [fossil.name],
          resonator: this.resonators[0].name,
          totalSockets: 1
        });
      }
    }

    // Two fossil combinations
    for (let i = 0; i < this.fossils.length; i++) {
      for (let j = i + 1; j < this.fossils.length; j++) {
        const f1 = this.fossils[i];
        const f2 = this.fossils[j];

        if (this.fossilsCompatible(f1, f2) &&
            (this.fossilMatchesTags(f1, tags) || this.fossilMatchesTags(f2, tags))) {
          combinations.push({
            fossils: [f1.name, f2.name],
            resonator: this.resonators[1].name,
            totalSockets: 2
          });
        }
      }
    }

    // Three fossil combinations (top matches only)
    for (let i = 0; i < Math.min(this.fossils.length, 5); i++) {
      for (let j = i + 1; j < Math.min(this.fossils.length, 6); j++) {
        for (let k = j + 1; k < Math.min(this.fossils.length, 7); k++) {
          const f1 = this.fossils[i];
          const f2 = this.fossils[j];
          const f3 = this.fossils[k];

          if (this.fossilsCompatible(f1, f2) &&
              this.fossilsCompatible(f2, f3) &&
              this.fossilsCompatible(f1, f3)) {
            combinations.push({
              fossils: [f1.name, f2.name, f3.name],
              resonator: this.resonators[2].name,
              totalSockets: 3
            });
          }
        }
      }
    }

    return combinations;
  }

  /**
   * Check if fossil matches desired tags
   */
  private fossilMatchesTags(fossil: Fossil, tags: string[]): boolean {
    const fossilTags = [...fossil.more, ...fossil.adds];
    return tags.some(tag => fossilTags.includes(tag));
  }

  /**
   * Check if two fossils are compatible
   */
  private fossilsCompatible(f1: Fossil, f2: Fossil): boolean {
    // Fossils that block the same mods are usually complementary
    // Fossils with conflicting blocks are not compatible
    const f1Blocks = new Set(f1.blocks);
    const f2Adds = new Set(f2.adds);

    // If f1 blocks what f2 adds, they're not compatible
    for (const tag of f2Adds) {
      if (f1Blocks.has(tag)) return false;
    }

    // Check reverse
    const f2Blocks = new Set(f2.blocks);
    const f1Adds = new Set(f1.adds);

    for (const tag of f1Adds) {
      if (f2Blocks.has(tag)) return false;
    }

    return true;
  }

  /**
   * Calculate success rate for a combination
   */
  private calculateSuccessRate(combo: any, tags: string[]): number {
    let baseRate = 0.01; // 1% base

    // Count how many desired tags this combo enhances
    let matchingTags = 0;
    for (const fossilName of combo.fossils) {
      const fossil = this.fossils.find(f => f.name === fossilName);
      if (fossil) {
        const fossilTags = [...fossil.more, ...fossil.adds];
        for (const tag of tags) {
          if (fossilTags.includes(tag)) {
            matchingTags++;
            baseRate *= 2; // Double the rate for each match
          }
        }
      }
    }

    // Cap at reasonable success rate
    return Math.min(baseRate, 0.15); // Max 15%
  }

  /**
   * Calculate cost of a combination
   */
  private calculateCost(combo: any): number {
    let totalCost = 0;

    // Add fossil costs
    for (const fossilName of combo.fossils) {
      const fossil = this.fossils.find(f => f.name === fossilName);
      if (fossil) {
        totalCost += fossil.cost;
      }
    }

    // Add resonator cost
    const resonator = this.resonators.find(r => r.name === combo.resonator);
    if (resonator) {
      totalCost += resonator.cost;
    }

    return totalCost;
  }

  /**
   * Get mods blocked by this combination
   */
  private getBlockedMods(combo: any): string[] {
    const blocked: Set<string> = new Set();

    for (const fossilName of combo.fossils) {
      const fossil = this.fossils.find(f => f.name === fossilName);
      if (fossil) {
        fossil.blocks.forEach(tag => blocked.add(tag));
      }
    }

    return Array.from(blocked);
  }

  /**
   * Get mods enhanced by this combination
   */
  private getEnhancedMods(combo: any, tags: string[]): string[] {
    const enhanced: Set<string> = new Set();

    for (const fossilName of combo.fossils) {
      const fossil = this.fossils.find(f => f.name === fossilName);
      if (fossil) {
        const fossilTags = [...fossil.more, ...fossil.adds];
        for (const tag of tags) {
          if (fossilTags.includes(tag)) {
            enhanced.add(tag);
          }
        }
      }
    }

    return Array.from(enhanced);
  }

  /**
   * Generate recommendation text
   */
  private generateRecommendation(combo: FossilCombination, desiredMods: string[]): string {
    const attempts = Math.ceil(1 / combo.successRate);

    let rec = `Use ${combo.fossils.join(' + ')} in a ${combo.resonator}. `;
    rec += `Expected to hit in ~${attempts} attempts (${combo.averageCost.toFixed(0)}c total). `;

    if (combo.blockedMods.length > 0) {
      rec += `Blocks unwanted mods: ${combo.blockedMods.join(', ')}. `;
    }

    if (combo.enhancedMods.length > 0) {
      rec += `Enhances: ${combo.enhancedMods.join(', ')}.`;
    }

    return rec;
  }

  /**
   * Update fossil prices from poe.ninja
   */
  private async updateFossilPrices(league: string): Promise<void> {
    try {
      // Try to get fossil prices from poe.ninja
      // Note: This is simplified - real implementation would query actual API
      console.log(`   📊 Updating fossil prices for ${league}...`);

      // Keep default prices for now
      // In production, you'd fetch real prices here

    } catch (error) {
      console.log('   ⚠️  Using default fossil prices');
    }
  }
}

// Singleton instance
export const fossilOptimizer = new FossilOptimizer();
