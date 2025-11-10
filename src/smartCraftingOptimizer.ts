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
import { poedbScraper } from './poedbScraper';
import { validateCraftingGoal, formatValidationResult } from './utils/validators';
import { craftOfExileSimulatorEnhanced } from './craftOfExileSimulatorEnhanced';
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

    // Calculate minimum item level using live PoEDB data
    const { recommendedIlvl, modDetails } = await poedbScraper.getBestIlvlForMods(
      goal.itemClass,
      goal.desiredMods
    );

    // Update goal with recommended ilvl if user's input is lower
    if (recommendedIlvl > goal.itemLevel) {
      goal.itemLevel = recommendedIlvl;
    }

    // Gather all available methods
    const allMethods = await this.gatherAllMethods(goal);

    // Score and rank methods (now async to fetch probabilities)
    const rankedMethods = await this.rankMethods(allMethods, goal);

    // Select the best method
    const bestMethod = rankedMethods[0];

    // Build the optimized strategy
    const strategy = await this.buildStrategy(bestMethod, goal, recommendedIlvl, modDetails);

    // Add alternative methods
    strategy.alternativeMethods = await Promise.all(
      rankedMethods.slice(1, 4).map(m => this.buildStrategy(m, goal, recommendedIlvl, modDetails))
    );

    // Add recombinator option if risk mode is enabled
    if (goal.riskMode) {
      strategy.recombinatorOption = await this.generateRecombinatorStrategy(goal);
    }

    return strategy;
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
   * Now async to fetch real probabilities from CraftOfExile
   */
  private async rankMethods(methods: any[], goal: CraftingGoal): Promise<any[]> {
    // Fetch probabilities for all methods in parallel
    const methodsWithProbabilities = await Promise.all(
      methods.map(async method => {
        const successRate = await this.getRealSuccessRate(method, goal);
        const estimatedCost = this.estimateCost(method);
        return { ...method, successRate, estimatedCost };
      })
    );

    // Score methods with real probabilities
    return methodsWithProbabilities
      .map(method => {
        const score = this.scoreMethod(method, goal);
        return { ...method, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Score a method based on how well it matches the goal
   * NOW INCLUDES SUCCESS RATE AND EXPECTED COST EFFICIENCY
   */
  private scoreMethod(method: any, goal: CraftingGoal): number {
    let score = 100;

    const estimatedCost = method.estimatedCost || this.estimateCost(method);
    const successRate = method.successRate || 0.5; // Default to 50% if not calculated
    const expectedCostPerSuccess = successRate > 0 ? estimatedCost / successRate : estimatedCost * 100;

    // 1. Budget alignment (25% weight) - Cost per attempt
    const budgetScore = estimatedCost > goal.budget
      ? -50 // Heavily penalize if over budget
      : estimatedCost < goal.budget * 0.3
        ? 30 // Bonus for efficiency
        : 0;
    score += budgetScore * METHOD_SCORING_WEIGHTS.BUDGET_ALIGNMENT;

    // 2. Success Rate (35% weight) - CRITICAL FACTOR
    // Higher success rate = higher score (0% to 100% maps to -40 to +40)
    const successRateScore = (successRate - 0.5) * 80; // Center around 50%
    score += successRateScore * METHOD_SCORING_WEIGHTS.SUCCESS_RATE;

    // 3. Expected Cost Efficiency (20% weight) - Real cost per success
    // Compare expected cost per success vs budget
    const efficiencyRatio = expectedCostPerSuccess / goal.budget;
    const efficiencyScore = efficiencyRatio > 1.5
      ? -40 // Very inefficient
      : efficiencyRatio > 1.0
        ? -20 // Over budget for success
        : efficiencyRatio < 0.5
          ? 30 // Very efficient
          : 10; // Acceptable
    score += efficiencyScore * METHOD_SCORING_WEIGHTS.EXPECTED_COST_EFFICIENCY;

    // 4. Difficulty alignment (10% weight)
    const difficultyScore = DIFFICULTY_SCORES[method.difficulty.toUpperCase()] || 0;
    if (method.difficulty === 'expert' && goal.budget < BUDGET_TIERS.LOW) {
      score -= 30; // Extra penalty for expert methods with low budget
    }
    score += difficultyScore * METHOD_SCORING_WEIGHTS.DIFFICULTY_FIT;

    // 5. Source quality (5% weight)
    const sourceScore = SOURCE_SCORES[method.source.toUpperCase()] || 0;
    score += sourceScore * METHOD_SCORING_WEIGHTS.SOURCE_CREDIBILITY;

    // 6. Mod alignment (5% weight) - check if method targets desired mods
    const methodText = (method.name + ' ' + method.description + ' ' + (method.steps?.join(' ') || '')).toLowerCase();
    let modMatchScore = 0;
    goal.desiredMods.forEach(mod => {
      if (methodText.includes(mod.toLowerCase())) {
        modMatchScore += 20;
      }
    });
    score += modMatchScore * METHOD_SCORING_WEIGHTS.MOD_TARGETING;

    // Risk mode bonus - slight boost for high-risk methods
    if (goal.riskMode && method.source === 'recombinator') {
      score += 15;
    }

    return score;
  }

  /**
   * Get real success rate from CraftOfExile simulator or probability calculator
   * This integrates live data into the ranking system
   */
  private async getRealSuccessRate(method: any, goal: CraftingGoal): Promise<number> {
    // If method already has a calculated success rate, use it
    if (method.successRate && method.successRate > 0) {
      return method.successRate;
    }

    try {
      // Map method names to crafting types for CraftOfExile
      const methodToCraftingType: Record<string, 'chaos' | 'alt-regal' | 'fossil' | 'essence' | 'harvest'> = {
        'Chaos Spam': 'chaos',
        'Alt-Regal': 'alt-regal',
        'Fossil': 'fossil',
        'Fossil Crafting': 'fossil',
        'Essence': 'essence',
        'Essence Spam': 'essence',
        'Harvest': 'harvest',
        'Harvest Reforge': 'harvest',
      };

      const craftingType = methodToCraftingType[method.name] || 'chaos';

      // Try to get probability from CraftOfExile simulator
      if (goal.desiredMods.length > 0 && goal.baseItem && goal.baseItem !== 'Any') {
        const { craftOfExileScraper } = await import('./craftOfExileScraper');

        const simulation = await craftOfExileScraper.simulateCrafting(
          goal.baseItem,
          goal.itemLevel,
          goal.desiredMods,
          craftingType
        );

        if (simulation.cheapestMethod && simulation.cheapestMethod.successRate > 0) {
          console.log(`   ✅ Got real success rate for ${method.name}: ${(simulation.cheapestMethod.successRate * 100).toFixed(2)}%`);
          return simulation.cheapestMethod.successRate;
        }
      }
    } catch (error) {
      console.log(`   ⚠️  CraftOfExile unavailable for ${method.name}, using fallback calculation`);
    }

    // Fallback: Use probability calculator for estimation
    try {
      if (goal.desiredMods.length > 0) {
        const { calculateSimpleModProbability } = await import('./utils/probabilityCalculator');
        const { poedbScraper } = await import('./poedbScraper');

        // Fetch available mods for the item class
        const modifierData = await poedbScraper.scrapeModifiers(goal.itemClass);

        if (modifierData && modifierData.length > 0) {
          // Convert ModifierData to Mod format expected by probability calculator
          const availableMods = modifierData.map(mod => ({
            name: mod.name,
            domain: mod.domain || 'item',
            generation_type: mod.generationType || 'prefix',
            required_level: mod.level || 1,
            type: mod.type,
            spawn_weights: mod.tiers.map(tier => ({
              tag: goal.itemClass,
              weight: tier.weight
            })),
            adds_tags: mod.tags || [],
            stats: [],
            is_essence_only: false
          }));

          // Convert desired mods to the format expected by probability calculator
          const desiredModsForCalc = goal.desiredMods.map(mod => ({
            name: mod,
            type: 'prefix' as const, // We'll try both prefix and suffix
          }));

          const result = calculateSimpleModProbability(
            desiredModsForCalc,
            availableMods,
            [goal.itemClass]
          );

          if (result.successRate > 0) {
            console.log(`   ✅ Calculated success rate for ${method.name}: ${(result.successRate * 100).toFixed(2)}%`);
            return result.successRate;
          }
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Probability calculator failed for ${method.name}`);
    }

    // Ultimate fallback: Use difficulty-based estimates
    const fallbackRates: Record<string, number> = {
      'beginner': 0.70,    // 70% - Easy methods have good success
      'intermediate': 0.45, // 45% - Moderate success
      'advanced': 0.25,     // 25% - Harder but possible
      'expert': 0.15,       // 15% - Very difficult
    };

    const fallbackRate = fallbackRates[method.difficulty?.toLowerCase()] || 0.40;
    console.log(`   ℹ️  Using difficulty-based estimate for ${method.name}: ${(fallbackRate * 100).toFixed(0)}%`);

    return fallbackRate;
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
   * Now uses real calculated success rates from CraftOfExile/probability calculator
   */
  private async buildStrategy(
    method: any,
    goal: CraftingGoal,
    recommendedIlvl?: number,
    modDetails?: Array<{mod: string, minLevel: number}>
  ): Promise<OptimizedStrategy> {
    const estimatedCost = method.estimatedCost || this.estimateCost(method);
    const successRate = method.successRate || await this.getRealSuccessRate(method, goal);
    const expectedCostPerSuccess = successRate > 0 ? estimatedCost / successRate : estimatedCost * 100;

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
    if (recommendedIlvl && recommendedIlvl > 1 && modDetails && modDetails.length > 0) {
      tips.unshift(`Item level ${recommendedIlvl}+ required for highest tier mods (scraped live from PoEDB)`);
    }

    // Add success rate and expected cost information
    if (successRate < 1.0) {
      const expectedAttempts = Math.ceil(1 / successRate);
      tips.unshift(`💰 Expected cost per success: ~${Math.round(expectedCostPerSuccess)}c (${expectedAttempts} attempts on average)`);
      tips.unshift(`🎯 Success rate: ${(successRate * 100).toFixed(1)}% per attempt${successRate < 0.5 ? ' - Consider alternatives if budget is tight' : ''}`);
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
      recommendedItemLevel: recommendedIlvl,
      itemLevelBreakdown: modDetails
    };
  }

  /**
   * Estimate success rate for a method
   * @deprecated Use getRealSuccessRate() instead for accurate probabilities
   * This method is kept for backward compatibility only
   */
  private estimateSuccessRate(method: any): number {
    if (method.difficulty === 'beginner') return 0.7;
    if (method.difficulty === 'intermediate') return 0.45;
    if (method.difficulty === 'advanced') return 0.25;
    if (method.difficulty === 'expert') return 0.15;
    return 0.4;
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
    const rankedMethods = await this.rankMethods(allMethods, goal);

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

  /**
   * Get complete crafting strategy using enhanced Craft of Exiles simulator
   * This returns PRACTICES (step-by-step) not just probabilities
   */
  async getDetailedCraftingStrategy(
    goal: CraftingGoal,
    blockedMods: string[] = []
  ): Promise<any> {
    console.log(`\n🎯 Getting detailed crafting strategy from Craft of Exiles simulator...`);

    // Validate input
    const validation = validateCraftingGoal(goal);
    if (!validation.isValid) {
      throw new Error(`Invalid crafting goal:\n${formatValidationResult(validation)}`);
    }

    // Load currency prices
    await this.currencyService.loadPrices(goal.league);

    // Get full strategy from enhanced simulator
    const strategy = await craftOfExileSimulatorEnhanced.getCraftingStrategy(
      goal.baseItem,
      goal.itemLevel,
      goal.desiredMods,
      blockedMods,
      {
        budget: goal.budget,
        allowMetacrafting: goal.budget > 200
      }
    );

    return strategy;
  }

  /**
   * Optimize crafting for a specific budget using Craft of Exiles simulator
   * Returns what's achievable within budget constraints
   */
  async optimizeCraftingForBudget(
    baseItem: string,
    itemLevel: number,
    desiredMods: string[],
    budget: number
  ): Promise<any> {
    console.log(`\n💰 Optimizing crafting for ${budget}c budget...`);

    const optimization = await craftOfExileSimulatorEnhanced.optimizeForBudget(
      baseItem,
      itemLevel,
      desiredMods,
      budget
    );

    return optimization;
  }

  /**
   * Get fossil combinations for mod blocking
   */
  async getFossilRecommendations(
    desiredMods: string[],
    blockedTags: string[]
  ): Promise<any> {
    console.log(`\n🔬 Finding optimal fossil combinations...`);

    const combinations = await craftOfExileSimulatorEnhanced.getFossilCombinations(
      desiredMods,
      blockedTags
    );

    return combinations;
  }

  /**
   * Complete crafting workflow: analyze goal, get strategy, optimize for budget
   */
  async getCompleteCraftingPlan(goal: CraftingGoal): Promise<{
    strategy: any;
    budgetOptimization: any;
    fossilRecommendations: any;
    warnings: string[];
    tips: string[];
  }> {
    console.log(`\n📋 Creating complete crafting plan...`);

    // Get detailed strategy
    const strategy = await this.getDetailedCraftingStrategy(goal);

    // Check if it fits budget
    const budgetOptimization = await this.optimizeCraftingForBudget(
      goal.baseItem,
      goal.itemLevel,
      goal.desiredMods,
      goal.budget
    );

    // Get fossil recommendations if using fossil method
    let fossilRecommendations: any[] = [];
    if (strategy.methodType === 'fossil') {
      fossilRecommendations = await this.getFossilRecommendations(
        goal.desiredMods,
        ['life', 'mana'] // Common tags to block
      );
    }

    // Compile warnings and tips
    const warnings: string[] = [...strategy.warnings];
    const tips: string[] = [...strategy.tips];

    if (budgetOptimization.unreachableMods.length > 0) {
      warnings.push(
        `⚠️ The following mods are too expensive for your budget: ${budgetOptimization.unreachableMods.join(', ')}`
      );
      tips.push(
        `💡 Consider targeting only: ${budgetOptimization.achievableMods.join(', ')}`
      );
    }

    return {
      strategy,
      budgetOptimization,
      fossilRecommendations,
      warnings,
      tips
    };
  }
}

export const smartCraftingOptimizer = new SmartCraftingOptimizer();
