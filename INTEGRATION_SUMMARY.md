# poe.ninja Integration Summary

## Overview
This document summarizes the comprehensive integration of poe.ninja data into the PoE Market Helper application.

## Features Implemented

### 1. Dynamic League Fetching
- **API Endpoint**: `https://api.pathofexile.com/leagues`
- **Implementation**: `PoeNinjaAPI.getLeagues()`
- **Fallback**: Uses current league names if API fails
- **UI Integration**: Leagues dropdown populated dynamically on app load

### 2. Enhanced Data Models
Updated `PoeNinjaItem` interface to include:
- **Sparkline Data**: Price trend tracking via `sparkline` and `lowConfidenceSparkline`
- **Currency-Specific Data**: `pay`/`receive` objects with `paySparkLine`/`receiveSparkLine`
- **Item Icons**: `icon` field for visual representation
- **Modifiers**: `implicitModifiers` and `explicitModifiers` arrays
- **Calculated Metrics**: `volumePerHour`, `confidenceLevel`, `isPopular`

### 3. Economy Metrics

#### Confidence Levels
Three-tier confidence system based on listing count and data quality:
- **High**: 50+ listings, no low-confidence indicators
- **Medium**: 10-49 listings, standard data quality
- **Low**: <10 listings or low-confidence sparkline data present

#### Volume/Hour Calculation
Estimates trading activity using:
- Sparkline data (price volatility indicates activity)
- Total count/listing data
- 24-hour rolling average assumption

#### Most Popular Items
Identifies items with:
- Highest listing counts (100+ listings)
- OR high-value items (100+ chaos) with decent listings (20+)

### 4. Adaptive Value Display
Automatically chooses the best currency display:
- **Divine Orbs**: Items worth 10+ divine
- **Dual Display**: Items 100+ chaos showing both divine and chaos
- **Exalted Orbs**: Legacy support for 10+ exalted value
- **Chaos Orbs**: Default for everything else

Format examples:
- `15.50d` - Divine orbs
- `2.50d (350c)` - Both currencies
- `125.00c` - Chaos orbs

### 5. UI Enhancements

#### New Stat Cards
- **Volume/Hour**: Estimated hourly trading volume
- **Avg Confidence**: Average data reliability across results
- **Most Popular**: Item with highest listing count

#### Updated Results Table
Added columns:
- **Value (Adaptive)**: Smart currency display
- **Volume/Hr**: Per-item trading volume
- **Confidence**: Color-coded badges (green/yellow/red)

#### Visual Indicators
- **Confidence Badges**: Color-coded (high=green, medium=yellow, low=red)
- **Popular Badge**: Gold badge for high-activity items
- **Adaptive Currency**: Dynamic currency symbols (c/d/ex)

## API Endpoints Used

### poe.ninja API
- **Currency Overview**: `https://poe.ninja/api/data/currencyoverview`
- **Item Overview**: `https://poe.ninja/api/data/itemoverview`

### Official PoE API
- **Leagues**: `https://api.pathofexile.com/leagues`

## Technical Implementation

### Files Modified
1. **src/api/poeNinja.ts**
   - Enhanced interfaces with economy data
   - Added `getLeagues()` method with fallback
   - Implemented `enrichItemData()` for calculated metrics
   - Added confidence, volume, and popularity calculations
   - Implemented adaptive value display methods

2. **src/main.ts**
   - Added `get-leagues` IPC handler
   - Enhanced error handling

3. **src/index.html**
   - Added CSS for confidence badges and popular indicators
   - Expanded stats grid with new economy metrics
   - Updated table with new columns
   - Implemented `loadLeagues()` function
   - Enhanced `displayResults()` with economy data
   - Added `formatAdaptiveValue()` and `formatConfidenceBadge()` helpers

### New Type Definitions
```typescript
interface Sparkline {
  data: number[];
  totalChange: number;
}

interface League {
  id: string;
  realm?: string;
  description?: string;
  category?: { id: string; current?: boolean };
  // ... additional fields
}
```

## Data Flow

1. **App Initialization**
   - Fetch current leagues from PoE API
   - Populate dropdown with active leagues
   - Load user favorites

2. **Item Search**
   - Search across 19 item categories
   - Retrieve full poe.ninja data (including sparklines)
   - Enrich each item with calculated metrics
   - Calculate aggregate statistics
   - Display results with adaptive formatting

3. **Data Enrichment Pipeline**
   ```
   Raw API Data → Calculate Confidence → Calculate Volume →
   Check Popularity → Determine Adaptive Display → UI Rendering
   ```

## Configuration

### Confidence Thresholds
- High: ≥50 listings
- Medium: 10-49 listings
- Low: <10 listings

### Popularity Thresholds
- Volume-based: ≥100 listings
- Value-based: ≥100 chaos AND ≥20 listings

### Adaptive Display Thresholds
- Divine display: ≥10 divine value
- Dual display: ≥100 chaos AND >0 divine
- Exalted display: ≥10 exalted value
- Default: Chaos orbs

## Testing Recommendations

1. **League Fetching**
   - Test with API available
   - Test with API unavailable (fallback)
   - Verify current league detection

2. **Economy Metrics**
   - Search high-volume items (Divine Orb, Chaos Orb)
   - Search low-volume items (rare uniques)
   - Verify confidence calculations

3. **Adaptive Display**
   - Test items in different value ranges
   - Verify currency symbol display
   - Check dual-currency formatting

4. **UI Responsiveness**
   - Test with many results
   - Test with no results
   - Verify badge rendering

## Future Enhancements

Potential improvements:
- Historical price charts using sparkline data
- Price alerts based on confidence levels
- Trading velocity indicators
- Market trend analysis
- Export economy reports
- Custom confidence thresholds

## Notes

- All sparkline data is preserved for future charting features
- Confidence calculations are conservative (favor low over high)
- Volume estimates are approximations based on available data
- Adaptive display prioritizes user-friendly currency representation
