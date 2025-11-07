/**
 * MaxRoll.gg Crafting Guide Scraper
 *
 * Scrapes comprehensive crafting guides from maxroll.gg/poe/crafting
 * Covers basic to intermediate crafting methods and techniques
 */

import { browserManager } from './browserManager';
import { RateLimiter } from './rateLimiter';
import * as fs from 'fs-extra';
import * as path from 'path';

const CACHE_DIR = path.join(__dirname, '../data/maxroll-crafting-cache');
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// Rate limiter for maxroll.gg
const rateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60000,
  minDelay: 3000,
  maxConcurrent: 1,
  retryAttempts: 2,
  retryDelayMs: 5000
});

const SESSION_ID = 'maxroll-crafting-scraper';

export interface MaxRollCraftingMethod {
  name: string;
  category: string; // "Basic", "Intermediate", "Advanced"
  description: string;
  steps: string[];
  requirements?: string[];
  costEstimate?: string;
  pros?: string[];
  cons?: string[];
  bestUseCase?: string;
}

export interface MaxRollCraftingSection {
  title: string;
  description: string;
  methods: MaxRollCraftingMethod[];
  tips?: string[];
  examples?: string[];
}

export interface MaxRollCraftingData {
  sections: MaxRollCraftingSection[];
  generalTips: string[];
  craftingMethods: MaxRollCraftingMethod[];
  lastUpdated: number;
}

export class MaxRollCraftingScraper {
  private cache: MaxRollCraftingData | null = null;

  constructor() {
    this.ensureCacheDir();
  }

  private async ensureCacheDir() {
    await fs.ensureDir(CACHE_DIR);
  }

  /**
   * Load cached data if available and not expired
   */
  private async loadFromCache(): Promise<MaxRollCraftingData | null> {
    if (this.cache) {
      return this.cache;
    }

    const cacheFile = path.join(CACHE_DIR, 'maxroll-crafts.json');
    try {
      if (await fs.pathExists(cacheFile)) {
        const data = await fs.readJson(cacheFile);
        if (Date.now() - data.lastUpdated < CACHE_DURATION) {
          this.cache = data;
          return data;
        }
      }
    } catch (error) {
      console.error('Failed to load MaxRoll crafting cache:', error);
    }
    return null;
  }

  /**
   * Save data to cache
   */
  private async saveToCache(data: MaxRollCraftingData) {
    this.cache = data;
    const cacheFile = path.join(CACHE_DIR, 'maxroll-crafts.json');
    try {
      await fs.writeJson(cacheFile, data, { spaces: 2 });
      console.log(`   💾 Saved MaxRoll crafting guides to cache`);
    } catch (error) {
      console.error('Failed to save MaxRoll crafting cache:', error);
    }
  }

  /**
   * Scrape all crafting guides from maxroll.gg/poe/crafting
   */
  async scrapeAllGuides(): Promise<MaxRollCraftingData> {
    // Check cache first
    const cached = await this.loadFromCache();
    if (cached) {
      console.log('📦 Using cached MaxRoll crafting guides');
      return cached;
    }

    console.log('\n📖 Scraping MaxRoll crafting guides from maxroll.gg/poe/crafting...');

    return await rateLimiter.execute('maxroll.gg', async () => {
      const page = await browserManager.createPage(SESSION_ID, true);

      try {
        const url = 'https://maxroll.gg/poe/crafting';
        console.log(`   Loading: ${url}`);

        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });

        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 4000));

        // Try to close any popups or cookie banners
        try {
          await page.evaluate(() => {
            // @ts-ignore
            const closeButtons = document.querySelectorAll('[class*="close"], [class*="dismiss"], [aria-label*="close"]');
            closeButtons.forEach((btn: any) => btn.click?.());
          });
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          // Ignore popup errors
        }

        // Extract all crafting content
        const craftingData = await page.evaluate(() => {
          const sections: any[] = [];
          const generalTips: string[] = [];
          const methods: any[] = [];

          // @ts-ignore - document is available in browser context
          const mainContent = document.querySelector('main, article, .content, [class*="content"]');

          if (!mainContent) {
            return { sections: [], generalTips: [], methods: [] };
          }

          // Find all headings and content blocks
          // @ts-ignore
          const headings = mainContent.querySelectorAll('h1, h2, h3, h4');

          console.log(`Found ${headings.length} headings`);

          let currentSection: any = null;
          let currentMethod: any = null;

          // @ts-ignore
          const allElements = mainContent.querySelectorAll('h1, h2, h3, h4, h5, p, ul, ol, li, table, tr, td, th, div[class*="card"], div[class*="section"]');

          allElements.forEach((elem: any) => {
            const text = elem.textContent?.trim();
            if (!text || text.length < 2) return;

            const tag = elem.tagName.toLowerCase();

            // Check for section headers
            if (tag === 'h2' || tag === 'h3') {
              // Save previous section
              if (currentSection) {
                sections.push(currentSection);
              }

              // Start new section
              currentSection = {
                title: text,
                description: '',
                methods: [],
                tips: [],
                examples: []
              };
              currentMethod = null;
            }
            // Check for method headers
            else if (tag === 'h4' || tag === 'h5') {
              // Save previous method
              if (currentMethod && currentSection) {
                currentSection.methods.push(currentMethod);
              }

              // Start new method
              currentMethod = {
                name: text,
                category: 'General',
                description: '',
                steps: [],
                requirements: [],
                pros: [],
                cons: []
              };
            }
            // Extract content
            else if (tag === 'p') {
              if (currentMethod) {
                if (text.match(/^step|^\d+\./i)) {
                  currentMethod.steps.push(text);
                } else if (currentMethod.description.length < 300) {
                  currentMethod.description = currentMethod.description
                    ? currentMethod.description + ' ' + text
                    : text;
                }
              } else if (currentSection) {
                if (currentSection.description.length < 500) {
                  currentSection.description = currentSection.description
                    ? currentSection.description + ' ' + text
                    : text;
                }
              } else {
                generalTips.push(text);
              }
            }
            // Extract lists
            else if (tag === 'li') {
              if (currentMethod) {
                // Check if this is a pro/con list
                if (text.match(/^pro:|advantage:|benefit:/i)) {
                  currentMethod.pros.push(text.replace(/^pro:|advantage:|benefit:/i, '').trim());
                } else if (text.match(/^con:|disadvantage:|drawback:/i)) {
                  currentMethod.cons.push(text.replace(/^con:|disadvantage:|drawback:/i, '').trim());
                } else if (text.match(/^step|^\d+/)) {
                  currentMethod.steps.push(text);
                } else if (text.match(/^require|need|must have/i)) {
                  currentMethod.requirements.push(text);
                } else {
                  currentMethod.steps.push(text);
                }
              } else if (currentSection) {
                currentSection.tips.push(text);
              }
            }
          });

          // Save last section and method
          if (currentMethod && currentSection) {
            currentSection.methods.push(currentMethod);
          }
          if (currentSection) {
            sections.push(currentSection);
          }

          return {
            sections,
            generalTips,
            methods
          };
        });

        console.log(`   ✅ Extracted ${craftingData.sections.length} sections`);
        console.log(`   ✅ Found ${craftingData.generalTips.length} general tips`);

        // Parse and categorize methods
        const allMethods = this.extractAllMethods(craftingData);

        const result: MaxRollCraftingData = {
          sections: craftingData.sections,
          generalTips: craftingData.generalTips,
          craftingMethods: allMethods,
          lastUpdated: Date.now()
        };

        // Save to cache
        await this.saveToCache(result);

        return result;

      } catch (error: any) {
        console.error(`   ❌ Failed to scrape MaxRoll crafting guides:`, error.message);

        // Return empty data if scraping fails
        return {
          sections: [],
          generalTips: [],
          craftingMethods: [],
          lastUpdated: Date.now()
        };
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Extract and categorize all crafting methods
   */
  private extractAllMethods(data: any): MaxRollCraftingMethod[] {
    const methods: MaxRollCraftingMethod[] = [];

    for (const section of data.sections) {
      for (const method of section.methods || []) {
        // Categorize based on keywords
        let category = 'General';
        const nameAndDesc = (method.name + ' ' + method.description).toLowerCase();

        if (nameAndDesc.match(/basic|beginner|starter|simple|cheap/)) {
          category = 'Basic';
        } else if (nameAndDesc.match(/intermediate|mid|moderate/)) {
          category = 'Intermediate';
        } else if (nameAndDesc.match(/advanced|endgame|expensive|complex/)) {
          category = 'Advanced';
        }

        // Extract cost if available
        let costEstimate;
        const costMatch = method.description.match(/(\d+(?:,\d+)?)\s*(chaos|divine|exalt|c)/i);
        if (costMatch) {
          costEstimate = `${costMatch[1]}${costMatch[2]}`;
        }

        methods.push({
          name: method.name,
          category,
          description: method.description,
          steps: method.steps || [],
          requirements: method.requirements || [],
          costEstimate,
          pros: method.pros || [],
          cons: method.cons || [],
          bestUseCase: this.extractBestUseCase(method)
        });
      }
    }

    return methods;
  }

  /**
   * Extract best use case from method description
   */
  private extractBestUseCase(method: any): string | undefined {
    const text = (method.description + ' ' + (method.steps || []).join(' ')).toLowerCase();

    if (text.match(/budget|cheap|starter/)) return 'Budget crafting';
    if (text.match(/weapon|damage|dps/)) return 'Weapon crafting';
    if (text.match(/armour|defense|es|energy shield/)) return 'Armour crafting';
    if (text.match(/jewel|abyss/)) return 'Jewel crafting';
    if (text.match(/flask/)) return 'Flask crafting';
    if (text.match(/endgame|mirror|perfect/)) return 'Endgame crafting';

    return undefined;
  }

  /**
   * Get methods by category
   */
  async getMethodsByCategory(category: 'Basic' | 'Intermediate' | 'Advanced'): Promise<MaxRollCraftingMethod[]> {
    const data = await this.scrapeAllGuides();
    return data.craftingMethods.filter(m => m.category === category);
  }

  /**
   * Search methods by keyword
   */
  async searchMethods(keyword: string): Promise<MaxRollCraftingMethod[]> {
    const data = await this.scrapeAllGuides();
    const keywordLower = keyword.toLowerCase();

    return data.craftingMethods.filter(m =>
      m.name.toLowerCase().includes(keywordLower) ||
      m.description.toLowerCase().includes(keywordLower) ||
      m.steps.some(s => s.toLowerCase().includes(keywordLower))
    );
  }

  /**
   * Get all sections
   */
  async getAllSections(): Promise<MaxRollCraftingSection[]> {
    const data = await this.scrapeAllGuides();
    return data.sections;
  }

  /**
   * Get general tips
   */
  async getGeneralTips(): Promise<string[]> {
    const data = await this.scrapeAllGuides();
    return data.generalTips;
  }

  /**
   * Get method by name
   */
  async getMethodByName(name: string): Promise<MaxRollCraftingMethod | null> {
    const data = await this.scrapeAllGuides();
    const nameLower = name.toLowerCase();

    return data.craftingMethods.find(m =>
      m.name.toLowerCase().includes(nameLower)
    ) || null;
  }

  /**
   * Get basic crafting methods (good for beginners)
   */
  async getBasicMethods(): Promise<MaxRollCraftingMethod[]> {
    return this.getMethodsByCategory('Basic');
  }

  /**
   * Get intermediate crafting methods
   */
  async getIntermediateMethods(): Promise<MaxRollCraftingMethod[]> {
    return this.getMethodsByCategory('Intermediate');
  }
}

export const maxRollCraftingScraper = new MaxRollCraftingScraper();
