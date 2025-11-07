/**
 * Price Comparison and Profit Analysis System
 * Compares prices across different sources and identifies profitable opportunities
 */

import { poeNinjaAPI } from './api/poeNinja';
import { poeTradeOfficial } from './poeTradeOfficial';

export interface PriceData {
  source: string;
  price: number;
  confidence: number; // 0-1, how reliable this price is
  timestamp: number;
  currency: string;
}

export interface ItemPriceComparison {
  itemName: string;
  prices: PriceData[];
  lowestPrice: PriceData | null;
  highestPrice: PriceData | null;
  averagePrice: number;
  priceSpread: number; // Difference between highest and lowest
  profitMargin: number; // Percentage profit if buying at lowest and selling at highest
  recommendation: 'buy' | 'sell' | 'hold' | 'insufficient-data';
}

export interface CraftingProfitAnalysis {
  baseItem: string;
  baseCost: number;
  craftingCost: number;
  expectedValue: number;
  profit: number;
  profitMargin: number;
  roi: number; // Return on investment percentage
  risk: 'low' | 'medium' | 'high';
}

export class PriceComparisonService {
  /**
   * Compare prices for a single item across all sources
   */
  async compareItemPrice(itemName: string, league: string = 'Standard'): Promise<ItemPriceComparison> {
    console.log(`\nComparing prices for: ${itemName}`);

    const prices: PriceData[] = [];

    // Get price from poe.ninja
    try {
      const ninjaPrice = await poeNinjaAPI.getItemPrice(itemName);
      if (ninjaPrice > 0) {
        prices.push({
          source: 'poe.ninja',
          price: ninjaPrice,
          confidence: 0.9,
          timestamp: Date.now(),
          currency: 'chaos'
        });
        console.log(`  poe.ninja: ${ninjaPrice}c`);
      }
    } catch (error) {
      console.error('  poe.ninja: Error fetching price');
    }

    // Get price from official trade site
    try {
      const tradePrice = await poeTradeOfficial.getItemPrice(itemName, league);
      if (tradePrice !== null) {
        prices.push({
          source: 'pathofexile.com/trade',
          price: tradePrice,
          confidence: 0.95,
          timestamp: Date.now(),
          currency: 'chaos'
        });
        console.log(`  Official Trade: ${tradePrice}c`);
      }
    } catch (error) {
      console.error('  Official Trade: Error fetching price');
    }

    return this.analyzeComparison(itemName, prices);
  }

  /**
   * Compare prices for multiple items
   */
  async compareMultipleItems(itemNames: string[], league: string = 'Standard'): Promise<ItemPriceComparison[]> {
    console.log(`\nComparing prices for ${itemNames.length} items...`);

    const comparisons: ItemPriceComparison[] = [];

    for (const itemName of itemNames) {
      try {
        const comparison = await this.compareItemPrice(itemName, league);
        comparisons.push(comparison);

        // Add delay to avoid rate limiting
        await this.delay(1000);
      } catch (error) {
        console.error(`Error comparing ${itemName}:`, error);
      }
    }

    return comparisons;
  }

  /**
   * Find arbitrage opportunities (buy low, sell high)
   */
  async findArbitrageOpportunities(
    itemNames: string[],
    league: string = 'Standard',
    minProfit: number = 5 // Minimum profit in chaos
  ): Promise<ItemPriceComparison[]> {
    console.log(`\n🔍 Scanning for arbitrage opportunities (min profit: ${minProfit}c)...`);

    const comparisons = await this.compareMultipleItems(itemNames, league);

    // Filter for profitable opportunities
    const opportunities = comparisons.filter(comp =>
      comp.priceSpread >= minProfit &&
      comp.recommendation === 'buy'
    );

    // Sort by profit margin
    opportunities.sort((a, b) => b.profitMargin - a.profitMargin);

    console.log(`\n✨ Found ${opportunities.length} arbitrage opportunities:`);
    opportunities.forEach((opp, i) => {
      console.log(`\n${i + 1}. ${opp.itemName}`);
      console.log(`   Buy at: ${opp.lowestPrice?.price}c (${opp.lowestPrice?.source})`);
      console.log(`   Sell at: ${opp.highestPrice?.price}c (${opp.highestPrice?.source})`);
      console.log(`   Profit: ${opp.priceSpread.toFixed(2)}c (${opp.profitMargin.toFixed(1)}% margin)`);
    });

    return opportunities;
  }

  /**
   * Analyze crafting profitability by comparing base costs and final values
   */
  async analyzeCraftingProfit(
    baseItem: string,
    craftedItem: string,
    craftingCost: number,
    league: string = 'Standard'
  ): Promise<CraftingProfitAnalysis> {
    console.log(`\n📊 Analyzing crafting profit: ${baseItem} -> ${craftedItem}`);

    // Get base item cost
    const baseComparison = await this.compareItemPrice(baseItem, league);
    const baseCost = baseComparison.lowestPrice?.price || 0;

    // Get crafted item value
    const craftedComparison = await this.compareItemPrice(craftedItem, league);
    const expectedValue = craftedComparison.averagePrice;

    // Calculate profit
    const totalCost = baseCost + craftingCost;
    const profit = expectedValue - totalCost;
    const profitMargin = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    // Assess risk based on price spread and data availability
    let risk: 'low' | 'medium' | 'high' = 'medium';
    if (craftedComparison.prices.length < 2) {
      risk = 'high'; // Not enough data
    } else if (craftedComparison.priceSpread / craftedComparison.averagePrice > 0.3) {
      risk = 'high'; // High price volatility
    } else if (profitMargin > 50) {
      risk = 'low'; // Good profit margin
    }

    const analysis: CraftingProfitAnalysis = {
      baseItem,
      baseCost,
      craftingCost,
      expectedValue,
      profit,
      profitMargin,
      roi,
      risk
    };

    console.log('\n📈 Crafting Analysis Results:');
    console.log(`   Base Cost: ${baseCost.toFixed(2)}c`);
    console.log(`   Crafting Cost: ${craftingCost.toFixed(2)}c`);
    console.log(`   Total Investment: ${totalCost.toFixed(2)}c`);
    console.log(`   Expected Value: ${expectedValue.toFixed(2)}c`);
    console.log(`   Profit: ${profit.toFixed(2)}c`);
    console.log(`   ROI: ${roi.toFixed(1)}%`);
    console.log(`   Risk: ${risk.toUpperCase()}`);

    if (profit > 0) {
      console.log(`   ✅ PROFITABLE - Recommend crafting`);
    } else {
      console.log(`   ❌ NOT PROFITABLE - Do not recommend`);
    }

    return analysis;
  }

  /**
   * Compare multiple crafting routes to find the most profitable
   */
  async compareCraftingRoutes(
    routes: Array<{
      name: string;
      baseItem: string;
      craftedItem: string;
      craftingCost: number;
    }>,
    league: string = 'Standard'
  ): Promise<CraftingProfitAnalysis[]> {
    console.log(`\n🛠️  Comparing ${routes.length} crafting routes...`);

    const analyses: CraftingProfitAnalysis[] = [];

    for (const route of routes) {
      try {
        console.log(`\n--- Route: ${route.name} ---`);
        const analysis = await this.analyzeCraftingProfit(
          route.baseItem,
          route.craftedItem,
          route.craftingCost,
          league
        );
        analyses.push(analysis);

        // Add delay
        await this.delay(1500);
      } catch (error) {
        console.error(`Error analyzing route ${route.name}:`, error);
      }
    }

    // Sort by profit
    analyses.sort((a, b) => b.profit - a.profit);

    console.log(`\n\n🏆 BEST CRAFTING ROUTES:`);
    analyses.slice(0, 3).forEach((analysis, i) => {
      console.log(`\n${i + 1}. ${analysis.baseItem} (${analysis.profit.toFixed(2)}c profit, ${analysis.roi.toFixed(1)}% ROI)`);
    });

    return analyses;
  }

  /**
   * Analyze price comparison and make recommendation
   */
  private analyzeComparison(itemName: string, prices: PriceData[]): ItemPriceComparison {
    if (prices.length === 0) {
      return {
        itemName,
        prices: [],
        lowestPrice: null,
        highestPrice: null,
        averagePrice: 0,
        priceSpread: 0,
        profitMargin: 0,
        recommendation: 'insufficient-data'
      };
    }

    // Sort by price
    const sortedPrices = [...prices].sort((a, b) => a.price - b.price);

    const lowestPrice = sortedPrices[0];
    const highestPrice = sortedPrices[sortedPrices.length - 1];

    // Calculate weighted average based on confidence
    const totalConfidence = prices.reduce((sum, p) => sum + p.confidence, 0);
    const averagePrice = prices.reduce((sum, p) => sum + (p.price * p.confidence), 0) / totalConfidence;

    const priceSpread = highestPrice.price - lowestPrice.price;
    const profitMargin = lowestPrice.price > 0 ? (priceSpread / lowestPrice.price) * 100 : 0;

    // Make recommendation
    let recommendation: 'buy' | 'sell' | 'hold' | 'insufficient-data' = 'hold';

    if (prices.length < 2) {
      recommendation = 'insufficient-data';
    } else if (profitMargin > 10) {
      // More than 10% profit margin - buy low, sell high opportunity
      recommendation = 'buy';
    } else if (priceSpread < averagePrice * 0.05) {
      // Prices are stable - hold
      recommendation = 'hold';
    }

    return {
      itemName,
      prices,
      lowestPrice,
      highestPrice,
      averagePrice,
      priceSpread,
      profitMargin,
      recommendation
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get summary of market opportunities
   */
  async getMarketSummary(itemNames: string[], league: string = 'Standard'): Promise<{
    totalItems: number;
    itemsWithData: number;
    buyOpportunities: number;
    averageProfit: number;
    topOpportunities: ItemPriceComparison[];
  }> {
    const comparisons = await this.compareMultipleItems(itemNames, league);

    const itemsWithData = comparisons.filter(c => c.prices.length > 0).length;
    const buyOpportunities = comparisons.filter(c => c.recommendation === 'buy').length;
    const averageProfit = comparisons.reduce((sum, c) => sum + c.priceSpread, 0) / comparisons.length;

    const topOpportunities = comparisons
      .filter(c => c.recommendation === 'buy')
      .sort((a, b) => b.profitMargin - a.profitMargin)
      .slice(0, 5);

    return {
      totalItems: itemNames.length,
      itemsWithData,
      buyOpportunities,
      averageProfit,
      topOpportunities
    };
  }
}

// Singleton instance
export const priceComparisonService = new PriceComparisonService();
