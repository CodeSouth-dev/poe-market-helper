/**
 * Pohx.net Crafting Guide Scraper
 *
 * Scrapes comprehensive crafting guides from pohx.net/crafts
 * Covers 14 different crafting sections for various items and game stages
 */

import { browserManager } from './browserManager';
import { RateLimiter } from './rateLimiter';
import * as fs from 'fs-extra';
import * as path from 'path';

const CACHE_DIR = path.join(__dirname, '../data/pohx-crafting-cache');
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days (crafting guides don't change often)

// Rate limiter for pohx.net (be respectful)
const rateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60000,
  minDelay: 3000,
  maxConcurrent: 1,
  retryAttempts: 2,
  retryDelayMs: 5000
});

const SESSION_ID = 'pohx-crafting-scraper';

export interface CraftingStep {
  stepNumber: number;
  description: string;
  method: string; // e.g., "Use Essence", "Harvest Craft", "Fossil Craft"
  cost?: string;
  notes?: string;
}

export interface CraftingGuide {
  title: string;
  itemType: string; // e.g., "Helmet", "Body Armour", "Weapon"
  difficulty: string; // e.g., "Beginner", "Advanced", "Endgame"
  estimatedCost?: string;
  steps: CraftingStep[];
  tips?: string[];
  warnings?: string[];
}

export interface PohxCraftingData {
  sections: {
    [sectionName: string]: CraftingGuide[];
  };
  lastUpdated: number;
}

export class PohxCraftingScraper {
  private cache: PohxCraftingData | null = null;

  constructor() {
    this.ensureCacheDir();
  }

  private async ensureCacheDir() {
    await fs.ensureDir(CACHE_DIR);
  }

  /**
   * Load cached data if available and not expired
   */
  private async loadFromCache(): Promise<PohxCraftingData | null> {
    if (this.cache) {
      return this.cache;
    }

    const cacheFile = path.join(CACHE_DIR, 'pohx-crafts.json');
    try {
      if (await fs.pathExists(cacheFile)) {
        const data = await fs.readJson(cacheFile);
        if (Date.now() - data.lastUpdated < CACHE_DURATION) {
          this.cache = data;
          return data;
        }
      }
    } catch (error) {
      console.error('Failed to load pohx crafting cache:', error);
    }
    return null;
  }

  /**
   * Save data to cache
   */
  private async saveToCache(data: PohxCraftingData) {
    this.cache = data;
    const cacheFile = path.join(CACHE_DIR, 'pohx-crafts.json');
    try {
      await fs.writeJson(cacheFile, data, { spaces: 2 });
      console.log(`   💾 Saved Pohx crafting guides to cache`);
    } catch (error) {
      console.error('Failed to save pohx crafting cache:', error);
    }
  }

  /**
   * Scrape all crafting guides from pohx.net/crafts
   */
  async scrapeAllGuides(): Promise<PohxCraftingData> {
    // Check cache first
    const cached = await this.loadFromCache();
    if (cached) {
      console.log('📦 Using cached Pohx crafting guides');
      return cached;
    }

    console.log('\n📖 Scraping Pohx crafting guides from pohx.net/crafts...');

    return await rateLimiter.execute('pohx.net', async () => {
      const page = await browserManager.createPage(SESSION_ID, false); // Use visible browser to avoid detection

      try {
        const url = 'https://pohx.net/crafts/';
        console.log(`   Loading: ${url}`);

        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });

        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check for tabs, accordions, or buttons to expand all sections
        console.log('   🔍 Looking for tabs/sections to expand...');
        await page.evaluate(() => {
          // @ts-ignore - document is available in browser context
          const tabs = document.querySelectorAll('[role="tab"], .tab, [class*="tab"], button[class*="section"]');
          console.log(`Found ${tabs.length} tabs/buttons`);

          // Click all tabs to load their content
          tabs.forEach((tab: any, index: number) => {
            console.log(`Clicking tab ${index + 1}: ${tab.textContent?.trim()}`);
            tab.click?.();
          });

          // @ts-ignore
          const accordions = document.querySelectorAll('[class*="accordion"], [class*="collapse"], [class*="expand"], details');
          console.log(`Found ${accordions.length} accordions`);

          // Expand all accordions/collapsible sections
          accordions.forEach((accordion: any, index: number) => {
            console.log(`Expanding section ${index + 1}`);
            if (accordion.tagName === 'DETAILS') {
              accordion.open = true;
            } else {
              accordion.click?.();
            }
          });
        });

        // Wait for all content to load after clicking
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check for links to other crafting pages
        const subPages = await page.evaluate(() => {
          // @ts-ignore - document and window available in browser context
          const links = document.querySelectorAll('a[href*="craft"], a[href*="guide"]');
          const pages: string[] = [];

          links.forEach((link: any) => {
            const href = link.href;
            // @ts-ignore
            if (href && href.includes('pohx.net') && href !== window.location.href) {
              pages.push(href);
            }
          });

          return [...new Set(pages)]; // Remove duplicates
        });

        console.log(`   📄 Found ${subPages.length} sub-pages to scrape`);

        // Extract all crafting guides from main page
        const craftingData = await page.evaluate(() => {
          const sections: any = {};

          // Try to find main sections/categories
          // @ts-ignore - document is available in browser context
          const sectionHeaders = document.querySelectorAll('h2, h3, .section-header, [class*="section"]');

          console.log(`Found ${sectionHeaders.length} potential sections`);

          // Extract all text content organized by sections
          let currentSection = 'General';
          sections[currentSection] = [];

          // @ts-ignore
          const allElements = document.querySelectorAll('h1, h2, h3, h4, p, ul, ol, li, div, pre, code');

          allElements.forEach((elem: any) => {
            const text = elem.textContent?.trim();
            if (!text) return;

            // Check if this is a section header
            if (elem.tagName === 'H2' || elem.tagName === 'H3') {
              currentSection = text;
              if (!sections[currentSection]) {
                sections[currentSection] = [];
              }
            } else {
              // Add content to current section
              if (!sections[currentSection]) {
                sections[currentSection] = [];
              }
              sections[currentSection].push({
                type: elem.tagName.toLowerCase(),
                content: text
              });
            }
          });

          return {
            sections,
            // Also grab the full HTML for parsing later if needed
            // @ts-ignore
            fullHTML: document.body.innerHTML
          };
        });

        console.log(`   ✅ Extracted ${Object.keys(craftingData.sections).length} sections from main page`);

        // Scrape sub-pages if found (limit to first 10 to avoid overwhelming)
        for (let i = 0; i < Math.min(subPages.length, 10); i++) {
          const subPageUrl = subPages[i];
          console.log(`   📄 Scraping sub-page ${i + 1}/${Math.min(subPages.length, 10)}: ${subPageUrl}`);

          try {
            await page.goto(subPageUrl, { waitUntil: 'networkidle0', timeout: 30000 });
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Extract content from sub-page
            const subPageData = await page.evaluate(() => {
              const sections: any = {};
              // @ts-ignore
              const allElements = document.querySelectorAll('h1, h2, h3, h4, p, ul, ol, li');
              let currentSection = 'SubPage Content';
              sections[currentSection] = [];

              allElements.forEach((elem: any) => {
                const text = elem.textContent?.trim();
                if (!text) return;

                if (elem.tagName === 'H2' || elem.tagName === 'H3') {
                  currentSection = text;
                  if (!sections[currentSection]) {
                    sections[currentSection] = [];
                  }
                } else {
                  if (!sections[currentSection]) {
                    sections[currentSection] = [];
                  }
                  sections[currentSection].push({
                    type: elem.tagName.toLowerCase(),
                    content: text
                  });
                }
              });

              return { sections };
            });

            // Merge sub-page sections into main data
            for (const [sectionName, content] of Object.entries(subPageData.sections)) {
              if (!craftingData.sections[sectionName]) {
                craftingData.sections[sectionName] = content;
              } else {
                // Append to existing section
                craftingData.sections[sectionName] = [
                  ...(craftingData.sections[sectionName] as any[]),
                  ...(content as any[])
                ];
              }
            }

            console.log(`      ✅ Added content from sub-page`);

            // Rate limit between sub-pages
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error: any) {
            console.error(`      ❌ Failed to scrape sub-page: ${error.message}`);
          }
        }

        console.log(`   ✅ Total sections after all pages: ${Object.keys(craftingData.sections).length}`);

        // Parse the sections into structured guides
        const structuredData = this.parseScrapedData(craftingData);

        // Save to cache
        await this.saveToCache(structuredData);

        return structuredData;

      } catch (error: any) {
        console.error(`   ❌ Failed to scrape pohx crafting guides:`, error.message);

        // Return empty data if scraping fails
        return {
          sections: {},
          lastUpdated: Date.now()
        };
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Parse scraped data into structured crafting guides
   */
  private parseScrapedData(scrapedData: any): PohxCraftingData {
    const structuredSections: { [key: string]: CraftingGuide[] } = {};

    for (const [sectionName, contentArray] of Object.entries(scrapedData.sections)) {
      if (!Array.isArray(contentArray) || contentArray.length === 0) continue;

      const guides: CraftingGuide[] = [];
      let currentGuide: Partial<CraftingGuide> | null = null;
      let currentSteps: CraftingStep[] = [];
      let stepCounter = 1;

      for (const item of contentArray as any[]) {
        const content = item.content;
        const type = item.type;

        // Check if this looks like a new guide (item type header)
        if (type === 'h4' || type === 'h5' || content.match(/^(helmet|body armour|boots|gloves|weapon|shield|ring|amulet|belt)/i)) {
          // Save previous guide
          if (currentGuide) {
            guides.push({
              title: currentGuide.title || sectionName,
              itemType: currentGuide.itemType || 'Unknown',
              difficulty: currentGuide.difficulty || 'General',
              estimatedCost: currentGuide.estimatedCost,
              steps: currentSteps,
              tips: currentGuide.tips || [],
              warnings: currentGuide.warnings || []
            } as CraftingGuide);
          }

          // Start new guide
          currentGuide = {
            title: content,
            itemType: this.extractItemType(content),
            difficulty: this.extractDifficulty(content),
            tips: [],
            warnings: []
          };
          currentSteps = [];
          stepCounter = 1;
        }

        // Extract steps
        if (content.match(/^step \d+|^\d+\.|^-\s/i) || type === 'li') {
          const step: CraftingStep = {
            stepNumber: stepCounter++,
            description: content.replace(/^(step \d+:?|\d+\.|-)\s*/i, ''),
            method: this.extractMethod(content),
            cost: this.extractCost(content)
          };
          currentSteps.push(step);
        }

        // Extract costs
        if (content.match(/cost|price|chaos|divine|exalt/i)) {
          if (currentGuide && !currentGuide.estimatedCost) {
            currentGuide.estimatedCost = this.extractCost(content) || content;
          }
        }

        // Extract tips
        if (content.match(/tip|note|important/i) && type === 'p') {
          if (currentGuide) {
            currentGuide.tips?.push(content);
          }
        }

        // Extract warnings
        if (content.match(/warning|caution|careful|avoid/i) && type === 'p') {
          if (currentGuide) {
            currentGuide.warnings?.push(content);
          }
        }
      }

      // Save last guide
      if (currentGuide && currentSteps.length > 0) {
        guides.push({
          title: currentGuide.title || sectionName,
          itemType: currentGuide.itemType || 'Unknown',
          difficulty: currentGuide.difficulty || 'General',
          estimatedCost: currentGuide.estimatedCost,
          steps: currentSteps,
          tips: currentGuide.tips || [],
          warnings: currentGuide.warnings || []
        } as CraftingGuide);
      }

      if (guides.length > 0) {
        structuredSections[sectionName] = guides;
      }
    }

    return {
      sections: structuredSections,
      lastUpdated: Date.now()
    };
  }

  /**
   * Extract item type from text
   */
  private extractItemType(text: string): string {
    const itemTypes = [
      'Helmet', 'Body Armour', 'Gloves', 'Boots', 'Shield',
      'Weapon', 'Sword', 'Axe', 'Mace', 'Bow', 'Wand', 'Dagger', 'Claw', 'Staff',
      'Ring', 'Amulet', 'Belt', 'Jewel', 'Flask'
    ];

    for (const type of itemTypes) {
      if (text.toLowerCase().includes(type.toLowerCase())) {
        return type;
      }
    }

    return 'General';
  }

  /**
   * Extract difficulty from text
   */
  private extractDifficulty(text: string): string {
    if (text.match(/beginner|starter|early|budget|cheap/i)) return 'Beginner';
    if (text.match(/advanced|mid-?game|intermediate/i)) return 'Advanced';
    if (text.match(/endgame|end-?game|expensive|mirror/i)) return 'Endgame';
    return 'General';
  }

  /**
   * Extract crafting method from text
   */
  private extractMethod(text: string): string {
    if (text.match(/essence/i)) return 'Essence Crafting';
    if (text.match(/fossil/i)) return 'Fossil Crafting';
    if (text.match(/harvest/i)) return 'Harvest Crafting';
    if (text.match(/awakener|conqueror/i)) return 'Awakener Orb';
    if (text.match(/eldritch/i)) return 'Eldritch Crafting';
    if (text.match(/recombinator/i)) return 'Recombinator';
    if (text.match(/alteration|aug|regal/i)) return 'Alteration Spam';
    if (text.match(/chaos orb|chaos spam/i)) return 'Chaos Spam';
    if (text.match(/metacraft|suffix|prefix cannot be changed/i)) return 'Metacrafting';
    if (text.match(/beast craft|einhar/i)) return 'Beast Crafting';
    return 'General';
  }

  /**
   * Extract cost from text
   */
  private extractCost(text: string): string | undefined {
    const costMatch = text.match(/(\d+(?:,\d+)?(?:\.\d+)?)\s*(chaos|divine|exalt|c|div)/i);
    if (costMatch) {
      return `${costMatch[1]}${costMatch[2]}`;
    }
    return undefined;
  }

  /**
   * Get guides for a specific item type
   */
  async getGuidesByItemType(itemType: string): Promise<CraftingGuide[]> {
    const data = await this.scrapeAllGuides();
    const guides: CraftingGuide[] = [];

    for (const sectionGuides of Object.values(data.sections)) {
      guides.push(...sectionGuides.filter(g =>
        g.itemType.toLowerCase().includes(itemType.toLowerCase())
      ));
    }

    return guides;
  }

  /**
   * Get guides by difficulty
   */
  async getGuidesByDifficulty(difficulty: string): Promise<CraftingGuide[]> {
    const data = await this.scrapeAllGuides();
    const guides: CraftingGuide[] = [];

    for (const sectionGuides of Object.values(data.sections)) {
      guides.push(...sectionGuides.filter(g =>
        g.difficulty.toLowerCase() === difficulty.toLowerCase()
      ));
    }

    return guides;
  }

  /**
   * Search guides by keyword
   */
  async searchGuides(keyword: string): Promise<CraftingGuide[]> {
    const data = await this.scrapeAllGuides();
    const guides: CraftingGuide[] = [];
    const keywordLower = keyword.toLowerCase();

    for (const sectionGuides of Object.values(data.sections)) {
      guides.push(...sectionGuides.filter(g =>
        g.title.toLowerCase().includes(keywordLower) ||
        g.itemType.toLowerCase().includes(keywordLower) ||
        g.steps.some(s => s.description.toLowerCase().includes(keywordLower))
      ));
    }

    return guides;
  }

  /**
   * Get all sections
   */
  async getAllSections(): Promise<string[]> {
    const data = await this.scrapeAllGuides();
    return Object.keys(data.sections);
  }

  /**
   * Get guides for a specific section
   */
  async getSection(sectionName: string): Promise<CraftingGuide[]> {
    const data = await this.scrapeAllGuides();
    return data.sections[sectionName] || [];
  }
}

export const pohxCraftingScraper = new PohxCraftingScraper();
