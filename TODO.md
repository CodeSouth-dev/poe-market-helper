# PoE Market Helper - TODO & Progress

**Last Updated:** 2025-11-07
**Current Branch:** `claude/getting-error-011CUr2HoEJYBid7rHcfXJiY`
**App Status:** ✅ Working - loads and runs properly

---

## ✅ Recently Completed

### Critical Bug Fixes
- [x] **Fixed app loading issue** - Removed duplicate `itemClass` declaration (line 2233) that caused SyntaxError
- [x] **App now loads and tabs switch properly** - JavaScript executes without errors
- [x] Temporarily removed GPU fix (was causing issues, can re-add later if needed)

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

---

## 🔄 High Priority - In Progress

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

### GPU Process Error (Optional - Won't Fix for Now)
**Status**: Temporarily ignored
**Error**: `GPU process exited unexpectedly: exit_code=-1073740791`
**What Happened**:
- Tried adding `app.disableHardwareAcceleration()` but it caused loading issues
- Removed the fix to prioritize app functionality
- Error is cosmetic only - app works fine despite the warnings

**If You Want to Fix It Later**:
1. Add `app.disableHardwareAcceleration()` BEFORE any other app code
2. Test thoroughly to ensure it doesn't break loading
3. Alternative: Add `--disable-gpu` as command line flag when launching Electron

**File**: `src/main.ts` - currently has no GPU fix applied

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

## 📝 Quick Start Guide for Next Session

### What to Say to Start
**Option 1 (Continue Work):**
"Continue working on the Learn to Craft tab based on TODO.md - specifically complete the 'show only cheapest method' refactor"

**Option 2 (Test Features):**
"I want to test the vendor recipes and crafting suggestions. Here's an item: [paste item from PoE]"

**Option 3 (Fix Issues):**
"Fix [specific issue from Outstanding Issues section]"

### Current State Summary
✅ **What Works:**
- App loads and runs without errors
- All tabs are functional
- Budget tier selection works
- Vendor recipe detection implemented
- Learn to Craft tab shows crafting methods

❌ **What Needs Work:**
1. **Show only cheapest method** - Currently shows ALL methods, should show only 1-2 best options
2. **Essence recommendations** - Generic, needs mod-to-essence mapping
3. **Budget filtering** - Budget selector exists but doesn't filter method display yet
4. **Test vendor recipes** - Need to verify they work with real PoE items

### File Locations
- Main UI/Learn to Craft: `src/index.html` (lines 808-2400)
- Vendor recipe detection: `src/index.html` (lines 1967-2039)
- Method selection logic: `src/index.html` (lines 2041-2086)
- Main process: `src/main.ts`

### Important Functions
- `detectVendorRecipes()` - Finds applicable vendor recipes
- `determineBestCraftingMethod()` - Chooses cheapest method (NOT YET USED IN DISPLAY)
- `generateCraftingSteps()` - Renders the crafting guide (SHOWS ALL METHODS, NEEDS REFACTOR)
- `generateCraftingTips()` - Shows pro tips

---

**Last updated:** 2025-11-07
**Branch:** `claude/getting-error-011CUr2HoEJYBid7rHcfXJiY`
**Git Status:** All changes committed and pushed
