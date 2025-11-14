import { BrowserManager } from './browserManager';
import { RateLimiter } from './rateLimiter';
import { EventEmitter } from 'events';
import { clipboard } from 'electron';
import type { Page } from 'puppeteer';

export interface ManualItem {
  itemName: string;
  maxPrice: number;
  minLinks?: number;
}

export interface SniperConfig {
  enabled: boolean;
  league: string;
  searchQuery?: string; // Optional now - can use manual items instead
  manualItems?: ManualItem[]; // List of items to snipe manually
  maxPriceChaos: number;
  pollingIntervalMs: number;
  autoWhisper: boolean;
  autoInvite: boolean;
  soundNotification: boolean;
  minItemLevel?: number;
  requiredMods?: string[];
  excludedSellers?: string[];
}

export interface SniperListing {
  id: string;
  itemName: string;
  price: number;
  currency: string;
  seller: string;
  whisperMessage: string;
  listedAt: Date;
  age: string;
  indexed: string;
}

export class TradeSniper extends EventEmitter {
  private browserManager: BrowserManager;
  private config: SniperConfig;
  private isRunning: boolean = false;
  private seenListings: Set<string> = new Set();
  private pollingTimer?: NodeJS.Timeout;
  private page?: Page;
  private rateLimiter: RateLimiter;
  private baseUrl = 'https://www.pathofexile.com/trade';
  private currentItemIndex: number = 0; // For cycling through manual items
  private manualSearchUrls: string[] = []; // Store created search URLs

  constructor(browserManager: BrowserManager, config: SniperConfig) {
    super();
    this.browserManager = browserManager;
    this.config = config;
    // Aggressive rate limiting for sniping - we want to be fast but not get banned
    this.rateLimiter = new RateLimiter({
      maxRequests: 20,
      windowMs: 60000, // 20 requests per minute
      minDelay: 2000, // 2 seconds minimum between requests
      maxConcurrent: 1,
      retryAttempts: 3,
      retryDelayMs: 1000
    });
  }

  async login(): Promise<boolean> {
    try {
      console.log('Opening browser for login...');

      // Create a visible browser session for login
      const loginPage = await this.browserManager.createPage('trade-sniper-login', false);

      // Navigate to login page
      await loginPage.goto('https://www.pathofexile.com/login', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      this.emit('login-popup-opened');

      // Wait for user to login (check every 2 seconds for up to 5 minutes)
      let attempts = 0;
      const maxAttempts = 150; // 5 minutes

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
          const isLoggedIn = await loginPage.evaluate(() => {
            // Check if logged in by looking for account elements
            const loginLink = document.querySelector('a[href*="login"]');
            const accountDropdown = document.querySelector('.profile-link, .user-name, a[href*="/account"]');
            return !loginLink && !!accountDropdown;
          });

          if (isLoggedIn) {
            console.log('✅ Login detected! Session saved.');
            this.emit('login-success');

            // Give it a moment to fully save session
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Close the login browser window
            await this.browserManager.closeSession('trade-sniper-login');

            return true;
          }
        } catch (err) {
          console.error('Error checking login status:', err);
        }

        attempts++;
      }

      // Timeout
      this.emit('login-timeout');
      await this.browserManager.closeSession('trade-sniper-login');
      return false;

    } catch (error) {
      console.error('Login error:', error);
      this.emit('login-error', error);
      return false;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Sniper already running');
      return;
    }

    console.log('Starting trade sniper...');
    this.isRunning = true;
    this.seenListings.clear();

    try {
      // Initialize browser session (visible so user can see what's happening)
      this.page = await this.browserManager.createPage('trade-sniper', false);

      // Navigate to trade site
      await this.page.goto(`${this.baseUrl}/search/${this.config.league}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Check if logged in
      const isLoggedIn = await this.checkLogin();
      if (!isLoggedIn) {
        this.emit('error', 'Not logged in to pathofexile.com. Please log in manually.');
        await this.stop();
        return;
      }

      // Perform initial search
      await this.performSearch();

      // Start aggressive polling
      this.startPolling();

      this.emit('started');
    } catch (error) {
      console.error('Failed to start sniper:', error);
      this.emit('error', error);
      await this.stop();
    }
  }

  async stop(): Promise<void> {
    console.log('Stopping trade sniper...');
    this.isRunning = false;

    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = undefined;
    }

    this.emit('stopped');
  }

  private startPolling(): void {
    if (!this.isRunning) return;

    this.pollingTimer = setTimeout(async () => {
      try {
        await this.rateLimiter.execute('pathofexile.com', async () => {
          await this.checkForNewListings();
        });
      } catch (error) {
        console.error('Error checking for listings:', error);
        this.emit('error', error);
      } finally {
        // Schedule next poll
        this.startPolling();
      }
    }, this.config.pollingIntervalMs);
  }

  private async createSearchForItem(item: ManualItem): Promise<string> {
    if (!this.page) throw new Error('Browser page not initialized');

    console.log(`Creating search for: ${item.itemName}`);

    // Build the search query JSON
    const searchQuery: any = {
      query: {
        status: { option: 'online' },
        name: item.itemName,
        type: '',
        stats: [{ type: 'and', filters: [] }],
        filters: {
          trade_filters: {
            filters: {
              price: {
                max: item.maxPrice
              }
            }
          }
        }
      },
      sort: { price: 'asc' }
    };

    // Add links filter if specified
    if (item.minLinks) {
      searchQuery.query.filters.socket_filters = {
        filters: {
          links: { min: item.minLinks }
        }
      };
    }

    // Post the search to get a search ID
    try {
      const response = await this.page.evaluate(async (baseUrl, league, query) => {
        const res = await fetch(`${baseUrl}/search/${league}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(query)
        });
        return await res.json();
      }, this.baseUrl, this.config.league, searchQuery) as { id?: string };

      if (response.id) {
        const searchUrl = `${this.baseUrl}/search/${this.config.league}/${response.id}`;
        console.log(`Created search: ${searchUrl}`);
        return searchUrl;
      } else {
        throw new Error('Failed to create search - no ID returned');
      }
    } catch (error) {
      console.error(`Error creating search for ${item.itemName}:`, error);
      throw error;
    }
  }

  private async performSearch(): Promise<void> {
    if (!this.page) return;

    console.log('Performing initial search...');

    // Check if using manual items or a search query
    if (this.config.manualItems && this.config.manualItems.length > 0) {
      // Create searches for all manual items
      console.log(`Creating searches for ${this.config.manualItems.length} manual items...`);
      this.manualSearchUrls = [];

      for (const item of this.config.manualItems) {
        try {
          const searchUrl = await this.createSearchForItem(item);
          this.manualSearchUrls.push(searchUrl);
        } catch (error) {
          console.error(`Failed to create search for ${item.itemName}:`, error);
        }
      }

      if (this.manualSearchUrls.length === 0) {
        throw new Error('Failed to create any searches from manual items');
      }

      // Navigate to the first search
      await this.page.goto(this.manualSearchUrls[0], {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
    } else if (this.config.searchQuery) {
      // Use the provided search query
      if (this.config.searchQuery.startsWith('http')) {
        await this.page.goto(this.config.searchQuery, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
      } else {
        // If it's a search ID, navigate to it
        await this.page.goto(`${this.baseUrl}/search/${this.config.league}/${this.config.searchQuery}`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
      }
    } else {
      throw new Error('No search query or manual items provided');
    }

    // Wait for results to load
    await this.page.waitForSelector('.resultset', { timeout: 10000 }).catch(() => {
      console.log('No results found or page structure changed');
    });
  }

  private async checkForNewListings(): Promise<void> {
    if (!this.page || !this.isRunning) return;

    try {
      // If we have multiple manual searches, cycle through them
      if (this.manualSearchUrls.length > 1) {
        this.currentItemIndex = (this.currentItemIndex + 1) % this.manualSearchUrls.length;
        const nextUrl = this.manualSearchUrls[this.currentItemIndex];
        console.log(`Checking search ${this.currentItemIndex + 1}/${this.manualSearchUrls.length}`);

        await this.page.goto(nextUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      } else {
        // Just refresh the current page
        await this.page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
      }

      // Extract listings from the page
      const listings = await this.extractListings();

      // Filter for new listings under price threshold
      const newListings = listings.filter(listing => {
        const isNew = !this.seenListings.has(listing.id);
        const underBudget = this.convertToChaos(listing.price, listing.currency) <= this.config.maxPriceChaos;
        return isNew && underBudget;
      });

      // Process new listings
      for (const listing of newListings) {
        this.seenListings.add(listing.id);
        await this.processSniperTarget(listing);
      }

      this.emit('polled', {
        totalListings: listings.length,
        newListings: newListings.length,
        timestamp: new Date(),
        currentSearch: this.manualSearchUrls.length > 0
          ? `${this.currentItemIndex + 1}/${this.manualSearchUrls.length}`
          : '1/1'
      });

    } catch (error) {
      console.error('Error checking listings:', error);
      throw error;
    }
  }

  private async extractListings(): Promise<SniperListing[]> {
    if (!this.page) return [];

    const listings = await this.page.evaluate(() => {
      const results: any[] = [];
      const listingElements = document.querySelectorAll('.resultset > div[data-id]');

      listingElements.forEach((element, index) => {
        // Only get first 10 listings for speed
        if (index >= 10) return;

        const id = element.getAttribute('data-id') || '';

        // Extract price
        const priceElement = element.querySelector('.price .currency-text');
        const currencyElement = element.querySelector('.price .currency-image');
        const price = priceElement?.textContent?.trim() || '';
        const currencyAlt = currencyElement?.getAttribute('alt') || 'chaos';

        // Extract seller
        const sellerElement = element.querySelector('.profile-link span');
        const seller = sellerElement?.textContent?.trim() || 'Unknown';

        // Extract item name
        const itemElement = element.querySelector('.item-cell .first-line');
        const itemName = itemElement?.textContent?.trim() || 'Unknown Item';

        // Extract indexed time
        const timeElement = element.querySelector('.time');
        const indexed = timeElement?.textContent?.trim() || '';

        // Extract whisper button
        const whisperButton = element.querySelector('.whisper-btn') as HTMLElement;
        const whisperMessage = whisperButton?.getAttribute('data-clipboard-text') || '';

        results.push({
          id,
          itemName,
          price: parseFloat(price) || 0,
          currency: currencyAlt,
          seller,
          whisperMessage,
          indexed,
          age: indexed
        });
      });

      return results;
    });

    return listings.map(l => ({
      ...l,
      listedAt: new Date()
    }));
  }

  private async processSniperTarget(listing: SniperListing): Promise<void> {
    console.log(`🎯 SNIPE TARGET: ${listing.itemName} for ${listing.price} ${listing.currency} from ${listing.seller}`);

    // Emit event for UI notification
    this.emit('snipe', listing);

    // Play sound if enabled
    if (this.config.soundNotification) {
      this.playNotificationSound();
    }

    // Auto-whisper if enabled
    if (this.config.autoWhisper) {
      await this.autoWhisper(listing);
    } else {
      // Just copy to clipboard
      clipboard.writeText(listing.whisperMessage);
      console.log('Whisper message copied to clipboard');
    }
  }

  private async autoWhisper(listing: SniperListing): Promise<void> {
    if (!this.page) return;

    try {
      // Find and click the whisper button for this listing
      await this.page.evaluate((listingId) => {
        const listingElement = document.querySelector(`div[data-id="${listingId}"]`);
        if (listingElement) {
          const whisperBtn = listingElement.querySelector('.whisper-btn') as HTMLElement;
          if (whisperBtn) {
            whisperBtn.click();
          }
        }
      }, listing.id);

      console.log(`✅ Auto-whispered ${listing.seller}`);
      this.emit('whispered', listing);

      // Copy to clipboard as backup
      clipboard.writeText(listing.whisperMessage);

    } catch (error) {
      console.error('Error auto-whispering:', error);
      // Fallback: just copy to clipboard
      clipboard.writeText(listing.whisperMessage);
    }
  }

  private convertToChaos(price: number, currency: string): number {
    // Simple currency conversion - you can expand this
    const rates: Record<string, number> = {
      'chaos': 1,
      'divine': 200, // Approximate, should be fetched from poe.ninja
      'exalted': 1, // Legacy
      'mirror': 150000,
      'orb of alteration': 0.1,
      'orb of alchemy': 0.3,
      'chromatic orb': 0.05,
      'jeweller\'s orb': 0.1,
      'orb of fusing': 0.5,
      'vaal orb': 0.3,
      'gemcutter\'s prism': 1,
      'cartographer\'s chisel': 0.2,
      'orb of scouring': 0.5,
      'blessed orb': 0.3,
      'orb of regret': 0.8
    };

    const rate = rates[currency.toLowerCase()] || 1;
    return price * rate;
  }

  private async checkLogin(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Check if logged in by looking for account-related elements
      const loggedIn = await this.page.evaluate(() => {
        // Check for login link vs account dropdown
        const loginLink = document.querySelector('a[href*="login"]');
        const accountDropdown = document.querySelector('.profile-link, .user-name');
        return !loginLink && !!accountDropdown;
      });

      return loggedIn;
    } catch (error) {
      console.error('Error checking login:', error);
      return false;
    }
  }

  private playNotificationSound(): void {
    // Sound notification is handled by the renderer process
    // This is just a placeholder in the main process
    console.log('Playing notification sound (handled by renderer)');
  }

  updateConfig(newConfig: Partial<SniperConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  getConfig(): SniperConfig {
    return { ...this.config };
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      seenListings: this.seenListings.size,
      config: this.config
    };
  }

  clearSeenListings(): void {
    this.seenListings.clear();
    console.log('Cleared seen listings cache');
  }
}

// Factory function for easy instantiation
export function createTradeSniper(
  browserManager: BrowserManager,
  config: SniperConfig
): TradeSniper {
  return new TradeSniper(browserManager, config);
}
