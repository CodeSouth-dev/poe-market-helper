import { Fossil, Essence, Mod, BaseItem, CraftingBenchOption } from '../types/crafting';
/**
 * Module for loading and accessing RePoE crafting data
 */
export declare class CraftingDataLoader {
    private dataPath;
    private fossils;
    private essences;
    private mods;
    private baseItems;
    private craftingBenchOptions;
    private loaded;
    constructor(dataPath?: string);
    /**
     * Load all crafting data from RePoE
     */
    loadAll(): Promise<void>;
    private loadFossils;
    private loadEssences;
    private loadMods;
    private loadBaseItems;
    private loadCraftingBench;
    getFossil(name: string): Fossil | undefined;
    getAllFossils(): Fossil[];
    getEssence(name: string): Essence | undefined;
    getAllEssences(): Essence[];
    getMod(id: string): Mod | undefined;
    getModsByName(name: string): Mod[];
    getModsByType(type: 'prefix' | 'suffix'): Mod[];
    getBaseItem(name: string): BaseItem | undefined;
    getBaseItemsByClass(itemClass: string): BaseItem[];
    getCraftingBenchOptions(itemClass?: string): CraftingBenchOption[];
    searchMods(query: string, itemClass?: string): Mod[];
    /**
     * Get all mods that can spawn on a specific item class
     */
    getModsForItemClass(itemClass: string, tags: string[]): Mod[];
    /**
     * Get fossils that affect specific tags
     */
    getFossilsForTags(tags: string[]): Fossil[];
    /**
     * Get essences that can be used on specific item class
     */
    getEssencesForItemClass(itemClass: string): Essence[];
    isLoaded(): boolean;
}
export declare function getCraftingDataLoader(): CraftingDataLoader;
