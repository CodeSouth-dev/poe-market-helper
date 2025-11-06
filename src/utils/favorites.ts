import * as fs from 'fs-extra';
import * as path from 'path';

export interface FavoriteItem {
  name: string;
  baseType?: string;
  league: string;
  addedAt: Date;
  lastChecked?: Date;
  lastPrice?: number;
}

export class FavoritesManager {
  private readonly favoritesFile: string;
  private favorites: FavoriteItem[] = [];

  constructor() {
    this.favoritesFile = path.join(process.cwd(), 'data', 'favorites.json');
    this.loadFavorites();
  }

  /**
   * Load favorites from file
   */
  private async loadFavorites(): Promise<void> {
    try {
      // Ensure data directory exists
      await fs.ensureDir(path.dirname(this.favoritesFile));

      if (await fs.pathExists(this.favoritesFile)) {
        this.favorites = await fs.readJson(this.favoritesFile);
        console.log(`Loaded ${this.favorites.length} favorites`);
      } else {
        this.favorites = [];
        await this.saveFavorites();
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
      this.favorites = [];
    }
  }

  /**
   * Save favorites to file
   */
  private async saveFavorites(): Promise<void> {
    try {
      await fs.writeJson(this.favoritesFile, this.favorites, { spaces: 2 });
      console.log('Favorites saved');
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  }

  /**
   * Get all favorites
   */
  async getAll(): Promise<FavoriteItem[]> {
    return [...this.favorites];
  }

  /**
   * Add item to favorites
   */
  async add(item: Omit<FavoriteItem, 'addedAt'>): Promise<void> {
    // Check if already exists
    const exists = this.favorites.some(fav => 
      fav.name.toLowerCase() === item.name.toLowerCase() && 
      fav.league === item.league
    );

    if (exists) {
      throw new Error('Item already in favorites');
    }

    const favoriteItem: FavoriteItem = {
      ...item,
      addedAt: new Date()
    };

    this.favorites.push(favoriteItem);
    await this.saveFavorites();
    console.log(`Added ${item.name} to favorites`);
  }

  /**
   * Remove item from favorites
   */
  async remove(itemName: string, league?: string): Promise<void> {
    const initialLength = this.favorites.length;
    
    this.favorites = this.favorites.filter(fav => {
      if (league) {
        return !(fav.name.toLowerCase() === itemName.toLowerCase() && fav.league === league);
      } else {
        return fav.name.toLowerCase() !== itemName.toLowerCase();
      }
    });

    if (this.favorites.length < initialLength) {
      await this.saveFavorites();
      console.log(`Removed ${itemName} from favorites`);
    } else {
      throw new Error('Item not found in favorites');
    }
  }

  /**
   * Update last checked time and price for an item
   */
  async updateLastChecked(itemName: string, league: string, price?: number): Promise<void> {
    const item = this.favorites.find(fav => 
      fav.name.toLowerCase() === itemName.toLowerCase() && 
      fav.league === league
    );

    if (item) {
      item.lastChecked = new Date();
      if (price !== undefined) {
        item.lastPrice = price;
      }
      await this.saveFavorites();
    }
  }

  /**
   * Check if item is in favorites
   */
  isFavorite(itemName: string, league: string): boolean {
    return this.favorites.some(fav => 
      fav.name.toLowerCase() === itemName.toLowerCase() && 
      fav.league === league
    );
  }

  /**
   * Get favorites by league
   */
  getByLeague(league: string): FavoriteItem[] {
    return this.favorites.filter(fav => fav.league === league);
  }

  /**
   * Clear all favorites
   */
  async clear(): Promise<void> {
    this.favorites = [];
    await this.saveFavorites();
    console.log('All favorites cleared');
  }

  /**
   * Export favorites to JSON string
   */
  export(): string {
    return JSON.stringify(this.favorites, null, 2);
  }

  /**
   * Import favorites from JSON string
   */
  async import(jsonString: string): Promise<void> {
    try {
      const imported: FavoriteItem[] = JSON.parse(jsonString);
      
      // Validate structure
      if (!Array.isArray(imported)) {
        throw new Error('Invalid format: expected array');
      }

      for (const item of imported) {
        if (!item.name || !item.league) {
          throw new Error('Invalid format: missing required fields');
        }
      }

      this.favorites = imported;
      await this.saveFavorites();
      console.log(`Imported ${imported.length} favorites`);
    } catch (error: any) {
      throw new Error(`Failed to import favorites: ${error.message || 'Unknown error'}`);
    }
  }
}