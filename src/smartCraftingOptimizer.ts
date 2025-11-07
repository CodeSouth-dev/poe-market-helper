/**
 * Smart Crafting Optimizer
 *
 * Analyzes user's crafting goals and automatically selects the most optimized
 * strategy from all available guides (Pohx, MaxRoll, and built-in methods).
 *
 * Features:
 * - Automatic method selection based on budget, item type, and desired mods
 * - Cost calculation using real-time currency pricing
 * - Risk mode: Suggests high-risk, high-reward strategies like recombinators
 * - Profit projection for elite item crafting
 */

import { pohxCraftingScraper, CraftingGuide } from './pohxCraftingScraper';
import { maxRollCraftingScraper, MaxRollCraftingMethod } from './maxRollCraftingScraper';
import { currencyMaterialsScraper } from './currencyMaterialsScraper';

export interface CraftingGoal {
  baseItem: string;
  itemLevel: number;
  itemClass: string;
  desiredMods: string[];
  budget: number; // in chaos
  league: string;
  riskMode?: boolean; // Enable high-risk strategies
}

export interface OptimizedStrategy {
  method: string;
  source: 'pohx' | 'maxroll' | 'advanced' | 'recombinator';
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  steps: string[];
  estimatedCost: number;
  successRate: number;
  timeToComplete: string;
  requirements: string[];
  tips: string[];
  warnings: string[];
  profitPotential?: number; // Expected profit in chaos
  riskLevel?: 'safe' | 'moderate' | 'high' | 'extreme';

  // Advanced options
  alternativeMethods?: OptimizedStrategy[];
  recombinatorOption?: RecombinatorStrategy;
}

export interface RecombinatorStrategy {
  name: string;
  description: string;
  steps: string[];
  requirements: string[];
  baseItems: {
    item1: string;
    item2: string;
    combinedResult: string;
  };
  estimatedCost: number;
  successRate: number;
  profitPotential: number;
  riskLevel: 'high' | 'extreme';
  warnings: string[];
  tips: string[];
}

export class SmartCraftingOptimizer {
  private currencyPrices: Map<string, number> = new Map();

  /**
   * Get the optimal crafting strategy for a given goal
   */
  async getOptimalStrategy(goal: CraftingGoal): Promise<OptimizedStrategy> {
    // Load currency prices for cost calculation
    await this.loadCurrencyPrices(goal.league);

    // Gather all available methods
    const allMethods = await this.gatherAllMethods(goal);

    // Score and rank methods
    const rankedMethods = this.rankMethods(allMethods, goal);

    // Select the best method
    const bestMethod = rankedMethods[0];

    // Build the optimized strategy
    const strategy = await this.buildStrategy(bestMethod, goal);

    // Add alternative methods
    strategy.alternativeMethods = await Promise.all(
      rankedMethods.slice(1, 4).map(m => this.buildStrategy(m, goal))
    );

    // Add recombinator option if risk mode is enabled
    if (goal.riskMode) {
      strategy.recombinatorOption = await this.generateRecombinatorStrategy(goal);
    }

    return strategy;
  }

  /**
   * Load real-time currency prices
   */
  private async loadCurrencyPrices(league: string) {
    try {
      const pricing = await currencyMaterialsScraper.scrapeAllPricing(league);

      // Map common currency names to prices
      const allItems = [
        ...pricing.currency,
        ...pricing.fossils,
        ...pricing.essences,
        ...pricing.resonators,
        ...pricing.scarabs,
        ...pricing.oils,
        ...pricing.catalysts,
        ...pricing.vials
      ];

      allItems.forEach(item => {
        this.currencyPrices.set(item.name.toLowerCase(), item.chaosValue);
      });

      // Add common aliases
      this.currencyPrices.set('chaos', 1);
      this.currencyPrices.set('divine', this.currencyPrices.get('divine orb') || 200);
      this.currencyPrices.set('exalted', this.currencyPrices.get('exalted orb') || 20);
      this.currencyPrices.set('vaal', this.currencyPrices.get('vaal orb') || 1.5);
      this.currencyPrices.set('alchemy', this.currencyPrices.get('orb of alchemy') || 0.1);
      this.currencyPrices.set('alteration', this.currencyPrices.get('orb of alteration') || 0.05);
      this.currencyPrices.set('chaos orb', 1);

    } catch (error) {
      console.error('Failed to load currency prices:', error);
    }
  }

  /**
   * Gather all available crafting methods from all sources
   */
  private async gatherAllMethods(goal: CraftingGoal): Promise<any[]> {
    const methods: any[] = [];

    // Get Pohx guides
    try {
      const pohxGuides = await pohxCraftingScraper.searchGuides(goal.itemClass);
      methods.push(...pohxGuides.map(g => ({ ...g, source: 'pohx' })));
    } catch (error) {
      console.error('Failed to load Pohx guides:', error);
    }

    // Get MaxRoll methods
    try {
      const maxRollMethods = await maxRollCraftingScraper.searchMethods(goal.itemClass);
      methods.push(...maxRollMethods.map(m => ({ ...m, source: 'maxroll' })));
    } catch (error) {
      console.error('Failed to load MaxRoll methods:', error);
    }

    // Add built-in advanced methods
    methods.push(...this.getBuiltInMethods(goal));

    return methods;
  }

  /**
   * Get built-in advanced crafting methods
   */
  private getBuiltInMethods(goal: CraftingGoal): any[] {
    const methods: any[] = [];

    // Essence spam method
    methods.push({
      name: 'Essence Spam',
      source: 'advanced',
      category: 'Basic',
      description: 'Use essences to guarantee specific mods, then craft the rest',
      steps: [
        'Buy the appropriate essence for your desired mod',
        'Spam essences on the base until you hit good secondary mods',
        'Use bench crafts to fill remaining affixes',
        'Consider using harvest reforges for targeted changes'
      ],
      difficulty: 'beginner',
      estimatedCost: 'low'
    });

    // Fossil crafting
    methods.push({
      name: 'Fossil Crafting',
      source: 'advanced',
      category: 'Intermediate',
      description: 'Use fossils to weight specific mod groups',
      steps: [
        'Identify which fossils weight your desired mods',
        'Buy fossils and appropriate resonators',
        'Spam fossils until you hit your target mods',
        'Finish with bench crafts or harvests'
      ],
      difficulty: 'intermediate',
      estimatedCost: 'medium'
    });

    // Harvest crafting
    methods.push({
      name: 'Harvest Reforge',
      source: 'advanced',
      category: 'Intermediate',
      description: 'Use harvest reforges for targeted crafting',
      steps: [
        'Use harvest "Reforge with X mod" to guarantee mod types',
        'Combine with "Keep Prefix/Suffix" for advanced control',
        'Use "Augment" crafts when available for precise targeting',
        'Finish with metacrafting if needed'
      ],
      difficulty: 'intermediate',
      estimatedCost: 'medium'
    });

    // Metacrafting
    if (goal.budget > 200) {
      methods.push({
        name: 'Metacrafting',
        source: 'advanced',
        category: 'Advanced',
        description: 'Use metamods to protect valuable affixes',
        steps: [
          'Roll desired prefixes/suffixes using alt-spam or fossils',
          'Craft "Cannot Roll Attack Mods" or similar metamod (2 divine)',
          'Use exalted orbs or harvest augments to add mods',
          'Remove metamod and finish item with bench crafts'
        ],
        difficulty: 'advanced',
        estimatedCost: 'high'
      });
    }

    // Recombinator (if risk mode)
    if (goal.riskMode) {
      methods.push({
        name: 'Recombinator Crafting',
        source: 'recombinator',
        category: 'Advanced',
        description: 'Combine two items to create a powerful result',
        steps: [
          'Craft or buy two items with desired mod pools',
          'Use recombinator to combine them',
          'Result has chance to combine best mods from both items',
          'High risk but can create mirror-tier items'
        ],
        difficulty: 'expert',
        estimatedCost: 'very-high'
      });
    }

    return methods;
  }

  /**
   * Rank methods based on cost, success rate, and goal alignment
   */
  private rankMethods(methods: any[], goal: CraftingGoal): any[] {
    return methods
      .map(method => {
        const score = this.scoreMethod(method, goal);
        return { ...method, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Score a method based on how well it matches the goal
   */
  private scoreMethod(method: any, goal: CraftingGoal): number {
    let score = 100;

    // Budget alignment
    const estimatedCost = this.estimateCost(method);
    if (estimatedCost > goal.budget) {
      score -= 50; // Penalize if over budget
    } else if (estimatedCost < goal.budget * 0.3) {
      score += 20; // Bonus for efficiency
    }

    // Difficulty alignment (prefer easier methods for beginners)
    if (method.difficulty === 'beginner') score += 10;
    if (method.difficulty === 'expert' && goal.budget < 500) score -= 30;

    // Source quality
    if (method.source === 'pohx') score += 15; // Pohx guides are well-tested
    if (method.source === 'maxroll') score += 10;

    // Mod alignment (check if method targets desired mods)
    const methodText = (method.name + ' ' + method.description + ' ' + (method.steps?.join(' ') || '')).toLowerCase();
    goal.desiredMods.forEach(mod => {
      if (methodText.includes(mod.toLowerCase())) {
        score += 20;
      }
    });

    // Risk mode bonus
    if (goal.riskMode && method.source === 'recombinator') {
      score += 30;
    }

    return score;
  }

  /**
   * Estimate the cost of a crafting method
   */
  private estimateCost(method: any): number {
    if (!method.estimatedCost) return 50; // Default

    const costStr = method.estimatedCost.toLowerCase();

    // Try to extract numeric cost
    const match = costStr.match(/(\d+(?:,\d+)?)\s*(chaos|divine|c|d)/);
    if (match) {
      const value = parseInt(match[1].replace(',', ''));
      const unit = match[2];

      if (unit.startsWith('d')) {
        return value * (this.currencyPrices.get('divine') || 200);
      }
      return value;
    }

    // Budget categories
    if (costStr.includes('low') || costStr.includes('cheap') || costStr.includes('budget')) return 20;
    if (costStr.includes('medium') || costStr.includes('moderate')) return 100;
    if (costStr.includes('high') || costStr.includes('expensive')) return 300;
    if (costStr.includes('very high') || costStr.includes('mirror')) return 1000;

    return 50;
  }

  /**
   * Build a complete strategy from a method
   */
  private async buildStrategy(method: any, goal: CraftingGoal): Promise<OptimizedStrategy> {
    const estimatedCost = this.estimateCost(method);
    const successRate = this.estimateSuccessRate(method);

    return {
      method: method.name,
      source: method.source,
      difficulty: method.difficulty || 'intermediate',
      steps: method.steps || [],
      estimatedCost,
      successRate,
      timeToComplete: this.estimateTime(method),
      requirements: method.requirements || [],
      tips: method.tips || [],
      warnings: method.warnings || [],
      profitPotential: this.estimateProfit(method, goal),
      riskLevel: this.assessRiskLevel(method)
    };
  }

  /**
   * Estimate success rate for a method
   */
  private estimateSuccessRate(method: any): number {
    if (method.difficulty === 'beginner') return 0.8;
    if (method.difficulty === 'intermediate') return 0.6;
    if (method.difficulty === 'advanced') return 0.4;
    if (method.difficulty === 'expert') return 0.2;
    return 0.5;
  }

  /**
   * Estimate time to complete
   */
  private estimateTime(method: any): string {
    const stepCount = method.steps?.length || 5;

    if (stepCount <= 3) return '10-30 minutes';
    if (stepCount <= 6) return '30-60 minutes';
    if (stepCount <= 10) return '1-2 hours';
    return '2-4 hours';
  }

  /**
   * Estimate profit potential
   */
  private estimateProfit(method: any, goal: CraftingGoal): number {
    const cost = this.estimateCost(method);
    const baseValue = cost * 2; // Conservative 2x multiplier

    // Adjust based on difficulty (higher difficulty = higher potential profit)
    const difficultyMultiplier = {
      'beginner': 1.5,
      'intermediate': 2.5,
      'advanced': 4,
      'expert': 8
    };

    const multiplier = difficultyMultiplier[method.difficulty as keyof typeof difficultyMultiplier] || 2;
    return Math.round(cost * multiplier);
  }

  /**
   * Assess risk level
   */
  private assessRiskLevel(method: any): 'safe' | 'moderate' | 'high' | 'extreme' {
    if (method.source === 'recombinator') return 'extreme';
    if (method.difficulty === 'expert') return 'high';
    if (method.difficulty === 'advanced') return 'moderate';
    return 'safe';
  }

  /**
   * Generate recombinator strategy for high-risk crafting
   */
  private async generateRecombinatorStrategy(goal: CraftingGoal): Promise<RecombinatorStrategy> {
    const recombPrice = this.currencyPrices.get('recombinator') || 50;
    const baseCost = 100; // Cost to craft/buy the two base items
    const totalCost = baseCost + recombPrice;

    return {
      name: `Recombinator Elite ${goal.itemClass}`,
      description: `Combine two ${goal.itemClass} items to create a powerful result with your desired mods`,
      steps: [
        `Step 1: Craft or buy first ${goal.baseItem} with ${goal.desiredMods.slice(0, 2).join(' + ')}`,
        `Step 2: Craft or buy second ${goal.baseItem} with ${goal.desiredMods.slice(2, 4).join(' + ')}`,
        'Step 3: Ensure both items have same base type and similar item levels',
        'Step 4: Use Recombinator to combine them',
        'Step 5: Result will randomly combine mods from both items',
        'Step 6: If successful, finish with bench crafts or harvests',
        'Step 7: If failed, repeat process or try alternative method'
      ],
      requirements: [
        `Two ${goal.baseItem} bases (ilvl ${goal.itemLevel}+)`,
        'Recombinator (from Sentinel league or trade)',
        'Crafting materials for both bases (essences, fossils, or harvest crafts)',
        'Budget for multiple attempts (success rate varies)'
      ],
      baseItems: {
        item1: `${goal.baseItem} with prefixes`,
        item2: `${goal.baseItem} with suffixes`,
        combinedResult: `Elite ${goal.baseItem} with best mods from both`
      },
      estimatedCost: totalCost,
      successRate: 0.25, // 25% to get desired result
      profitPotential: totalCost * 10, // 10x potential if you hit jackpot
      riskLevel: 'extreme',
      warnings: [
        '⚠️ Recombinators can brick both items (total loss)',
        '⚠️ Result is random - you may need many attempts',
        '⚠️ Very expensive - only use with high-value bases',
        '⚠️ Consider buying the finished item instead if budget is limited'
      ],
      tips: [
        '💡 Use items with exact mods you want to maximize chance of keeping them',
        '💡 Match item levels and quality on both items',
        '💡 Higher tier mods have better chance to transfer',
        '💡 Can create impossible-to-craft combinations',
        '💡 Best for creating mirror-tier items worth multiple divines',
        '💡 Practice on cheap bases first to understand mechanics'
      ]
    };
  }

  /**
   * Get budget-specific recommendations
   */
  async getMethodsByBudget(
    itemClass: string,
    budget: number,
    league: string
  ): Promise<OptimizedStrategy[]> {
    const goal: CraftingGoal = {
      baseItem: 'Any',
      itemLevel: 86,
      itemClass,
      desiredMods: [],
      budget,
      league,
      riskMode: budget > 500 // Enable risk mode for high budgets
    };

    const allMethods = await this.gatherAllMethods(goal);
    const rankedMethods = this.rankMethods(allMethods, goal);

    return Promise.all(
      rankedMethods.slice(0, 5).map(m => this.buildStrategy(m, goal))
    );
  }

  /**
   * Quick recommendation based on item paste
   */
  async quickRecommendation(
    itemText: string,
    budget: number,
    league: string,
    riskMode: boolean = false
  ): Promise<OptimizedStrategy> {
    // Parse item from text
    const parsed = this.parseItemText(itemText);

    const goal: CraftingGoal = {
      baseItem: parsed.baseName,
      itemLevel: parsed.itemLevel,
      itemClass: parsed.itemClass,
      desiredMods: parsed.desiredMods,
      budget,
      league,
      riskMode
    };

    return this.getOptimalStrategy(goal);
  }

  /**
   * Parse item text to extract crafting goal
   */
  private parseItemText(itemText: string): {
    baseName: string;
    itemLevel: number;
    itemClass: string;
    desiredMods: string[];
  } {
    const lines = itemText.split('\n').map(l => l.trim());

    // Extract item level
    const ilvlMatch = itemText.match(/item level[:\s]+(\d+)/i);
    const itemLevel = ilvlMatch ? parseInt(ilvlMatch[1]) : 86;

    // Extract base name (usually first line)
    const baseName = lines[0] || 'Unknown Base';

    // Try to determine item class
    let itemClass = 'Unknown';
    if (itemText.match(/body armour|armour/i)) itemClass = 'Body Armour';
    else if (itemText.match(/helmet/i)) itemClass = 'Helmet';
    else if (itemText.match(/gloves/i)) itemClass = 'Gloves';
    else if (itemText.match(/boots/i)) itemClass = 'Boots';
    else if (itemText.match(/ring/i)) itemClass = 'Ring';
    else if (itemText.match(/amulet/i)) itemClass = 'Amulet';
    else if (itemText.match(/belt/i)) itemClass = 'Belt';

    // Extract mods (lines starting with +, %, or numeric values)
    const desiredMods = lines.filter(line =>
      line.match(/^[\+\-]?\d+/) || line.match(/^\d+%/)
    );

    return { baseName, itemLevel, itemClass, desiredMods };
  }
}

export const smartCraftingOptimizer = new SmartCraftingOptimizer();
