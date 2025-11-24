/**
 * Web Search Crafting Fallback
 *
 * Uses web search (Google/DuckDuckGo) to find crafting guides when other sources fail.
 * Searches Reddit, official forums, YouTube guides, and community sites for crafting strategies.
 */

import { browserManager } from './browserManager';
import { RateLimiter } from './rateLimiter';
import * as fs from 'fs-extra';
import * as path from 'path';
import { CraftingStrategy, CraftingStep } from './craftOfExileSimulatorEnhanced';

const CACHE_DIR = path.join(__dirname, '../data/web-search-cache');
const CACHE_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 days (community info changes faster)

// Rate limiter for web searches
const rateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60000,
  minDelay: 3000,
  maxConcurrent: 1,
  retryAttempts: 2,
  retryDelayMs: 5000
});

const SESSION_ID = 'web-search-fallback';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: 'reddit' | 'forum' | 'youtube' | 'guide' | 'other';
}

export interface ParsedCraftingInfo {
  method: string;
  steps: string[];
  cost?: string;
  tips: string[];
  warnings: string[];
  sourceUrl: string;
  confidence: 'high' | 'medium' | 'low';
}

export class WebSearchCraftingFallback {
  constructor() {
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  }

  /**
   * Search for crafting guides using web search
   */
  async searchForCraftingGuide(
    baseItem: string,
    itemLevel: number,
    desiredMods: string[]
  ): Promise<CraftingStrategy | null> {
    const cacheKey = `search-${baseItem}-${itemLevel}-${desiredMods.join('|')}`;
    const cached = await this.getFromCache<CraftingStrategy>(cacheKey);

    if (cached) {
      console.log(`📦 Using cached web search results for ${baseItem}`);
      return cached;
    }

    console.log(`\n🔍 Searching web for crafting guides: ${baseItem} with ${desiredMods.join(', ')}...`);

    return await rateLimiter.execute('web-search', async () => {
      try {
        // Perform multiple searches to gather information
        const searchQueries = this.generateSearchQueries(baseItem, desiredMods);
        const allResults: SearchResult[] = [];

        for (const query of searchQueries) {
          const results = await this.performSearch(query);
          allResults.push(...results);

          // Stop if we found good results
          if (allResults.length >= 5) break;
        }

        if (allResults.length === 0) {
          console.log(`   ❌ No web search results found`);
          return null;
        }

        console.log(`   ✓ Found ${allResults.length} relevant results`);

        // Parse the most relevant results
        const parsedInfo = await this.parseSearchResults(allResults, baseItem, desiredMods);

        if (parsedInfo.length === 0) {
          console.log(`   ❌ Could not extract crafting information from search results`);
          return null;
        }

        // Build strategy from parsed information
        const strategy = this.buildStrategyFromParsedInfo(
          baseItem,
          itemLevel,
          desiredMods,
          parsedInfo
        );

        // Cache the strategy
        await this.saveToCache(cacheKey, strategy);

        return strategy;
      } catch (error: any) {
        console.error(`Failed to search web for crafting guide:`, error.message);
        return null;
      }
    });
  }

  /**
   * Generate search queries for different platforms
   */
  private generateSearchQueries(baseItem: string, desiredMods: string[]): string[] {
    const modString = desiredMods.slice(0, 2).join(' '); // Use first 2 mods to avoid too long queries
    const currentYear = new Date().getFullYear();

    return [
      // Reddit searches
      `"${baseItem}" crafting guide ${modString} site:reddit.com/r/pathofexile`,
      `how to craft ${baseItem} ${modString} reddit pathofexile`,

      // Official forum
      `"${baseItem}" crafting ${modString} site:pathofexile.com/forum`,

      // General PoE sites
      `"${baseItem}" ${modString} crafting guide ${currentYear}`,
      `best way to craft ${baseItem} ${desiredMods[0]} Path of Exile`,

      // YouTube (descriptions often have written guides)
      `"${baseItem}" crafting guide ${modString} site:youtube.com`,

      // Backup generic search
      `Path of Exile ${baseItem} crafting ${modString} guide`
    ];
  }

  /**
   * Perform a web search using DuckDuckGo (no API key needed)
   */
  private async performSearch(query: string): Promise<SearchResult[]> {
    const page = await browserManager.createPage(SESSION_ID, true);

    try {
      // Use DuckDuckGo (more scraping-friendly than Google)
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

      console.log(`   🔎 Searching: ${query.substring(0, 60)}...`);

      await page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const results = await page.evaluate(() => {
        const searchResults: any[] = [];

        // DuckDuckGo result selectors
        const resultElements = document.querySelectorAll('.result, .web-result');

        resultElements.forEach((element, idx) => {
          if (idx >= 10) return; // Limit to top 10 results

          const titleEl = element.querySelector('.result__title, .result__a');
          const snippetEl = element.querySelector('.result__snippet, .result__body');
          const urlEl = element.querySelector('.result__url, .result__a');

          const title = titleEl?.textContent?.trim() || '';
          const snippet = snippetEl?.textContent?.trim() || '';
          const url = urlEl?.getAttribute('href') || urlEl?.textContent?.trim() || '';

          if (title && url) {
            // Determine source type
            let source: 'reddit' | 'forum' | 'youtube' | 'guide' | 'other' = 'other';
            if (url.includes('reddit.com')) source = 'reddit';
            else if (url.includes('pathofexile.com/forum')) source = 'forum';
            else if (url.includes('youtube.com')) source = 'youtube';
            else if (url.includes('guide') || url.includes('maxroll') || url.includes('poedb')) source = 'guide';

            searchResults.push({ title, url, snippet, source });
          }
        });

        return searchResults;
      });

      return results;
    } catch (error: any) {
      console.error(`   ⚠️ Search failed: ${error.message}`);
      return [];
    } finally {
      // Don't close the page, let browser manager handle it
    }
  }

  /**
   * Parse search results to extract crafting information
   */
  private async parseSearchResults(
    results: SearchResult[],
    baseItem: string,
    desiredMods: string[]
  ): Promise<ParsedCraftingInfo[]> {
    const parsedInfo: ParsedCraftingInfo[] = [];

    // Prioritize high-quality sources
    const sortedResults = results.sort((a, b) => {
      const scoreA = this.getSourceScore(a.source);
      const scoreB = this.getSourceScore(b.source);
      return scoreB - scoreA;
    });

    // Parse top 5 results
    for (const result of sortedResults.slice(0, 5)) {
      try {
        const info = await this.parseIndividualResult(result, baseItem, desiredMods);
        if (info) {
          parsedInfo.push(info);
        }
      } catch (error: any) {
        console.error(`   ⚠️ Failed to parse result from ${result.url}: ${error.message}`);
      }
    }

    return parsedInfo;
  }

  /**
   * Parse an individual search result page
   */
  private async parseIndividualResult(
    result: SearchResult,
    baseItem: string,
    desiredMods: string[]
  ): Promise<ParsedCraftingInfo | null> {
    // For now, extract information from snippets (fast)
    // Could be extended to actually visit pages for deep parsing

    const snippet = result.snippet.toLowerCase();
    const title = result.title.toLowerCase();
    const combinedText = `${title} ${snippet}`;

    // Look for crafting method keywords
    const methods = [
      'chaos spam', 'chaos orb', 'alt spam', 'alteration', 'fossil',
      'essence', 'harvest', 'reforge', 'metacraft', 'beast craft',
      'eldritch', 'recombinator', 'veiled chaos'
    ];

    const detectedMethods = methods.filter(method => combinedText.includes(method));

    if (detectedMethods.length === 0) {
      return null; // No crafting methods detected
    }

    // Extract steps (look for numbered lists or step indicators)
    const steps = this.extractSteps(combinedText);

    // Extract tips and warnings
    const tips = this.extractTipsAndWarnings(combinedText, 'tip');
    const warnings = this.extractTipsAndWarnings(combinedText, 'warning');

    // Assess confidence based on source and content quality
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (result.source === 'guide') confidence = 'high';
    else if (result.source === 'reddit' || result.source === 'forum') confidence = 'medium';
    else confidence = 'low';

    return {
      method: detectedMethods[0].charAt(0).toUpperCase() + detectedMethods[0].slice(1),
      steps: steps.length > 0 ? steps : [`Use ${detectedMethods[0]} on ${baseItem}`, 'Check for desired mods', 'Repeat until successful'],
      cost: this.extractCost(combinedText),
      tips,
      warnings,
      sourceUrl: result.url,
      confidence
    };
  }

  /**
   * Extract crafting steps from text
   */
  private extractSteps(text: string): string[] {
    const steps: string[] = [];

    // Look for numbered steps: "1.", "2.", "step 1", etc.
    const stepPatterns = [
      /(?:^|\n)\s*(\d+)[.)]\s*([^\n]+)/gi,
      /(?:step\s+\d+:?\s*)([^\n]+)/gi,
      /(?:first|second|third|then|next|finally)[,:]?\s+([^\n.]+)/gi
    ];

    for (const pattern of stepPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const step = match[1] || match[0];
        if (step && step.length > 10 && step.length < 200) {
          steps.push(step.trim());
        }
      }
      if (steps.length >= 3) break; // Got enough steps
    }

    return steps;
  }

  /**
   * Extract tips or warnings from text
   */
  private extractTipsAndWarnings(text: string, type: 'tip' | 'warning'): string[] {
    const items: string[] = [];

    const keyword = type === 'tip' ? 'tip|recommend|suggest|pro tip' : 'warning|caution|careful|avoid|don\'t';
    const pattern = new RegExp(`(?:${keyword})[:\\s]*([^\\n.]+)`, 'gi');

    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length > 10) {
        items.push(match[1].trim());
      }
    }

    return items.slice(0, 3); // Limit to 3
  }

  /**
   * Extract cost information from text
   */
  private extractCost(text: string): string | undefined {
    const costPatterns = [
      /(\d+(?:,\d+)?)\s*(?:chaos|c\b)/gi,
      /(?:cost|price|budget)[:\s]*(\d+(?:,\d+)?)/gi,
      /(?:around|about|roughly)\s*(\d+(?:,\d+)?)\s*(?:chaos|c\b)/gi
    ];

    for (const pattern of costPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return undefined;
  }

  /**
   * Get priority score for different sources
   */
  private getSourceScore(source: string): number {
    const scores: Record<string, number> = {
      guide: 10,
      forum: 8,
      reddit: 7,
      youtube: 5,
      other: 3
    };
    return scores[source] || 0;
  }

  /**
   * Build a CraftingStrategy from parsed information
   */
  private buildStrategyFromParsedInfo(
    baseItem: string,
    itemLevel: number,
    desiredMods: string[],
    parsedInfo: ParsedCraftingInfo[]
  ): CraftingStrategy {
    // Use the highest confidence info
    const bestInfo = parsedInfo.sort((a, b) => {
      const confidenceScore = { high: 3, medium: 2, low: 1 };
      return confidenceScore[b.confidence] - confidenceScore[a.confidence];
    })[0];

    // Build steps
    const steps: CraftingStep[] = bestInfo.steps.map((step, idx) => ({
      stepNumber: idx + 1,
      action: step,
      actionType: this.determineActionType(step),
      details: step
    }));

    // Add source attribution step
    steps.push({
      stepNumber: steps.length + 1,
      action: 'Reference community guide',
      actionType: 'check',
      details: `This strategy was compiled from community sources. Visit ${bestInfo.sourceUrl} for more details.`
    });

    // Estimate costs (rough)
    const averageCost = this.estimateCost(bestInfo.method, bestInfo.cost);
    const successRate = 0.05; // Conservative estimate
    const averageAttempts = Math.ceil(1 / successRate);

    // Combine tips and warnings from all sources
    const allTips = [...new Set(parsedInfo.flatMap(info => info.tips))];
    const allWarnings = [...new Set(parsedInfo.flatMap(info => info.warnings))];

    // Add community source warning
    allWarnings.unshift('⚠️ This strategy is sourced from community guides and may need adjustment');
    allTips.unshift('💡 Always verify costs on trade sites before starting');
    allTips.push(`💡 Source: ${bestInfo.sourceUrl}`);

    return {
      baseItem,
      itemLevel,
      desiredMods,
      method: bestInfo.method,
      methodType: this.mapMethodToType(bestInfo.method),
      steps,
      averageCost,
      averageAttempts,
      successRate,
      currencyBreakdown: [{
        currency: bestInfo.method.includes('fossil') ? 'Fossils + Resonators' : 'Chaos Orbs',
        amount: averageAttempts,
        costPerUnit: bestInfo.method.includes('fossil') ? 5 : 1,
        totalCost: averageCost
      }],
      difficulty: 'intermediate',
      estimatedTime: averageAttempts < 50 ? '10-30 minutes' : '30-60 minutes',
      warnings: allWarnings.slice(0, 5),
      tips: allTips.slice(0, 5)
    };
  }

  /**
   * Determine action type from step text
   */
  private determineActionType(step: string): CraftingStep['actionType'] {
    const lower = step.toLowerCase();
    if (lower.includes('fossil')) return 'fossil';
    if (lower.includes('essence')) return 'essence';
    if (lower.includes('harvest')) return 'harvest';
    if (lower.includes('bench') || lower.includes('craft')) return 'bench';
    if (lower.includes('check') || lower.includes('verify')) return 'check';
    return 'currency';
  }

  /**
   * Map method name to method type
   */
  private mapMethodToType(method: string): CraftingStrategy['methodType'] {
    const lower = method.toLowerCase();
    if (lower.includes('chaos')) return 'chaos';
    if (lower.includes('alt') || lower.includes('regal')) return 'alt-regal';
    if (lower.includes('fossil')) return 'fossil';
    if (lower.includes('essence')) return 'essence';
    if (lower.includes('harvest')) return 'harvest';
    if (lower.includes('metacraft')) return 'metacraft';
    return 'chaos'; // default
  }

  /**
   * Estimate cost from method and cost string
   */
  private estimateCost(method: string, costString?: string): number {
    // Try to extract from cost string
    if (costString) {
      const match = costString.match(/(\d+(?:,\d+)?)/);
      if (match) {
        return parseInt(match[1].replace(',', ''));
      }
    }

    // Fallback estimates based on method
    const estimates: Record<string, number> = {
      'chaos': 50,
      'fossil': 150,
      'essence': 100,
      'harvest': 200,
      'alt': 30,
      'metacraft': 500
    };

    for (const [key, cost] of Object.entries(estimates)) {
      if (method.toLowerCase().includes(key)) {
        return cost;
      }
    }

    return 100; // Default estimate
  }

  /**
   * Cache management
   */
  private async getFromCache<T>(key: string): Promise<T | null> {
    const cacheFile = path.join(CACHE_DIR, `${key}.json`);
    try {
      if (await fs.pathExists(cacheFile)) {
        const data = await fs.readJson(cacheFile);
        if (Date.now() - data.timestamp < CACHE_DURATION) {
          return data.value;
        }
      }
    } catch (error) {
      console.error(`Failed to read cache for ${key}:`, error);
    }
    return null;
  }

  private async saveToCache<T>(key: string, value: T): Promise<void> {
    const cacheFile = path.join(CACHE_DIR, `${key}.json`);
    try {
      await fs.writeJson(cacheFile, {
        value,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`Failed to save cache for ${key}:`, error);
    }
  }
}

export const webSearchCraftingFallback = new WebSearchCraftingFallback();
