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
import { getCurrencyPriceService } from './services/currencyPriceService';
import { getCraftingDataLoader } from './api/craftingData';
import { validateCraftingGoal, formatValidationResult } from './utils/validators';
import {
  METHOD_SCORING_WEIGHTS,
  DIFFICULTY_SCORES,
  SOURCE_SCORES,
  BUDGET_TIERS,
  RECOMBINATOR_COSTS,
} from './config/craftingConstants';

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

  // Crafting goal details
  baseItem?: string;
  itemLevel?: number;
  itemClass?: string;
  desiredMods?: string[];
  recommendedItemLevel?: number; // Calculated minimum ilvl for desired mods
  itemLevelBreakdown?: Array<{mod: string, minLevel: number}>; // Show which mods need which ilvl

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
  private currencyService = getCurrencyPriceService();
  private dataLoader = getCraftingDataLoader();

  /**
   * Get the optimal crafting strategy for a given goal
   */
  async getOptimalStrategy(goal: CraftingGoal): Promise<OptimizedStrategy> {
    // Validate input
    const validation = validateCraftingGoal(goal);
    if (!validation.isValid) {
      throw new Error(`Invalid crafting goal:\n${formatValidationResult(validation)}`);
    }

    // Load currency prices for cost calculation
    await this.currencyService.loadPrices(goal.league);

    // Load mod data and calculate minimum item level
    await this.dataLoader.loadAll();
    const { recommendedItemLevel, itemLevelBreakdown } = this.calculateMinimumItemLevel(goal);

    // Update goal with recommended ilvl if user's input is lower
    if (recommendedItemLevel > goal.itemLevel) {
      goal.itemLevel = recommendedItemLevel;
    }

    // Gather all available methods
    const allMethods = await this.gatherAllMethods(goal);

    // Score and rank methods
    const rankedMethods = this.rankMethods(allMethods, goal);

    // Select the best method
    const bestMethod = rankedMethods[0];

    // Build the optimized strategy
    const strategy = await this.buildStrategy(bestMethod, goal, recommendedItemLevel, itemLevelBreakdown);

    // Add alternative methods
    strategy.alternativeMethods = await Promise.all(
      rankedMethods.slice(1, 4).map(m => this.buildStrategy(m, goal, recommendedItemLevel, itemLevelBreakdown))
    );

    // Add recombinator option if risk mode is enabled
    if (goal.riskMode) {
      strategy.recombinatorOption = await this.generateRecombinatorStrategy(goal);
    }

    return strategy;
  }

  /**
   * Load real-time currency prices
   * Now handled by centralized currency service
   */
  private async loadCurrencyPrices(league: string) {
    // Currency prices are loaded via centralized service in getOptimalStrategy
    // This method kept for backward compatibility
  }

  /**
   * Calculate minimum item level required for desired mods
   */
  private calculateMinimumItemLevel(goal: CraftingGoal): {
    recommendedItemLevel: number;
    itemLevelBreakdown: Array<{mod: string, minLevel: number}>;
  } {
    const breakdown: Array<{mod: string, minLevel: number}> = [];
    let maxLevel = 1;

    // Try to find mods that match the desired mod names
    for (const desiredMod of goal.desiredMods) {
      // Search for mods by name
      const matchingMods = this.dataLoader.searchMods(desiredMod, goal.itemClass);

      if (matchingMods.length > 0) {
        // Get the highest tier (lowest required level) version of this mod
        // Sort by required_level descending to get the best (highest tier) version first
        const sortedMods = matchingMods
          .filter(m => m.required_level > 0)
          .sort((a, b) => b.required_level - a.required_level);

        if (sortedMods.length > 0) {
          const bestMod = sortedMods[0];
          breakdown.push({
            mod: desiredMod,
            minLevel: bestMod.required_level
          });

          if (bestMod.required_level > maxLevel) {
            maxLevel = bestMod.required_level;
          }
        }
      }
    }

    return {
      recommendedItemLevel: maxLevel,
      itemLevelBreakdown: breakdown
    };
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

    // Recombinator - available as a regular strategy
    // Adjust difficulty and description based on budget
    const isHighBudget = goal.budget > 500;
    const isMidBudget = goal.budget >= 100 && goal.budget <= 500;

    if (goal.desiredMods.length >= 2) {
      methods.push({
        name: isHighBudget ? 'Recombinator (High-End)' : 'Recombinator Crafting',
        source: 'recombinator',
        category: isMidBudget ? 'Intermediate' : 'Advanced',
        description: isHighBudget
          ? 'Combine two items to create mirror-tier results with impossible mod combinations'
          : 'Combine two items with different mod pools to create a better item',
        steps: [
          'Craft or buy first base with half of your desired mods',
          'Craft or buy second base with the other half of desired mods',
          'Ensure both items are same base type and similar item levels',
          'Use Recombinator to combine both items',
          'Result randomly combines mods from both - may need multiple attempts',
          isHighBudget ? 'Can create impossible combinations worth multiple divines' : 'Finish with bench crafts if needed'
        ],
        difficulty: isHighBudget ? 'expert' : isMidBudget ? 'advanced' : 'intermediate',
        estimatedCost: isHighBudget ? 'very-high' : isMidBudget ? 'high' : 'medium'
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

    // Budget alignment (weighted)
    const estimatedCost = this.estimateCost(method);
    const budgetScore = estimatedCost > goal.budget
      ? -50 // Penalize if over budget
      : estimatedCost < goal.budget * 0.3
        ? 20 // Bonus for efficiency
        : 0;
    score += budgetScore * METHOD_SCORING_WEIGHTS.BUDGET_ALIGNMENT;

    // Difficulty alignment (weighted)
    const difficultyScore = DIFFICULTY_SCORES[method.difficulty.toUpperCase()] || 0;
    if (method.difficulty === 'expert' && goal.budget < BUDGET_TIERS.LOW) {
      score -= 30; // Extra penalty for expert methods with low budget
    }
    score += difficultyScore * METHOD_SCORING_WEIGHTS.DIFFICULTY_FIT;

    // Source quality (weighted)
    const sourceScore = SOURCE_SCORES[method.source.toUpperCase()] || 0;
    score += sourceScore * METHOD_SCORING_WEIGHTS.SOURCE_CREDIBILITY;

    // Mod alignment (weighted) - check if method targets desired mods
    const methodText = (method.name + ' ' + method.description + ' ' + (method.steps?.join(' ') || '')).toLowerCase();
    let modMatchScore = 0;
    goal.desiredMods.forEach(mod => {
      if (methodText.includes(mod.toLowerCase())) {
        modMatchScore += 20;
      }
    });
    score += modMatchScore * METHOD_SCORING_WEIGHTS.MOD_TARGETING;

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
        return value * this.currencyService.getPrice('Divine Orb');
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
  private async buildStrategy(
    method: any,
    goal: CraftingGoal,
    recommendedItemLevel: number,
    itemLevelBreakdown: Array<{mod: string, minLevel: number}>
  ): Promise<OptimizedStrategy> {
    const estimatedCost = this.estimateCost(method);
    const successRate = this.estimateSuccessRate(method);

    // Add item level requirement if specified
    const requirements = [...(method.requirements || [])];
    if (goal.itemLevel && goal.itemLevel > 1) {
      requirements.unshift(`${goal.baseItem} base with item level ${goal.itemLevel}+ (Check trade sites for correct ilvl!)`);
    } else {
      requirements.unshift(`${goal.baseItem} base item`);
    }

    // Add item level note to first step if not already present
    const steps = [...(method.steps || [])];
    if (steps.length > 0 && goal.itemLevel && goal.itemLevel > 1) {
      const firstStep = steps[0];
      if (!firstStep.toLowerCase().includes('ilvl') && !firstStep.toLowerCase().includes('item level')) {
        steps[0] = `Obtain a ${goal.baseItem} with ilvl ${goal.itemLevel}+ from trade (search for "ilvl:${goal.itemLevel}" on trade sites)`;
      }
    }

    // Add tips about item level if we calculated it from mods
    const tips = [...(method.tips || [])];
    if (recommendedItemLevel > 1 && itemLevelBreakdown.length > 0) {
      tips.unshift(`Item level ${recommendedItemLevel}+ required for highest tier mods (calculated from your desired mods)`);
    }

    return {
      method: method.name,
      source: method.source,
      difficulty: method.difficulty || 'intermediate',
      steps,
      estimatedCost,
      successRate,
      timeToComplete: this.estimateTime(method),
      requirements,
      tips,
      warnings: method.warnings || [],
      profitPotential: this.estimateProfit(method, goal),
      riskLevel: this.assessRiskLevel(method),
      // Include crafting goal details
      baseItem: goal.baseItem,
      itemLevel: goal.itemLevel,
      itemClass: goal.itemClass,
      desiredMods: goal.desiredMods,
      recommendedItemLevel,
      itemLevelBreakdown
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
    // Recombinators have varying risk based on difficulty/budget
    if (method.source === 'recombinator') {
      if (method.difficulty === 'expert') return 'extreme';
      if (method.difficulty === 'advanced') return 'high';
      return 'moderate'; // Intermediate recombinator use
    }
    if (method.difficulty === 'expert') return 'high';
    if (method.difficulty === 'advanced') return 'moderate';
    return 'safe';
  }

  /**
   * Generate recombinator strategy (adapts to budget and risk mode)
   */
  private async generateRecombinatorStrategy(goal: CraftingGoal): Promise<RecombinatorStrategy> {
    const recombPrice = RECOMBINATOR_COSTS.BASE_COST;
    const isHighBudget = goal.budget > 500;
    const baseCost = isHighBudget ? 300 : 100; // Higher base cost for expensive items
    const totalCost = baseCost + recombPrice;

    const riskLevel: 'high' | 'extreme' = isHighBudget ? 'extreme' : 'high';
    const successRate = isHighBudget ? 0.2 : 0.3; // Lower success for complex combinations
    const profitMultiplier = isHighBudget ? 15 : 6; // Higher profit potential for expensive items

    return {
      name: isHighBudget ? `Recombinator Elite ${goal.itemClass}` : `Recombinator ${goal.itemClass}`,
      description: isHighBudget
        ? `Combine two ${goal.itemClass} items to create mirror-tier results with impossible mod combinations`
        : `Combine two ${goal.itemClass} items to merge different mod pools into one powerful item`,
      steps: [
        `Step 1: Craft or buy first ${goal.baseItem} (ilvl ${goal.itemLevel}+) with ${goal.desiredMods.slice(0, Math.ceil(goal.desiredMods.length / 2)).join(' + ')}`,
        `Step 2: Craft or buy second ${goal.baseItem} (ilvl ${goal.itemLevel}+) with ${goal.desiredMods.slice(Math.ceil(goal.desiredMods.length / 2)).join(' + ')}`,
        `Step 3: Ensure both items are ilvl ${goal.itemLevel}+ and same base type (search "ilvl:${goal.itemLevel}" on trade)`,
        'Step 4: Match quality and links on both items for best results',
        'Step 5: Use Recombinator to combine them',
        'Step 6: Result will randomly combine mods from both items',
        isHighBudget
          ? 'Step 7: Can create impossible combinations worth divines - consider selling if hit'
          : 'Step 7: If successful, finish with bench crafts; if failed, repeat or try simpler method'
      ],
      requirements: [
        `Two ${goal.baseItem} bases (ilvl ${goal.itemLevel}+)`,
        'Recombinator (from trade or Sentinel league content)',
        'Crafting materials for both bases (essences, fossils, or harvest crafts)',
        isHighBudget
          ? 'Large budget for multiple attempts - expect 3-5 tries on average'
          : 'Budget for 2-3 attempts recommended'
      ],
      baseItems: {
        item1: `${goal.baseItem} with prefixes`,
        item2: `${goal.baseItem} with suffixes`,
        combinedResult: isHighBudget
          ? `Mirror-tier ${goal.baseItem} with impossible mods`
          : `Powerful ${goal.baseItem} with merged mods`
      },
      estimatedCost: totalCost,
      successRate,
      profitPotential: totalCost * profitMultiplier,
      riskLevel,
      warnings: isHighBudget
        ? [
            '⚠️ EXTREME RISK: Recombinators can brick both items (total loss)',
            '⚠️ Success rate is low - budget for multiple attempts',
            '⚠️ Very expensive - only for high-value crafting projects',
            '⚠️ Consider buying the finished item instead if available on trade',
            '⚠️ Practice mechanics on cheap items first'
          ]
        : [
            '⚠️ Recombinators can brick both items if result is bad',
            '⚠️ Result is random - may need 2-3 attempts',
            '⚠️ Make sure both bases have good mods before combining',
            '⚠️ Can waste currency if unlucky - have backup plan'
          ],
      tips: isHighBudget
        ? [
            '💡 Use items with EXACT mods you want to maximize chance of keeping them',
            '💡 Match item levels, quality, and links on both items',
            '💡 Higher tier mods have better chance to transfer',
            '💡 Can create impossible-to-craft combinations',
            '💡 Best for mirror-tier items worth multiple divines',
            '💡 Research recombinator mechanics thoroughly first'
          ]
        : [
            '💡 Split your desired mods between two items for best results',
            '💡 Use cheaper crafting methods (essences) on both bases',
            '💡 Match item levels for consistent mod tiers',
            '💡 Can combine prefixes from one item with suffixes from another',
            '💡 Great for mid-tier crafting when you need 4-5 specific mods',
            '💡 Test on cheap bases first to understand the mechanics'
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
