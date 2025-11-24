# Web Search Integration for Crafting Guide Fallback

## Overview

The Path of Exile Market Helper now includes **intelligent web search integration** that automatically searches the internet for community crafting guides when primary data sources fail.

This feature acts as the **ultimate fallback layer** in the crafting strategy system, ensuring users always get helpful guidance even for niche or unusual crafting scenarios.

---

## How It Works

### Fallback Chain

When you request a crafting strategy, the system tries multiple data sources in order:

```
1. Craft of Exile Emulator (Primary)
   ↓ (fails)
2. Web Search for Community Guides (NEW!)
   ↓ (fails)
3. Mathematical Probability Estimates (Last Resort)
```

### What Gets Searched

The web search system queries multiple platforms:

#### **Search Targets:**
- **Reddit** (`r/pathofexile`) - Community discussions and guides
- **Official Forums** (`pathofexile.com/forum`) - Official community content
- **YouTube** - Video guide descriptions and transcripts
- **Community Sites** - MaxRoll, PoEDB, guide sites

#### **Search Queries Generated:**
```
"[Base Item]" crafting guide [Mods] site:reddit.com/r/pathofexile
how to craft [Base Item] [Mods] reddit pathofexile
"[Base Item]" crafting [Mods] site:pathofexile.com/forum
best way to craft [Base Item] [Desired Mod] Path of Exile
Path of Exile [Base Item] crafting guide [Current Year]
```

---

## Features

### 🎯 **Intelligent Parsing**

The system automatically:
- Extracts crafting methods (chaos spam, fossil, essence, etc.)
- Identifies step-by-step instructions from text
- Finds cost estimates and currency requirements
- Pulls tips and warnings from community advice
- Prioritizes high-quality sources (guides > reddit > generic)

### 📊 **Source Ranking**

Search results are prioritized by reliability:

| Source Type | Priority | Examples |
|-------------|----------|----------|
| **Guide Sites** | 🔥 Highest | MaxRoll, PoEDB, community guides |
| **Official Forum** | ⭐ High | pathofexile.com/forum |
| **Reddit** | ⭐ High | r/pathofexile discussions |
| **YouTube** | ✅ Medium | Guide video descriptions |
| **Other** | ⚠️ Low | Generic search results |

### 💾 **Smart Caching**

- Web search results cached for **3 days**
- Faster than primary sources after first search
- Avoids excessive web requests
- Cache directory: `data/web-search-cache/`

### 🔍 **Content Extraction**

The parser looks for:
- **Crafting methods**: Detects keywords like "chaos spam", "fossil", "essence"
- **Step numbers**: Extracts "1.", "2.", "step 1", "first", "then", etc.
- **Costs**: Finds patterns like "50 chaos", "100c", "cost: 200"
- **Tips**: Extracts advice marked with "tip", "recommend", "pro tip"
- **Warnings**: Finds "warning", "caution", "avoid", "don't" statements

---

## Usage

### Automatic (Default Behavior)

The web search fallback is **automatically enabled**. Just use the normal crafting API:

```typescript
const strategy = await craftOfExileSimulatorEnhanced.getCraftingStrategy(
  'Vaal Regalia',
  86,
  ['+2 to Level of Socketed Gems', 'Increased Energy Shield']
);

// If Craft of Exile fails, web search will kick in automatically
```

### Manual Usage

You can also call the web search directly:

```typescript
import { webSearchCraftingFallback } from './webSearchCraftingFallback';

const strategy = await webSearchCraftingFallback.searchForCraftingGuide(
  'Hubris Circlet',
  86,
  ['+2 to Level of Socketed Gems', 'Maximum Life']
);
```

---

## Output Format

### Strategy Structure

Web search results are formatted into the same `CraftingStrategy` structure:

```typescript
{
  baseItem: "Vaal Regalia",
  itemLevel: 86,
  desiredMods: ["+2 to Socketed Gems", "Increased ES"],

  method: "Fossil Crafting",  // Detected from community content
  methodType: "fossil",

  steps: [
    {
      stepNumber: 1,
      action: "Buy Dense and Pristine Fossils",
      actionType: "fossil",
      details: "These fossils weight ES and life mods..."
    },
    // ... more steps extracted from search results
  ],

  averageCost: 150,          // Extracted or estimated
  successRate: 0.05,         // Conservative estimate
  averageAttempts: 20,

  warnings: [
    "⚠️ This strategy is sourced from community guides",
    "⚠️ Low success rate - prepare for many attempts"
  ],

  tips: [
    "💡 Always verify costs on trade sites first",
    "💡 Source: https://reddit.com/r/pathofexile/..."
  ]
}
```

### Source Attribution

All web search strategies include:
- **Warning** that it's community-sourced
- **Source URL** in tips section
- **Reference step** pointing to original guide

---

## Examples

### Example 1: Reddit Guide Found

**Input:**
```typescript
getCraftingStrategy('Stygian Vise', 86, ['Maximum Life', 'Resistances'])
```

**Web Search Process:**
1. Craft of Exile fails (uncommon item)
2. Searches: `"Stygian Vise" crafting guide maximum life reddit`
3. Finds: Reddit post with detailed crafting steps
4. Extracts: Method (essence), steps, costs, tips
5. Returns: Complete strategy with source attribution

**Output:**
- Method: Essence Crafting
- Steps: 5 steps extracted from Reddit post
- Cost: 80 chaos (extracted from post)
- Source: reddit.com/r/pathofexile/comments/...

### Example 2: Forum Guide Found

**Input:**
```typescript
getCraftingStrategy('Synthesised Ring', 86, ['Implicit ES', 'Explicit ES'])
```

**Web Search Process:**
1. Craft of Exile fails (synthesised items)
2. Searches: `"Synthesised" ring crafting site:pathofexile.com/forum`
3. Finds: Official forum guide on synthesis crafting
4. Parses: Method and steps from forum post
5. Returns: Strategy with high-confidence rating

### Example 3: No Results Found

**Input:**
```typescript
getCraftingStrategy('Weird Item Name', 86, ['Nonexistent Mod'])
```

**Web Search Process:**
1. Craft of Exile fails
2. Web search finds no relevant results
3. Falls back to mathematical estimates
4. Returns: Generic strategy with "low confidence" warning

---

## Configuration

### Search Settings

Modify in `src/webSearchCraftingFallback.ts`:

```typescript
// Cache duration (default: 3 days)
const CACHE_DURATION = 3 * 24 * 60 * 60 * 1000;

// Rate limiting (default: 5 searches per minute)
const rateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60000,
  minDelay: 3000
});

// Max results to parse (default: 5)
for (const result of sortedResults.slice(0, 5)) { ... }
```

### Search Engine

Currently uses **DuckDuckGo** (more scraping-friendly):
- No API key required
- More lenient rate limits
- Less CAPTCHA protection

Can be changed to Google or other engines by modifying `performSearch()` method.

---

## Performance

### Speed Comparison

| Scenario | Speed | Source |
|----------|-------|--------|
| **Cache Hit** | < 1ms | Local cache |
| **Craft of Exile** | 5-10s | Browser automation |
| **Web Search (first time)** | 10-15s | DuckDuckGo + parsing |
| **Web Search (cached)** | < 1ms | Local cache |
| **Math Fallback** | < 1ms | Pure calculation |

### Caching Strategy

- **Craft of Exile cache**: 7 days (strategies change slowly)
- **Web search cache**: 3 days (community content updates faster)
- **Currency prices**: Real-time (from poe.ninja)

---

## Advantages

### Why Web Search?

✅ **Comprehensive Coverage**: Finds niche crafting strategies not in formal guides
✅ **Community Wisdom**: Taps into Reddit discussions and forum expertise
✅ **Up-to-Date**: Discovers league-specific mechanics and new techniques
✅ **Build-Specific**: Finds crafting advice for specific build archetypes
✅ **Automatic**: Works transparently as fallback, no user action needed
✅ **Cached**: Fast subsequent lookups for same items

### Limitations

⚠️ **Parsing Accuracy**: Text extraction may miss nuanced details
⚠️ **Quality Variance**: Community content quality varies
⚠️ **Cost Estimates**: May be outdated or league-specific
⚠️ **Slower**: First search takes 10-15 seconds
⚠️ **Rate Limits**: Limited to 5 searches per minute

---

## Troubleshooting

### Issue: No search results found

**Possible Causes:**
- Item name misspelled
- Very niche/new item with no guides
- Network connectivity issues

**Solution:**
- System will fall back to mathematical estimates
- Check spelling of base item name
- Try more generic mod descriptions

### Issue: Extracted strategy seems wrong

**Possible Causes:**
- Parser misunderstood community content
- Outdated guide from old league
- Low-quality source

**Solution:**
- Strategy includes source URL - verify manually
- Check warnings for "low confidence" indicators
- Try alternative methods in response

### Issue: Web search is slow

**Possible Causes:**
- First time search (not cached)
- Multiple search queries needed
- DuckDuckGo rate limiting

**Solution:**
- Results are cached for 3 days
- Subsequent searches are instant
- Consider adjusting rate limiter settings

---

## Technical Details

### Architecture

```
webSearchCraftingFallback.ts
  ├── searchForCraftingGuide()     - Main entry point
  ├── generateSearchQueries()       - Creates targeted queries
  ├── performSearch()               - Uses DuckDuckGo to search
  ├── parseSearchResults()          - Extracts crafting info
  ├── extractSteps()                - Finds step-by-step instructions
  ├── extractTipsAndWarnings()      - Pulls advice from text
  ├── buildStrategyFromParsedInfo() - Formats into CraftingStrategy
  └── Cache management              - Saves/loads from disk
```

### Integration Points

**File:** `src/craftOfExileSimulatorEnhanced.ts`

```typescript
// In generateFallbackStrategy():
try {
  const webSearchStrategy = await webSearchCraftingFallback.searchForCraftingGuide(...);
  if (webSearchStrategy) return webSearchStrategy;
} catch (error) {
  // Falls back to math estimates
}
```

### Dependencies

- **puppeteer**: Browser automation for search results
- **browserManager**: Manages browser sessions
- **RateLimiter**: Prevents excessive requests
- **fs-extra**: Cache file management

---

## Future Enhancements

### Potential Improvements

1. **Deep Page Parsing**: Visit actual pages instead of just snippets
2. **YouTube Transcript Extraction**: Parse video transcripts for detailed guides
3. **Build Guide Integration**: Link to PoB pastebins and build guides
4. **Community Voting**: Track which sources are most helpful
5. **Multiple Search Engines**: Fallback between Google, Bing, DuckDuckGo
6. **AI Summary**: Use LLM to summarize multiple conflicting guides
7. **Image Recognition**: Extract crafting steps from screenshots

### Configuration Options (Future)

```typescript
const options = {
  enableWebSearch: true,           // Toggle feature on/off
  maxSearchResults: 5,             // How many to parse
  preferredSources: ['reddit'],    // Prioritize certain sources
  minConfidence: 'medium',         // Filter low-quality results
  includeVideoGuides: true         // Parse YouTube content
};
```

---

## Summary

The Web Search Integration provides a **safety net** for crafting calculations by:

1. 🔍 **Searching** Reddit, forums, and community sites
2. 📖 **Parsing** unstructured text into structured strategies
3. 💾 **Caching** results for fast subsequent lookups
4. ⚠️ **Attributing** sources and adding appropriate warnings
5. 🎯 **Formatting** into the same structure as primary sources

**Result:** Users always get helpful crafting guidance, even for the most niche items and mod combinations!

---

## Questions?

For issues or suggestions, please open an issue on GitHub or check the console logs for debugging information.

**Console Messages:**
- `🌐 Trying web search...` - Web search initiated
- `🔎 Searching: [query]` - Active search query
- `✓ Found X relevant results` - Search successful
- `📦 Using cached web search` - Cache hit
- `⚠️ Web search failed` - Falling back to math
