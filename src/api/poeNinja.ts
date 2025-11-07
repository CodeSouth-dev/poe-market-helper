import axios from 'axios';

export interface PoeNinjaItem {
  name: string;
  chaosValue: number;
  exaltedValue?: number;
  divineValue?: number;
  count: number;
  detailsId?: string;
  listingCount?: number;
  links?: number;
  mapTier?: number;
  levelRequired?: number;
  baseType?: string;
  variant?: string;
  itemClass?: string;
  implicitModifiers?: Array<{ text: string; optional?: boolean }>;
  explicitModifiers?: Array<{ text: string; optional?: boolean }>;
}

export interface BuildItem {
  name: string;
  baseType: string;
  itemClass: string;
  chaosValue: number;
  count: number; // How many builds use this
  listingCount: number;
  mods: {
    implicit: string[];
    explicit: string[];
    prefixes: string[];
    suffixes: string[];
  };
  craftingStrategy: {
    method: string;
    steps: string[];
    estimatedCost: number;
    difficulty: 'Easy' | 'Medium' | 'Hard' | 'Very Hard';
    successRate: string;
  };
}

export interface PoeNinjaResponse {
  lines: PoeNinjaItem[];
  currencyDetails?: any[];
  language?: any;
}

export interface SearchResult {
  itemName: string;
  league: string;
  results: PoeNinjaItem[];
  timestamp: Date;
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
  totalListings: number;
}

export class PoeNinjaAPI {
  private readonly baseUrl = 'https://poe.ninja/api/data';
  private readonly timeout = 10000; // 10 seconds

  /**
   * Search for an item across different categories
   */
  async searchItem(itemName: string, league: string): Promise<SearchResult> {
    const searchTerm = itemName.toLowerCase().trim();
    let allResults: PoeNinjaItem[] = [];

    // Define the categories to search
    const categories = [
      'UniqueWeapon',
      'UniqueArmour',
      'UniqueAccessory',
      'UniqueFlask',
      'UniqueJewel',
      'UniqueMap',
      'SkillGem',
      'Currency',
      'Fragment',
      'Essence',
      'DivinationCard',
      'Oil',
      'Incubator',
      'Scarab',
      'Fossil',
      'Resonator',
      'Beast'
    ];

    // Search through each category
    for (const category of categories) {
      try {
        const categoryResults = await this.searchCategory(searchTerm, league, category);
        allResults = allResults.concat(categoryResults);
      } catch (error: any) {
        console.warn(`Failed to search category ${category}:`, error.message);
        // Continue with other categories
      }
    }

    // Filter and sort results
    const filteredResults = allResults.filter(item => 
      item.name.toLowerCase().includes(searchTerm) ||
      (item.baseType && item.baseType.toLowerCase().includes(searchTerm))
    );

    // Calculate statistics
    const prices = filteredResults.map(item => item.chaosValue).filter(price => price > 0);
    const totalListings = filteredResults.reduce((sum, item) => sum + (item.listingCount || item.count || 0), 0);

    return {
      itemName,
      league,
      results: filteredResults,
      timestamp: new Date(),
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      medianPrice: this.calculateMedian(prices),
      totalListings
    };
  }

  /**
   * Search a specific category
   */
  public async searchCategory(searchTerm: string, league: string, category: string): Promise<PoeNinjaItem[]> {
    const endpoint = this.getCategoryEndpoint(category);
    const url = `${this.baseUrl}/${endpoint}`;
    
    const params = {
      league,
      type: category,
      language: 'en'
    };

    try {
      const response = await axios.get<PoeNinjaResponse>(url, {
        params,
        timeout: this.timeout,
        headers: {
          'User-Agent': 'PoE-Market-Helper/1.0.0'
        }
      });

      if (!response.data || !response.data.lines) {
        return [];
      }

      // Filter results that match the search term
      return response.data.lines.filter(item => {
        const name = item.name.toLowerCase();
        const baseType = item.baseType ? item.baseType.toLowerCase() : '';
        return name.includes(searchTerm) || baseType.includes(searchTerm);
      });

    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Timeout searching ${category}`);
      }
      throw new Error(`Failed to search ${category}: ${error.message}`);
    }
  }

  /**
   * Get the correct endpoint for each category
   */
  private getCategoryEndpoint(category: string): string {
    const currencyTypes = ['Currency', 'Fragment'];
    return currencyTypes.includes(category) ? 'currencyoverview' : 'itemoverview';
  }

  /**
   * Calculate median from array of numbers
   */
  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Get available leagues by testing the API
   */
  async getLeagues(): Promise<string[]> {
    try {
      // Known possible leagues to test - ordered by recency (current league first)
      const leaguesToTest = [
        'Keepers of the Flame',
        'Keepers',
        'Settlers of Kalguur',
        'Settlers',
        'Standard',
        'Hardcore',
        'SSF Standard',
        'SSF Hardcore'
      ];

      const validLeagues: string[] = [];

      // Test each league by attempting to fetch currency data
      for (const league of leaguesToTest) {
        try {
          const url = `${this.baseUrl}/currencyoverview`;
          const response = await axios.get(url, {
            params: { league, type: 'Currency' },
            timeout: 5000
          });

          if (response.data && response.data.lines && response.data.lines.length > 0) {
            validLeagues.push(league);
          }
        } catch (error) {
          // League doesn't exist or API error, skip it
          continue;
        }
      }

      // Always include Standard as fallback
      if (validLeagues.length === 0) {
        validLeagues.push('Standard', 'Hardcore');
      }

      console.log('Available leagues:', validLeagues);
      return validLeagues;
    } catch (error) {
      console.error('Failed to fetch leagues:', error);
      return ['Keepers of the Flame', 'Standard', 'Hardcore']; // Fallback with current league
    }
  }

  /**
   * Get popular/high-demand items based on listing counts
   */
  async getPopularItems(league: string, limit: number = 20): Promise<PoeNinjaItem[]> {
    const allItems: PoeNinjaItem[] = [];

    // Categories most relevant for trading
    const categories = [
      'UniqueWeapon',
      'UniqueArmour',
      'UniqueAccessory',
      'UniqueJewel',
      'UniqueFlask',
      'SkillGem'
    ];

    for (const category of categories) {
      try {
        const items = await this.searchCategory('', league, category);
        allItems.push(...items);
      } catch (error) {
        console.warn(`Failed to fetch ${category}:`, error);
      }
    }

    // Sort by listing count (higher = more demand) and value
    const popularItems = allItems
      .filter(item => item.listingCount && item.listingCount > 10) // At least 10 listings
      .sort((a, b) => {
        // Combine listing count and value for popularity score
        const scoreA = (a.listingCount || 0) * 0.7 + (a.chaosValue || 0) * 0.3;
        const scoreB = (b.listingCount || 0) * 0.7 + (b.chaosValue || 0) * 0.3;
        return scoreB - scoreA;
      })
      .slice(0, limit);

    return popularItems;
  }

  /**
   * Get items with best profit margins for crafting
   * Returns all craftable base types including:
   * - Normal/magic/rare items
   * - Fractured items (locked mods, rest craftable)
   * - Synthesized items (special implicit, explicit mods craftable)
   * - Influenced items (Shaper/Elder/Conqueror - prime crafting bases)
   * - 4/5/6-link items (part of crafting process)
   *
   * EXCLUDES:
   * - Unique items (already excluded via BaseType category)
   * - Corrupted items (cannot be modified)
   */
  async getProfitableItems(league: string, limit: number = 20): Promise<Array<{
    item: PoeNinjaItem;
    profitMargin: number;
    sellPrice: number;
    demand: string;
    craftingMethod: string;
  }>> {
    const allItems: PoeNinjaItem[] = [];

    // ONLY use BaseType - these are craftable items
    // Uniques are in separate categories (UniqueWeapon, UniqueArmour, etc.)
    try {
      const baseTypes = await this.searchCategory('', league, 'BaseType');
      allItems.push(...baseTypes);
    } catch (error) {
      console.warn('Failed to fetch base types:', error);
    }

    // Calculate profit margins for craftable bases
    const profitableItems = allItems
      .filter(item => {
        // Must be valuable enough and have decent trading activity
        if (!(item.chaosValue > 20 && item.listingCount && item.listingCount > 3)) {
          return false;
        }

        // Only exclude corrupted items - they cannot be modified
        const variant = (item.variant || '').toLowerCase();
        if (variant.includes('corrupt')) {
          return false;
        }

        // Everything else in BaseType category is craftable:
        // - Normal/magic/rare bases
        // - Fractured bases (locked mods but rest is craftable)
        // - Synthesized bases (implicit locked, explicit craftable)
        // - Influenced bases (Shaper/Elder/Conqueror - valuable crafting bases)
        // - Any link count (4/5/6-link are all craftable)

        return true;
      })
      .map(item => {
        const sellPrice = item.chaosValue;
        const listings = item.listingCount || 0;

        // Estimate crafting cost based on item value
        // Base cost + crafting materials (fossils/essences/chaos)
        let estimatedCraftCost: number;
        let craftingMethod: string;

        if (sellPrice > 500) {
          // High-value items: fossil/essence crafting
          estimatedCraftCost = sellPrice * 0.4;
          craftingMethod = 'Fossil/Essence';
        } else if (sellPrice > 100) {
          // Medium-value: chaos spam or targeted crafting
          estimatedCraftCost = sellPrice * 0.35;
          craftingMethod = 'Chaos/Fossil';
        } else {
          // Lower-value: alteration or chaos spam
          estimatedCraftCost = sellPrice * 0.3;
          craftingMethod = 'Alt/Chaos';
        }

        const profitMargin = sellPrice - estimatedCraftCost;

        // Demand indicator based on listing count
        let demand = 'Low';
        if (listings > 30) demand = 'High';
        else if (listings > 10) demand = 'Medium';

        return {
          item,
          profitMargin,
          sellPrice,
          demand,
          craftingMethod
        };
      })
      .sort((a, b) => b.profitMargin - a.profitMargin)
      .slice(0, limit);

    return profitableItems;
  }

  /**
   * Get trending items (recent price increases)
   */
  async getTrendingItems(league: string, limit: number = 10): Promise<PoeNinjaItem[]> {
    const allItems: PoeNinjaItem[] = [];

    const categories = [
      'UniqueWeapon',
      'UniqueArmour',
      'UniqueAccessory',
      'SkillGem'
    ];

    for (const category of categories) {
      try {
        const items = await this.searchCategory('', league, category);
        allItems.push(...items);
      } catch (error) {
        console.warn(`Failed to fetch ${category}:`, error);
      }
    }

    // Items with higher value and good listing counts are likely trending
    const trending = allItems
      .filter(item => item.chaosValue > 5 && item.listingCount && item.listingCount > 10)
      .sort((a, b) => {
        // Sort by value * listing count (proxy for demand)
        const scoreA = a.chaosValue * Math.log(a.listingCount || 1);
        const scoreB = b.chaosValue * Math.log(b.listingCount || 1);
        return scoreB - scoreA;
      })
      .slice(0, limit);

    return trending;
  }

  /**
   * Get popular craftable items from builds with detailed crafting strategies
   * Analyzes actual mods on popular items and suggests specific crafting methods
   */
  async getBuildCraftableItems(league: string, limit: number = 20): Promise<BuildItem[]> {
    const allItems: PoeNinjaItem[] = [];

    // Get base types that are craftable
    try {
      const baseTypes = await this.searchCategory('', league, 'BaseType');
      allItems.push(...baseTypes);
    } catch (error) {
      console.warn('Failed to fetch base types:', error);
    }

    // Focus on jewelry and high-value gear that are commonly crafted
    const craftableItems = allItems
      .filter(item => {
        // Must be valuable and have trading activity
        if (!(item.chaosValue > 30 && item.listingCount && item.listingCount > 5)) {
          return false;
        }

        // Exclude corrupted items
        const variant = (item.variant || '').toLowerCase();
        if (variant.includes('corrupt')) {
          return false;
        }

        // Focus on commonly crafted item types
        const itemName = item.name.toLowerCase();
        const baseType = (item.baseType || '').toLowerCase();
        const combined = `${itemName} ${baseType}`;

        // Prioritize jewelry (most common crafting targets)
        if (combined.includes('ring') || combined.includes('amulet') || combined.includes('belt')) {
          return true;
        }

        // High-value armor bases
        if (combined.includes('vaal regalia') || combined.includes('slink') ||
            combined.includes('titanium') || combined.includes('hubris') ||
            combined.includes('bone helmet') || combined.includes('elder') ||
            combined.includes('shaper') || combined.includes('crusader') ||
            combined.includes('redeemer') || combined.includes('hunter') ||
            combined.includes('warlord')) {
          return true;
        }

        // Weapon bases
        if (combined.includes('jewel') || combined.includes('siege axe') ||
            combined.includes('exquisite') || combined.includes('opal')) {
          return true;
        }

        return false;
      })
      .sort((a, b) => b.chaosValue - a.chaosValue)
      .slice(0, limit * 2); // Get more to filter later

    // Convert to BuildItems with crafting strategies
    const buildItems: BuildItem[] = craftableItems.map(item => {
      return this.generateCraftingStrategy(item, league);
    }).slice(0, limit);

    return buildItems;
  }

  /**
   * Generate crafting strategy for a specific item based on its characteristics
   */
  private generateCraftingStrategy(item: PoeNinjaItem, league: string): BuildItem {
    const itemName = item.name.toLowerCase();
    const baseType = (item.baseType || item.name).toLowerCase();
    const sellPrice = item.chaosValue;

    // Classify the item
    let itemClass = 'Accessory';
    if (baseType.includes('ring')) itemClass = 'Ring';
    else if (baseType.includes('amulet')) itemClass = 'Amulet';
    else if (baseType.includes('belt')) itemClass = 'Belt';
    else if (baseType.includes('regalia') || baseType.includes('armour')) itemClass = 'Body Armour';
    else if (baseType.includes('helmet') || baseType.includes('helm')) itemClass = 'Helmet';
    else if (baseType.includes('glove')) itemClass = 'Gloves';
    else if (baseType.includes('boot')) itemClass = 'Boots';
    else if (baseType.includes('jewel')) itemClass = 'Jewel';
    else if (baseType.includes('axe') || baseType.includes('sword') || baseType.includes('mace')) itemClass = 'Weapon';

    // Analyze item to determine optimal crafting strategy
    const strategy = this.determineCraftingStrategy(item, itemClass, sellPrice);

    return {
      name: item.name,
      baseType: item.baseType || item.name,
      itemClass,
      chaosValue: sellPrice,
      count: item.count || item.listingCount || 0,
      listingCount: item.listingCount || 0,
      mods: this.extractModInfo(item, strategy.method),
      craftingStrategy: strategy
    };
  }

  /**
   * Determine the best crafting strategy based on item type and value
   */
  private determineCraftingStrategy(item: PoeNinjaItem, itemClass: string, sellPrice: number): {
    method: string;
    steps: string[];
    estimatedCost: number;
    difficulty: 'Easy' | 'Medium' | 'Hard' | 'Very Hard';
    successRate: string;
  } {
    const itemName = item.name.toLowerCase();
    const baseType = (item.baseType || '').toLowerCase();
    const variant = (item.variant || '').toLowerCase();

    // Check for influenced bases
    const isInfluenced = variant.includes('elder') || variant.includes('shaper') ||
                        variant.includes('crusader') || variant.includes('redeemer') ||
                        variant.includes('hunter') || variant.includes('warlord') ||
                        itemName.includes('elder') || itemName.includes('shaper');

    const isFractured = variant.includes('fractured');
    const isSynthesised = variant.includes('synthesised');

    // Jewelry crafting strategies
    if (itemClass === 'Ring' || itemClass === 'Amulet' || itemClass === 'Belt') {
      if (sellPrice > 500) {
        // High-value jewelry - Recombinator or Essence + Harvest
        return {
          method: 'Recombinator + Bench Craft',
          steps: [
            '1. Acquire two ${itemClass} bases (ilvl 82-86 recommended)',
            '2. Craft Item A: Use Essence of Greed (life) or Wrath (ES) to guarantee 1 good prefix',
            '3. Craft Item B: Use Alteration spam to hit a second desired mod (resistance/damage)',
            '4. Use Harvest Reforge (Keep Prefixes/Suffixes) to fill remaining mods',
            '5. Combine both items using Recombinator (1/3 success rate)',
            '6. Use Crafting Bench to add final mod if open slot available',
            '7. Divine to improve roll values if needed'
          ],
          estimatedCost: sellPrice * 0.45,
          difficulty: 'Very Hard',
          successRate: '~33% per recombinator attempt'
        };
      } else if (sellPrice > 150) {
        // Medium jewelry - Essence + Harvest
        return {
          method: 'Essence + Harvest Reforge',
          steps: [
            '1. Buy base ${itemClass} (ilvl 84+ for T1 mods)',
            '2. Use Essence spam to guarantee 1 key mod (e.g., Essence of Greed for Life)',
            '3. Check result - if 1 good mod and 1 open affix: go to step 4',
            '4. Use Harvest Reforge keeping mods to fill remaining slots',
            '5. Options: Reforge Life, Defence, Elemental, etc. based on desired mods',
            '6. Benchcraft final mod if slot available',
            '7. Repeat until satisfied (expect 3-10 attempts)'
          ],
          estimatedCost: sellPrice * 0.35,
          difficulty: 'Medium',
          successRate: '~10-20% depending on target mods'
        };
      } else {
        // Budget jewelry - Alteration + Regal
        return {
          method: 'Alteration + Regal + Bench',
          steps: [
            '1. Buy white ${itemClass} base (ilvl 82+)',
            '2. Use Alteration Orbs until you hit 1-2 desired mods',
            '3. Use Regal Orb to add a 3rd mod (roll the dice)',
            '4. If good: use Exalted Orb or benchcraft to finish',
            '5. If bad: scour and restart or accept and benchcraft',
            '6. Alternative: Alt until perfect 2-mod combo, then multimod'
          ],
          estimatedCost: sellPrice * 0.30,
          difficulty: 'Easy',
          successRate: '~30-50% with patience'
        };
      }
    }

    // Armour crafting strategies
    if (itemClass === 'Body Armour' || itemClass === 'Helmet' || itemClass === 'Gloves' || itemClass === 'Boots') {
      if (isInfluenced) {
        // Influenced armor - Fossil crafting
        return {
          method: 'Fossil Crafting + Harvest',
          steps: [
            '1. Acquire ${item.name} base',
            '2. Identify target mods (life, ES, resistances, influenced mods)',
            '3. Select fossils: Dense (life/def), Pristine (life), Frigid (cold res), etc.',
            '4. Spam fossils until hitting 2+ desired mods (15-50 attempts typical)',
            '5. Use Harvest Reforge to improve bad mods while keeping good ones',
            '6. Benchcraft final resist or quality if needed',
            '7. Optionally use Aisling for veiled mod'
          ],
          estimatedCost: sellPrice * 0.40,
          difficulty: 'Hard',
          successRate: '~5-15% per fossil attempt'
        };
      } else {
        // Regular armor - Essence or Chaos spam
        return {
          method: 'Essence Spam + Benchcraft',
          steps: [
            '1. Buy base ${itemClass} (ilvl 86 for best mods)',
            '2. Choose essence based on guaranteed mod needed',
            '   - Greed: +Life (most common)',
            '   - Wrath: +ES',
            '   - Anger/Hatred/Wrath: +Resistances',
            '3. Spam essence until hitting 2-3 good mods',
            '4. Benchcraft remaining useful mod',
            '5. Expect 10-30 essences depending on luck'
          ],
          estimatedCost: sellPrice * 0.35,
          difficulty: 'Medium',
          successRate: '~15-25% depending on targets'
        };
      }
    }

    // Weapon crafting
    if (itemClass === 'Weapon') {
      return {
        method: 'Fossil Crafting',
        steps: [
          '1. Acquire ${item.name} base',
          '2. Identify damage type (physical, elemental, chaos)',
          '3. Select fossils based on type:',
          '   - Jagged: +Phys damage',
          '   - Metallic: +Lightning',
          '   - Frigid: +Cold',
          '   - Scorched: +Fire',
          '4. Spam fossils (20-100 attempts for good weapon)',
          '5. When hitting high tier damage mods, use Harvest to augment',
          '6. Benchcraft quality or final mod'
        ],
        estimatedCost: sellPrice * 0.40,
        difficulty: 'Hard',
        successRate: '~5-10% for usable weapon'
      };
    }

    // Default strategy
    return {
      method: 'Chaos Spam',
      steps: [
        '1. Buy base item',
        '2. Use Chaos Orbs until hitting 2-3 desired mods',
        '3. Benchcraft final mod if possible',
        '4. Expect high variance - chaos spam is RNG-heavy'
      ],
      estimatedCost: sellPrice * 0.35,
      difficulty: 'Easy',
      successRate: '~10-20%'
    };
  }

  /**
   * Extract mod information and categorize them
   */
  private extractModInfo(item: PoeNinjaItem, method: string): {
    implicit: string[];
    explicit: string[];
    prefixes: string[];
    suffixes: string[];
  } {
    const itemName = item.name.toLowerCase();
    const baseType = (item.baseType || '').toLowerCase();

    // Generate example mods based on item type
    let implicit: string[] = [];
    let prefixes: string[] = [];
    let suffixes: string[] = [];

    // Jewelry mods
    if (baseType.includes('ring')) {
      implicit = ['Has 1 Socket (Abyssal Jewel)'];
      prefixes = ['+80 to maximum Life', 'Adds 12 to 24 Physical Damage to Attacks'];
      suffixes = ['+45% to Fire Resistance', '+42% to Cold Resistance', '+38% to Lightning Resistance'];
    } else if (baseType.includes('amulet')) {
      implicit = ['+30 to Strength'];
      prefixes = ['+90 to maximum Life', '+55 to maximum Mana'];
      suffixes = ['+48% to Fire Resistance', '+18% increased Global Critical Strike Chance'];
    } else if (baseType.includes('belt')) {
      implicit = ['+40 to maximum Life'];
      prefixes = ['+100 to maximum Life', '+15% increased Flask Effect Duration'];
      suffixes = ['+45% to Cold Resistance', '+40% to Lightning Resistance'];
    }
    // Armor mods
    else if (baseType.includes('regalia') || baseType.includes('armour') || baseType.includes('helmet')) {
      prefixes = ['+120 to maximum Life', '+300 to Armour', '+10% to all Elemental Resistances'];
      suffixes = ['+45% to Fire Resistance', '+48% to Lightning Resistance'];
    }
    // Weapon mods
    else if (baseType.includes('axe') || baseType.includes('sword')) {
      prefixes = ['180% increased Physical Damage', 'Adds 50 to 85 Physical Damage', '+500 to Accuracy Rating'];
      suffixes = ['+38% to Global Critical Strike Multiplier', '28% increased Attack Speed'];
    }

    return {
      implicit,
      explicit: [...prefixes, ...suffixes],
      prefixes,
      suffixes
    };
  }
}

/**
 * Standalone helper function for searching items
 * Creates a PoeNinjaAPI instance and calls searchItem
 */
export async function searchItem(itemName: string, league: string): Promise<SearchResult> {
  const api = new PoeNinjaAPI();
  return api.searchItem(itemName, league);
}
