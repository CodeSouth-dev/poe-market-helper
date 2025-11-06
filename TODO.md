# PoE Market Helper - TODO & Progress

## ✅ Recently Completed

### Learn to Craft Tab Improvements
- [x] Fixed bench craft detection - properly recognizes `(crafted)` mods
- [x] Added recombinator method as cost-effective option (alt-spam + recomb)
- [x] Added market purchase recommendation as cheapest option
- [x] Marked chaos spam as conditional (only shows for jewelry/influenced items)
- [x] Added currency efficiency comparison (alts vs chaos vs essences)
- [x] Enhanced tips with league timing awareness

### Vendor Recipes
- [x] Fixed to use CORRECT method: Normal (white) weapon + 40% quality gems
- [x] Removed incorrect magic weapon + ring + alteration recipe
- [x] Works for Fire/Cold/Lightning spell gems on wands/sceptres/staffs/rune daggers
- [x] Cost: ~1c (white base + gems with quality)

### Budget System
- [x] Added budget tier selection (Low/Medium/High/Very High)
- [x] Created `determineBestCraftingMethod()` function to choose cheapest method
- [x] Budget tiers: 1-20c, 20-100c, 100-500c, 500c+

### PoE1 Focus
- [x] Removed all PoE2 references from recombinator section
- [x] Changed to "Kingsmarch" only (removed Expedition references)
- [x] Updated costs to "Gold + Thaumaturgic Dust" only

### Resources
- [x] Added poedb.tw links (mod database, crafting bench)
- [x] Added Craft of Exile link
- [x] Added official trade site link

## 🔄 In Progress

### Show ONLY Cheapest Method
**Status**: Partially implemented
**What's Done**:
- `determineBestCraftingMethod()` function exists (src/index.html:2041-2086)
- Budget selector integrated
- Logic to determine cheapest method working

**What's Needed**:
- Refactor `generateCraftingSteps()` to display ONLY the selected cheapest method
- Remove all the conditional method displays (Method 2, 3, 4, 5, 6)
- Use the `bestMethod` object to render single method card
- Keep market check as Method 1, show determined best as Method 2

**File**: `src/index.html` around line 2088-2250

## 📝 Outstanding Issues

### 1. Essence Recommendations
**Issue**: System suggests generic essences, may not be suggesting the most cost-effective essence for specific mods
**What's Needed**:
- Map specific mods to correct essences
- Example: Life mods → Essence of Greed, Resists → appropriate elemental essences
- Consider essence tier vs cost (Shrieking vs Deafening)
- Only recommend essence if it's within budget

**File**: `src/index.html` - enhance `determineBestCraftingMethod()` and add essence mapping

### 2. Test Vendor Recipe Accuracy
**Status**: Needs user testing
**What to Test**:
- Paste an item with "+1 to Fire Spell Skill Gems"
- Verify recipe shows: "Normal (white) wand + Fire gems with 40% quality"
- Test with Cold/Lightning variants
- Verify it doesn't show for non-caster weapons

### 3. Market Price Integration
**Issue**: Currently shows static cost estimates, doesn't use real market data
**What's Needed**:
- Integrate with poe.ninja API to get real-time currency prices
- Calculate actual costs based on current market (alterations, essences, etc.)
- Adjust budget recommendations based on league economy
- Show dynamic cost estimates instead of static "~20c"

**File**: `src/api/poeNinja.ts` - extend to fetch currency prices

### 4. Profitable Craft Suggestions (Crafting Helper Tab)
**Issue**: May suggest expensive 10+ divine crafts without budget awareness
**What's Needed**:
- Add budget filter to Crafting Helper tab (similar to Learn to Craft)
- Filter out craft suggestions that exceed user's budget
- Show profit margin relative to investment
- Warn when craft requires >2 divine investment

**File**: `src/index.html` - Crafting Helper section around line 700-800

## 🐛 Known Issues

### GPU Process Error (Low Priority - Cosmetic)
**Error**: `GPU process exited unexpectedly: exit_code=-1073740791`
**Impact**: App still works, just console warnings
**Cause**: Electron GPU acceleration issues on Windows
**Fix Options**:
1. Add `--disable-gpu` flag to Electron launch
2. Add `--disable-software-rasterizer` flag
3. Add to main.ts: `app.disableHardwareAcceleration()`

**File**: `src/main.ts` - add flag before app creation

## 🎯 Future Enhancements

### High Priority
- [ ] Complete "show only cheapest method" refactor
- [ ] Add essence-to-mod mapping for accurate recommendations
- [ ] Test vendor recipe accuracy with real items

### Medium Priority
- [ ] Integrate real-time currency prices from poe.ninja
- [ ] Add budget filtering to Crafting Helper tab
- [ ] Add "Compare with Market" button that searches trade site

### Low Priority
- [ ] Add more vendor recipes (jeweler's touch, chromatic, etc.)
- [ ] Add influence crafting methods (awakener orb, maven orb)
- [ ] Add fossil crafting calculator
- [ ] Export crafting guide to text file

## 📚 Key Files Reference

| File | Purpose | Recent Changes |
|------|---------|----------------|
| `src/index.html` | Main UI & Learn to Craft logic | Added budget selector, fixed vendor recipes, added determineBestCraftingMethod() |
| `src/api/poeNinja.ts` | Market data fetching | Made searchCategory public, added searchItem export |
| `src/types/crafting.ts` | Type definitions | Created comprehensive type system |
| `src/main.ts` | Electron main process | May need GPU flags added |

## 💡 Design Decisions

### Why Budget Tiers?
User requested crafting suggestions should be budget-aware. Expensive 10+ divine crafts aren't helpful for players with 50c budget.

### Why Only Cheapest Method?
User requested seeing ONLY the most cost-effective method, not a list of 5-6 options. Reduces decision paralysis and focuses on actionable advice.

### Why Remove PoE2?
User is playing PoE1, PoE2 references create confusion. Focus should be on current game mechanics.

### Why Fix Vendor Recipes?
Incorrect recipes don't work in-game, causing user frustration. Must use documented, tested recipes from official sources.

## 🔗 Useful Resources

- [PoE Wiki Vendor Recipes](https://www.poewiki.net/wiki/Vendor_recipe_system)
- [poedb.tw Mod Database](https://poedb.tw/us/mod.php)
- [Craft of Exile](https://www.craftofexile.com)
- [Essence List](https://poedb.tw/us/Essence)

## 📝 Notes for Next Session

When continuing work:
1. **Main focus**: Complete "show only cheapest method" refactor
2. **Test**: Vendor recipes with real items from PoE
3. **Quick win**: Fix GPU error by adding hardware acceleration disable
4. **Nice to have**: Essence mapping for better recommendations

Last updated: 2025-11-07
Branch: `claude/getting-error-011CUr2HoEJYBid7rHcfXJiY`
