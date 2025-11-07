/**
 * Centralized Currency Price Management Service
 * Singleton service for managing and caching currency prices across the application
 */

import { PoeNinjaAPI } from '../api/poeNinja';
import { CurrencyPrice } from '../types/crafting';
import { CACHE_DURATIONS, CURRENCY_COSTS } from '../config/craftingConstants';

export interface PriceCache {
  prices: Map<string, CurrencyPrice>;
  lastUpdated: number;
  league: string;
}

export class CurrencyPriceService {
  private static instance: CurrencyPriceService;
  private poeNinja: PoeNinjaAPI;
  private cache: PriceCache;

  private constructor() {
    this.poeNinja = new PoeNinjaAPI();
    this.cache = {
      prices: new Map(),
      lastUpdated: 0,
      league: '',
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CurrencyPriceService {
    if (!CurrencyPriceService.instance) {
      CurrencyPriceService.instance = new CurrencyPriceService();
    }
    return CurrencyPriceService.instance;
  }

  /**
   * Load currency prices for a specific league
   * Uses cache if available and not expired
   */
  public async loadPrices(league: string, forceRefresh: boolean = false): Promise<void> {
    const now = Date.now();
    const cacheValid =
      this.cache.league === league &&
      this.cache.lastUpdated > 0 &&
      (now - this.cache.lastUpdated) < CACHE_DURATIONS.CURRENCY_PRICES;

    if (cacheValid && !forceRefresh) {
      console.log(`Using cached currency prices for ${league} (age: ${Math.floor((now - this.cache.lastUpdated) / 1000)}s)`);
      return;
    }

    console.log(`Loading currency prices for ${league}...`);

    try {
      // Load currency prices
      const currencyResult = await this.poeNinja.searchCategory('', league, 'Currency');
      const newPrices = new Map<string, CurrencyPrice>();

      for (const item of currencyResult) {
        newPrices.set(item.name, {
          name: item.name,
          chaosValue: item.chaosValue,
          divineValue: item.divineValue,
          count: item.count,
          listingCount: item.listingCount,
        });
      }

      // Load fossil prices
      const fossilResult = await this.poeNinja.searchCategory('', league, 'Fossil');
      for (const item of fossilResult) {
        newPrices.set(item.name, {
          name: item.name,
          chaosValue: item.chaosValue,
          divineValue: item.divineValue,
          count: item.count,
          listingCount: item.listingCount,
        });
      }

      // Load essence prices
      const essenceResult = await this.poeNinja.searchCategory('', league, 'Essence');
      for (const item of essenceResult) {
        newPrices.set(item.name, {
          name: item.name,
          chaosValue: item.chaosValue,
          divineValue: item.divineValue,
          count: item.count,
          listingCount: item.listingCount,
        });
      }

      // Update cache
      this.cache = {
        prices: newPrices,
        lastUpdated: now,
        league,
      };

      console.log(`Loaded ${newPrices.size} currency prices for ${league}`);
    } catch (error) {
      console.error('Error loading currency prices:', error);

      // If cache is completely empty, use fallback prices
      if (this.cache.prices.size === 0) {
        console.log('Using fallback currency prices');
        this.loadFallbackPrices(league);
      } else {
        console.log('Using stale cache due to error');
      }
    }
  }

  /**
   * Load fallback prices when API is unavailable
   */
  private loadFallbackPrices(league: string): void {
    const fallbackPrices = new Map<string, CurrencyPrice>();

    for (const [name, value] of Object.entries(CURRENCY_COSTS)) {
      const formattedName = this.formatCurrencyName(name);
      fallbackPrices.set(formattedName, {
        name: formattedName,
        chaosValue: value,
        divineValue: value / CURRENCY_COSTS.DIVINE_ORB,
        count: 0,
        listingCount: 0,
      });
    }

    this.cache = {
      prices: fallbackPrices,
      lastUpdated: Date.now(),
      league,
    };
  }

  /**
   * Format currency constant name to display name
   * e.g., "CHAOS_ORB" -> "Chaos Orb"
   */
  private formatCurrencyName(constantName: string): string {
    return constantName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Get price for a specific currency
   * Handles various name formats (e.g., "chaos", "Chaos Orb", "chaos orb")
   */
  public getPrice(currencyName: string): number {
    const price = this.getPriceData(currencyName);
    return price?.chaosValue || this.getFallbackPrice(currencyName);
  }

  /**
   * Get full price data for a currency
   */
  public getPriceData(currencyName: string): CurrencyPrice | undefined {
    // Try exact match first
    if (this.cache.prices.has(currencyName)) {
      return this.cache.prices.get(currencyName);
    }

    // Try case-insensitive match
    const normalizedName = currencyName.toLowerCase();
    for (const [name, price] of this.cache.prices.entries()) {
      if (name.toLowerCase() === normalizedName) {
        return price;
      }
    }

    // Try partial match (e.g., "chaos" matches "Chaos Orb")
    for (const [name, price] of this.cache.prices.entries()) {
      if (name.toLowerCase().includes(normalizedName)) {
        return price;
      }
    }

    return undefined;
  }

  /**
   * Get fallback price when currency not found in cache
   */
  private getFallbackPrice(currencyName: string): number {
    const normalized = currencyName.toLowerCase();

    if (normalized.includes('chaos')) return CURRENCY_COSTS.CHAOS_ORB;
    if (normalized.includes('divine')) return CURRENCY_COSTS.DIVINE_ORB;
    if (normalized.includes('exalted') || normalized.includes('exalt')) return CURRENCY_COSTS.EXALTED_ORB;
    if (normalized.includes('alteration') || normalized.includes('alt')) return CURRENCY_COSTS.ORB_OF_ALTERATION;
    if (normalized.includes('augmentation') || normalized.includes('aug')) return CURRENCY_COSTS.ORB_OF_AUGMENTATION;
    if (normalized.includes('annul')) return CURRENCY_COSTS.ORB_OF_ANNULMENT;
    if (normalized.includes('veiled')) return CURRENCY_COSTS.VEILED_CHAOS_ORB;
    if (normalized.includes('scour')) return CURRENCY_COSTS.ORB_OF_SCOURING;
    if (normalized.includes('regret')) return CURRENCY_COSTS.ORB_OF_REGRET;
    if (normalized.includes('eternal')) return CURRENCY_COSTS.ETERNAL_ORB;

    // Default to 1 chaos if unknown
    return 1;
  }

  /**
   * Get all loaded prices
   */
  public getAllPrices(): Map<string, CurrencyPrice> {
    return new Map(this.cache.prices);
  }

  /**
   * Get cache age in seconds
   */
  public getCacheAge(): number {
    if (this.cache.lastUpdated === 0) return Infinity;
    return Math.floor((Date.now() - this.cache.lastUpdated) / 1000);
  }

  /**
   * Check if cache is valid
   */
  public isCacheValid(): boolean {
    if (this.cache.lastUpdated === 0) return false;
    const age = Date.now() - this.cache.lastUpdated;
    return age < CACHE_DURATIONS.CURRENCY_PRICES;
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache = {
      prices: new Map(),
      lastUpdated: 0,
      league: '',
    };
  }

  /**
   * Get current league
   */
  public getCurrentLeague(): string {
    return this.cache.league;
  }

  /**
   * Batch get prices for multiple currencies
   */
  public getBatchPrices(currencyNames: string[]): Map<string, number> {
    const results = new Map<string, number>();

    for (const name of currencyNames) {
      results.set(name, this.getPrice(name));
    }

    return results;
  }

  /**
   * Get divine to chaos ratio
   */
  public getDivineToChaosRatio(): number {
    const divinePrice = this.getPrice('Divine Orb');
    return divinePrice || CURRENCY_COSTS.DIVINE_ORB;
  }

  /**
   * Convert chaos value to divine value
   */
  public chaosToDivine(chaosValue: number): number {
    const ratio = this.getDivineToChaosRatio();
    return chaosValue / ratio;
  }

  /**
   * Convert divine value to chaos value
   */
  public divineToChaos(divineValue: number): number {
    const ratio = this.getDivineToChaosRatio();
    return divineValue * ratio;
  }

  /**
   * Format price as string with appropriate currency
   */
  public formatPrice(chaosValue: number): string {
    const divineRatio = this.getDivineToChaosRatio();

    if (chaosValue >= divineRatio) {
      const divineValue = chaosValue / divineRatio;
      return `${divineValue.toFixed(2)} divine`;
    }

    return `${chaosValue.toFixed(2)} chaos`;
  }

  /**
   * Get price statistics
   */
  public getPriceStats(): {
    totalCurrencies: number;
    cacheAge: number;
    league: string;
    divineToChaos: number;
  } {
    return {
      totalCurrencies: this.cache.prices.size,
      cacheAge: this.getCacheAge(),
      league: this.cache.league,
      divineToChaos: this.getDivineToChaosRatio(),
    };
  }
}

/**
 * Export singleton instance getter for convenience
 */
export function getCurrencyPriceService(): CurrencyPriceService {
  return CurrencyPriceService.getInstance();
}
