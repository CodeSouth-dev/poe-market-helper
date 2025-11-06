export interface ParsedItem {
  name: string;
  baseType: string;
  rarity?: string;
  itemLevel?: number;
}

export class ItemParser {
  /**
   * Parse Path of Exile item text from clipboard
   * Format example:
   * Rarity: Rare
   * Item Name
   * Base Type
   * --------
   * ...
   */
  static parseItemText(text: string): ParsedItem | null {
    if (!text || text.trim().length === 0) {
      return null;
    }

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    if (lines.length < 2) {
      return null;
    }

    let rarity: string | undefined;
    let name: string = '';
    let baseType: string = '';
    let itemLevel: number | undefined;
    let lineIndex = 0;

    // Check for rarity line (usually first line)
    if (lines[0].startsWith('Rarity:')) {
      rarity = lines[0].replace('Rarity:', '').trim();
      lineIndex = 1;
    }

    // For unique items and some rares, the name is on the next line
    if (lineIndex < lines.length && !lines[lineIndex].startsWith('---')) {
      name = lines[lineIndex];
      lineIndex++;
    }

    // Base type is typically the next line after the name
    if (lineIndex < lines.length && !lines[lineIndex].startsWith('---')) {
      baseType = lines[lineIndex];
      lineIndex++;
    }

    // If we only got one line (for normal/magic items), use it as both name and base
    if (!baseType && name) {
      baseType = name;
    }

    // Try to extract item level
    const itemLevelLine = lines.find(line => line.startsWith('Item Level:'));
    if (itemLevelLine) {
      const match = itemLevelLine.match(/Item Level:\s*(\d+)/);
      if (match) {
        itemLevel = parseInt(match[1], 10);
      }
    }

    // For currency and other simple items, they might just be a single name
    if (!name && !baseType && lines.length > 0) {
      // Use the first non-rarity line
      for (const line of lines) {
        if (!line.startsWith('Rarity:') && !line.startsWith('---')) {
          name = line;
          baseType = line;
          break;
        }
      }
    }

    if (!name && !baseType) {
      return null;
    }

    return {
      name: name || baseType,
      baseType: baseType || name,
      rarity,
      itemLevel
    };
  }

  /**
   * Get search term from parsed item
   * For unique items, prefer the name
   * For rare items, use the base type
   * For normal/magic items, use the base type
   */
  static getSearchTerm(parsedItem: ParsedItem): string {
    const rarity = parsedItem.rarity?.toLowerCase();

    if (rarity === 'unique') {
      return parsedItem.name;
    } else if (rarity === 'rare' || rarity === 'magic') {
      return parsedItem.baseType;
    } else {
      // For currency, gems, etc., use the name
      return parsedItem.name || parsedItem.baseType;
    }
  }

  /**
   * Validate if text looks like a PoE item
   */
  static isValidItemText(text: string): boolean {
    if (!text || text.trim().length === 0) {
      return false;
    }

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Check if it starts with Rarity: or has at least 2 lines
    const hasRarity = lines.some(line => line.startsWith('Rarity:'));
    const hasSeparator = lines.some(line => line.startsWith('---'));
    const hasEnoughLines = lines.length >= 2;

    return hasRarity || hasSeparator || hasEnoughLines;
  }
}
