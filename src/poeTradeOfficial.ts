/**
 * Path of Exile Official Trade Site Integration
 * Supports both authenticated and unauthenticated access
 * Handles login flow with visible browser for session caching
 */

import { Page } from 'puppeteer';
import { browserManager } from './browserManager';
import { RateLimiter, RateLimitPresets } from './rateLimiter';

const TRADE_URL = 'https://www.pathofexile.com/trade';
const LOGIN_URL = 'https://www.pathofexile.com/login';
const SESSION_ID = 'poe-trade-official';

// Rate limiter for official trade site
const rateLimiter = new RateLimiter(RateLimitPresets.poeTradeOfficial);

export interface TradeSearchQuery {
  league: string;
  type?: string;
  name?: string;
  stats?: Array<{
    type: string;
    filters: Array<{
      id: string;
      value?: {
        min?: number;
        max?: number;
      };
    }>;
  }>;
  filters?: {
    trade_filters?: {
      filters?: {
        price?: {
          min?: number;
          max?: number;
        };
      };
    };
  };
}

export interface TradeSearchResult {
  id: string;
  items: Array<{
    id: string;
    name: string;
    typeLine: string;
    baseType: string;
    ilvl: number;
    corrupted: boolean;
    price?: {
      amount: number;
      currency: string;
    };
    seller: {
      account: string;
      lastSeen: string;
    };
    listed: string;
  }>;
  total: number;
}

export class PoeTradeOfficial {
  private isAuthenticated = false;

  constructor() {}

  /**
   * Check if user is already logged in (has cached session)
   */
  async checkAuthentication(): Promise<boolean> {
    try {
      this.isAuthenticated = await browserManager.isSessionAuthenticated(
        SESSION_ID,
        'pathofexile.com'
      );
      return this.isAuthenticated;
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  }

  /**
   * Prompt user to login with a visible browser
   * This will cache the session for future use
   */
  async promptLogin(): Promise<boolean> {
    console.log('Opening browser for Path of Exile login...');

    try {
      // Create a visible browser window
      const page = await browserManager.createPage(SESSION_ID, false);

      // Navigate to login page
      await page.goto(LOGIN_URL, { waitUntil: 'networkidle2' });

      console.log('Please log in to Path of Exile in the browser window...');
      console.log('Waiting for successful login...');

      // Wait for navigation to trade site or profile (indicates successful login)
      await Promise.race([
        page.waitForNavigation({
          waitUntil: 'networkidle2',
          timeout: 5 * 60 * 1000 // 5 minutes for user to login
        }),
        page.waitForSelector('.profile-link', { timeout: 5 * 60 * 1000 })
      ]);

      // Verify we're logged in
      const cookies = await page.cookies();
      const hasAuthCookie = cookies.some(c =>
        c.name.includes('POESESSID') || c.name.includes('session')
      );

      if (hasAuthCookie) {
        console.log('Login successful! Saving session...');
        await browserManager.saveSessionCookies(SESSION_ID);
        this.isAuthenticated = true;

        // Navigate to trade site to cache it
        await page.goto(TRADE_URL, { waitUntil: 'networkidle2' });

        return true;
      } else {
        console.log('Login failed or timed out');
        return false;
      }
    } catch (error) {
      console.error('Error during login:', error);
      return false;
    }
  }

  /**
   * Search for items on the official trade site
   */
  async searchItems(query: TradeSearchQuery): Promise<TradeSearchResult> {
    // Ensure we have a session (headless after login)
    await this.ensureSession();

    return await rateLimiter.execute('pathofexile.com', async () => {
      const page = await browserManager.createPage(SESSION_ID, true);

      try {
        // Load cookies if available
        await browserManager.loadSessionCookies(SESSION_ID, page);

        // Navigate to trade search
        const searchUrl = `${TRADE_URL}/search/${query.league}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });

        // If we need to perform a complex search, we'd interact with the UI here
        // For now, let's just scrape the current results
        const results = await this.scrapeSearchResults(page);

        return results;
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Get item price by name
   */
  async getItemPrice(itemName: string, league: string = 'Standard'): Promise<number | null> {
    await this.ensureSession();

    return await rateLimiter.execute('pathofexile.com', async () => {
      const page = await browserManager.createPage(SESSION_ID, true);

      try {
        await browserManager.loadSessionCookies(SESSION_ID, page);

        // Navigate to trade search
        await page.goto(`${TRADE_URL}/search/${league}`, { waitUntil: 'networkidle2' });

        // Type item name in search box
        await page.waitForSelector('input[placeholder*="Search"]', { timeout: 5000 });
        await page.type('input[placeholder*="Search"]', itemName);

        // Wait for results
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get first result price
        const price = await page.evaluate(() => {
          // @ts-ignore - document is available in browser context
          const priceElement = document.querySelector('.price');
          if (!priceElement) return null;

          const text = priceElement.textContent || '';
          const match = text.match(/(\d+(?:\.\d+)?)/);
          return match ? parseFloat(match[1]) : null;
        });

        return price;
      } catch (error) {
        console.error(`Error getting price for ${itemName}:`, error);
        return null;
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Get bulk item prices for comparison
   */
  async getBulkPrices(itemNames: string[], league: string = 'Standard'): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    console.log(`Fetching prices for ${itemNames.length} items from official trade site...`);

    for (const itemName of itemNames) {
      try {
        const price = await this.getItemPrice(itemName, league);
        if (price !== null) {
          prices.set(itemName, price);
          console.log(`  ${itemName}: ${price}c`);
        }
      } catch (error) {
        console.error(`  Failed to get price for ${itemName}`);
      }
    }

    return prices;
  }

  /**
   * Compare base item prices across different bases
   * Useful for finding profitable crafting bases
   */
  async compareBasePrices(baseTypes: string[], league: string = 'Standard'): Promise<{
    prices: Map<string, number>;
    cheapest: { base: string; price: number } | null;
    mostExpensive: { base: string; price: number } | null;
    averagePrice: number;
  }> {
    console.log('Comparing base prices for crafting optimization...');

    const prices = await this.getBulkPrices(baseTypes, league);

    if (prices.size === 0) {
      return {
        prices,
        cheapest: null,
        mostExpensive: null,
        averagePrice: 0
      };
    }

    const priceArray = Array.from(prices.entries());
    const sortedByPrice = priceArray.sort((a, b) => a[1] - b[1]);

    const cheapest = {
      base: sortedByPrice[0][0],
      price: sortedByPrice[0][1]
    };

    const mostExpensive = {
      base: sortedByPrice[sortedByPrice.length - 1][0],
      price: sortedByPrice[sortedByPrice.length - 1][1]
    };

    const averagePrice = priceArray.reduce((sum, [_, price]) => sum + price, 0) / prices.size;

    console.log('\nPrice Comparison Results:');
    console.log(`  Cheapest: ${cheapest.base} at ${cheapest.price}c`);
    console.log(`  Most Expensive: ${mostExpensive.base} at ${mostExpensive.price}c`);
    console.log(`  Average: ${averagePrice.toFixed(2)}c`);
    console.log(`  Potential Profit: ${(mostExpensive.price - cheapest.price).toFixed(2)}c`);

    return {
      prices,
      cheapest,
      mostExpensive,
      averagePrice
    };
  }

  /**
   * Ensure we have a valid session
   */
  private async ensureSession(): Promise<void> {
    const isAuth = await this.checkAuthentication();

    if (!isAuth) {
      console.log('No authenticated session found.');
      console.log('Note: Some features may be limited without authentication.');
      console.log('Use the "Login to PoE Trade" button to authenticate.');
    }
  }

  /**
   * Scrape search results from the page
   */
  private async scrapeSearchResults(page: Page): Promise<TradeSearchResult> {
    try {
      // Wait for results to load
      await page.waitForSelector('.results, .resultset', { timeout: 10000 });

      const results = await page.evaluate(() => {
        const items: any[] = [];

        // Find all result items
        // @ts-ignore - document is available in browser context
        const resultElements = document.querySelectorAll('.result-item, .resultset > div');

        resultElements.forEach(elem => {
          const nameElem = elem.querySelector('.name, .item-name');
          const typeElem = elem.querySelector('.type, .base-type');
          const priceElem = elem.querySelector('.price');

          if (nameElem) {
            const item = {
              id: elem.getAttribute('data-id') || '',
              name: nameElem.textContent?.trim() || '',
              typeLine: typeElem?.textContent?.trim() || '',
              baseType: typeElem?.textContent?.trim() || '',
              ilvl: 0,
              corrupted: false,
              price: undefined as any,
              seller: {
                account: '',
                lastSeen: ''
              },
              listed: ''
            };

            // Parse price
            if (priceElem) {
              const priceText = priceElem.textContent || '';
              const match = priceText.match(/(\d+(?:\.\d+)?)\s*(\w+)/);
              if (match) {
                item.price = {
                  amount: parseFloat(match[1]),
                  currency: match[2]
                };
              }
            }

            items.push(item);
          }
        });

        return {
          id: 'search-' + Date.now(),
          items,
          total: items.length
        };
      });

      return results;
    } catch (error) {
      console.error('Error scraping search results:', error);
      return {
        id: 'error',
        items: [],
        total: 0
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await browserManager.closeSession(SESSION_ID);
  }
}

// Singleton instance
export const poeTradeOfficial = new PoeTradeOfficial();
