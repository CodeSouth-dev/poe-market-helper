import * as fs from 'fs-extra';
import * as path from 'path';
import { Fossil, Essence, Mod, BaseItem, CraftingBenchOption } from '../types/crafting';

/**
 * Module for loading and accessing RePoE crafting data
 */
export class CraftingDataLoader {
  private dataPath: string;
  private fossils: Map<string, Fossil> = new Map();
  private essences: Map<string, Essence> = new Map();
  private mods: Map<string, Mod> = new Map();
  private baseItems: Map<string, BaseItem> = new Map();
  private craftingBenchOptions: CraftingBenchOption[] = [];
  private loaded: boolean = false;

  constructor(dataPath?: string) {
    this.dataPath = dataPath || path.join(__dirname, '../../data/RePoE/RePoE/data');
  }

  /**
   * Load all crafting data from RePoE
   */
  async loadAll(): Promise<void> {
    if (this.loaded) {
      return;
    }

    console.log('Loading crafting data from RePoE...');

    await Promise.all([
      this.loadFossils(),
      this.loadEssences(),
      this.loadMods(),
      this.loadBaseItems(),
      this.loadCraftingBench()
    ]);

    this.loaded = true;
    console.log('Crafting data loaded successfully');
  }

  private async loadFossils(): Promise<void> {
    try {
      const filePath = path.join(this.dataPath, 'fossils.min.json');
      const data = await fs.readJson(filePath);

      for (const [key, fossil] of Object.entries(data)) {
        this.fossils.set((fossil as any).name, fossil as Fossil);
      }

      console.log(`Loaded ${this.fossils.size} fossils`);
    } catch (error) {
      console.error('Error loading fossils:', error);
      throw error;
    }
  }

  private async loadEssences(): Promise<void> {
    try {
      const filePath = path.join(this.dataPath, 'essences.min.json');
      const data = await fs.readJson(filePath);

      for (const [key, essence] of Object.entries(data)) {
        this.essences.set((essence as any).name, essence as Essence);
      }

      console.log(`Loaded ${this.essences.size} essences`);
    } catch (error) {
      console.error('Error loading essences:', error);
      throw error;
    }
  }

  private async loadMods(): Promise<void> {
    try {
      const filePath = path.join(this.dataPath, 'mods.min.json');
      const data = await fs.readJson(filePath);

      for (const [key, mod] of Object.entries(data)) {
        this.mods.set(key, mod as Mod);
      }

      console.log(`Loaded ${this.mods.size} mods`);
    } catch (error) {
      console.error('Error loading mods:', error);
      throw error;
    }
  }

  private async loadBaseItems(): Promise<void> {
    try {
      const filePath = path.join(this.dataPath, 'base_items.min.json');
      const data = await fs.readJson(filePath);

      for (const [key, item] of Object.entries(data)) {
        const baseItem = item as BaseItem;
        this.baseItems.set(baseItem.name, baseItem);
      }

      console.log(`Loaded ${this.baseItems.size} base items`);
    } catch (error) {
      console.error('Error loading base items:', error);
      throw error;
    }
  }

  private async loadCraftingBench(): Promise<void> {
    try {
      const filePath = path.join(this.dataPath, 'crafting_bench_options.min.json');
      const data = await fs.readJson(filePath);

      this.craftingBenchOptions = Object.values(data);

      console.log(`Loaded ${this.craftingBenchOptions.length} crafting bench options`);
    } catch (error) {
      console.error('Error loading crafting bench:', error);
      throw error;
    }
  }

  // Getter methods

  getFossil(name: string): Fossil | undefined {
    return this.fossils.get(name);
  }

  getAllFossils(): Fossil[] {
    return Array.from(this.fossils.values());
  }

  getEssence(name: string): Essence | undefined {
    return this.essences.get(name);
  }

  getAllEssences(): Essence[] {
    return Array.from(this.essences.values());
  }

  getMod(id: string): Mod | undefined {
    return this.mods.get(id);
  }

  getModsByName(name: string): Mod[] {
    const results: Mod[] = [];
    for (const mod of this.mods.values()) {
      if (mod.name.toLowerCase().includes(name.toLowerCase())) {
        results.push(mod);
      }
    }
    return results;
  }

  getModsByType(type: 'prefix' | 'suffix'): Mod[] {
    const results: Mod[] = [];
    for (const mod of this.mods.values()) {
      if (mod.type === type) {
        results.push(mod);
      }
    }
    return results;
  }

  getBaseItem(name: string): BaseItem | undefined {
    return this.baseItems.get(name);
  }

  getBaseItemsByClass(itemClass: string): BaseItem[] {
    const results: BaseItem[] = [];
    for (const item of this.baseItems.values()) {
      if (item.item_class === itemClass) {
        results.push(item);
      }
    }
    return results;
  }

  getCraftingBenchOptions(itemClass?: string): CraftingBenchOption[] {
    if (!itemClass) {
      return this.craftingBenchOptions;
    }

    return this.craftingBenchOptions.filter(option =>
      option.item_classes.includes(itemClass)
    );
  }

  // Search and filter methods

  searchMods(query: string, itemClass?: string): Mod[] {
    const results: Mod[] = [];
    const lowerQuery = query.toLowerCase();

    for (const mod of this.mods.values()) {
      if (mod.name.toLowerCase().includes(lowerQuery)) {
        // Filter by item class if provided
        if (itemClass && mod.spawn_weights) {
          const hasClassTag = mod.spawn_weights.some(sw =>
            sw.tag.toLowerCase().includes(itemClass.toLowerCase())
          );
          if (!hasClassTag) {
            continue;
          }
        }
        results.push(mod);
      }
    }

    return results.slice(0, 50); // Limit results
  }

  /**
   * Get all mods that can spawn on a specific item class
   */
  getModsForItemClass(itemClass: string, tags: string[]): Mod[] {
    const results: Mod[] = [];

    for (const mod of this.mods.values()) {
      if (mod.domain !== 'item') continue;

      if (mod.spawn_weights && mod.spawn_weights.length > 0) {
        const hasMatchingTag = mod.spawn_weights.some(sw => {
          if (sw.weight === 0) return false;
          return tags.some(tag => tag.toLowerCase() === sw.tag.toLowerCase());
        });

        if (hasMatchingTag) {
          results.push(mod);
        }
      }
    }

    return results;
  }

  /**
   * Get fossils that affect specific tags
   */
  getFossilsForTags(tags: string[]): Fossil[] {
    const results: Fossil[] = [];

    for (const fossil of this.fossils.values()) {
      const hasRelevantWeights =
        fossil.positive_mod_weights.some(w => tags.includes(w.tag)) ||
        fossil.negative_mod_weights.some(w => tags.includes(w.tag));

      if (hasRelevantWeights || fossil.forced_mods.length > 0) {
        results.push(fossil);
      }
    }

    return results;
  }

  /**
   * Get essences that can be used on specific item class
   */
  getEssencesForItemClass(itemClass: string): Essence[] {
    const results: Essence[] = [];

    for (const essence of this.essences.values()) {
      if (essence.mods && essence.mods[itemClass]) {
        results.push(essence);
      }
    }

    return results;
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}

// Singleton instance
let dataLoader: CraftingDataLoader | null = null;

export function getCraftingDataLoader(): CraftingDataLoader {
  if (!dataLoader) {
    dataLoader = new CraftingDataLoader();
  }
  return dataLoader;
}
