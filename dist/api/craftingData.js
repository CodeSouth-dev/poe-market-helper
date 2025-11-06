"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CraftingDataLoader = void 0;
exports.getCraftingDataLoader = getCraftingDataLoader;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
/**
 * Module for loading and accessing RePoE crafting data
 */
class CraftingDataLoader {
    constructor(dataPath) {
        this.fossils = new Map();
        this.essences = new Map();
        this.mods = new Map();
        this.baseItems = new Map();
        this.craftingBenchOptions = [];
        this.loaded = false;
        this.dataPath = dataPath || path.join(__dirname, '../../data/RePoE/RePoE/data');
    }
    /**
     * Load all crafting data from RePoE
     */
    async loadAll() {
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
    async loadFossils() {
        try {
            const filePath = path.join(this.dataPath, 'fossils.min.json');
            const data = await fs.readJson(filePath);
            for (const [key, fossil] of Object.entries(data)) {
                this.fossils.set(fossil.name, fossil);
            }
            console.log(`Loaded ${this.fossils.size} fossils`);
        }
        catch (error) {
            console.error('Error loading fossils:', error);
            throw error;
        }
    }
    async loadEssences() {
        try {
            const filePath = path.join(this.dataPath, 'essences.min.json');
            const data = await fs.readJson(filePath);
            for (const [key, essence] of Object.entries(data)) {
                this.essences.set(essence.name, essence);
            }
            console.log(`Loaded ${this.essences.size} essences`);
        }
        catch (error) {
            console.error('Error loading essences:', error);
            throw error;
        }
    }
    async loadMods() {
        try {
            const filePath = path.join(this.dataPath, 'mods.min.json');
            const data = await fs.readJson(filePath);
            for (const [key, mod] of Object.entries(data)) {
                this.mods.set(key, mod);
            }
            console.log(`Loaded ${this.mods.size} mods`);
        }
        catch (error) {
            console.error('Error loading mods:', error);
            throw error;
        }
    }
    async loadBaseItems() {
        try {
            const filePath = path.join(this.dataPath, 'base_items.min.json');
            const data = await fs.readJson(filePath);
            for (const [key, item] of Object.entries(data)) {
                const baseItem = item;
                this.baseItems.set(baseItem.name, baseItem);
            }
            console.log(`Loaded ${this.baseItems.size} base items`);
        }
        catch (error) {
            console.error('Error loading base items:', error);
            throw error;
        }
    }
    async loadCraftingBench() {
        try {
            const filePath = path.join(this.dataPath, 'crafting_bench_options.min.json');
            const data = await fs.readJson(filePath);
            this.craftingBenchOptions = Object.values(data);
            console.log(`Loaded ${this.craftingBenchOptions.length} crafting bench options`);
        }
        catch (error) {
            console.error('Error loading crafting bench:', error);
            throw error;
        }
    }
    // Getter methods
    getFossil(name) {
        return this.fossils.get(name);
    }
    getAllFossils() {
        return Array.from(this.fossils.values());
    }
    getEssence(name) {
        return this.essences.get(name);
    }
    getAllEssences() {
        return Array.from(this.essences.values());
    }
    getMod(id) {
        return this.mods.get(id);
    }
    getModsByName(name) {
        const results = [];
        for (const mod of this.mods.values()) {
            if (mod.name.toLowerCase().includes(name.toLowerCase())) {
                results.push(mod);
            }
        }
        return results;
    }
    getModsByType(type) {
        const results = [];
        for (const mod of this.mods.values()) {
            if (mod.type === type) {
                results.push(mod);
            }
        }
        return results;
    }
    getBaseItem(name) {
        return this.baseItems.get(name);
    }
    getBaseItemsByClass(itemClass) {
        const results = [];
        for (const item of this.baseItems.values()) {
            if (item.item_class === itemClass) {
                results.push(item);
            }
        }
        return results;
    }
    getCraftingBenchOptions(itemClass) {
        if (!itemClass) {
            return this.craftingBenchOptions;
        }
        return this.craftingBenchOptions.filter(option => option.item_classes.includes(itemClass));
    }
    // Search and filter methods
    searchMods(query, itemClass) {
        const results = [];
        const lowerQuery = query.toLowerCase();
        for (const mod of this.mods.values()) {
            if (mod.name.toLowerCase().includes(lowerQuery)) {
                // Filter by item class if provided
                if (itemClass && mod.spawn_weights) {
                    const hasClassTag = mod.spawn_weights.some(sw => sw.tag.toLowerCase().includes(itemClass.toLowerCase()));
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
    getModsForItemClass(itemClass, tags) {
        const results = [];
        for (const mod of this.mods.values()) {
            if (mod.domain !== 'item')
                continue;
            if (mod.spawn_weights && mod.spawn_weights.length > 0) {
                const hasMatchingTag = mod.spawn_weights.some(sw => {
                    if (sw.weight === 0)
                        return false;
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
    getFossilsForTags(tags) {
        const results = [];
        for (const fossil of this.fossils.values()) {
            const hasRelevantWeights = fossil.positive_mod_weights.some(w => tags.includes(w.tag)) ||
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
    getEssencesForItemClass(itemClass) {
        const results = [];
        for (const essence of this.essences.values()) {
            if (essence.mods && essence.mods[itemClass]) {
                results.push(essence);
            }
        }
        return results;
    }
    isLoaded() {
        return this.loaded;
    }
}
exports.CraftingDataLoader = CraftingDataLoader;
// Singleton instance
let dataLoader = null;
function getCraftingDataLoader() {
    if (!dataLoader) {
        dataLoader = new CraftingDataLoader();
    }
    return dataLoader;
}
