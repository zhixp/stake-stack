# Game Configuration Guide

## Where to Change Settings

All game configuration is in: **`src/config/gameConfig.js`**

## Key Settings

### Reset Score (Default: 180)

**Location:** `src/config/gameConfig.js` → `RESET_SCORE: 180`

After 48 hours, the high score resets to this value. Players must beat this score to claim the pot.

**To Change:**
1. Open `src/config/gameConfig.js`
2. Find: `RESET_SCORE: 180,`
3. Change to your desired score (e.g., `RESET_SCORE: 200,`)
4. Save the file

### Pot Distribution

**Location:** `src/config/gameConfig.js` → `WINNER_PERCENTAGE` and `POT_PERCENTAGE`

- Winner gets: `WINNER_PERCENTAGE%` (default: 80%)
- Pot keeps: `POT_PERCENTAGE%` (default: 20%)

### Timer

**Location:** `src/config/gameConfig.js` → `RESET_TIMER_HOURS: 48`

Change how long before score resets (in hours).

### Anti-Cheat Settings

**Location:** `src/config/gameConfig.js` → `ANTI_CHEAT` object

- `MIN_TIME_PER_BLOCK`: Minimum milliseconds per block (default: 200ms)
- `MAX_BLOCKS_PER_SECOND`: Maximum blocks per second (default: 3)
- `SUSPICIOUS_CLICK_THRESHOLD`: Clicks before shadow ban (default: 3)
- `MIN_INTERVAL_VARIANCE`: Minimum timing variance (default: 2500)
- `MIN_POSITION_VARIANCE`: Minimum mouse movement variance (default: 25)

## Game Logic Flow

1. **Player plays game** → Gets score
2. **If score > current high score:**
   - Winner gets 80% of pot
   - 20% stays in pot
   - New high score is set
3. **After 48 hours:**
   - High score resets to `RESET_SCORE` (default: 180)
   - Players must beat this score to win
4. **Flywheel continues:**
   - Each new winner must beat the previous high score
   - Pot keeps growing with 20% from each win

## Anti-Cheat Features

1. **Human Jitter Detection:**
   - Tracks click timing variance
   - Tracks mouse position variance
   - Detects perfect timing/positioning (bot behavior)

2. **Speed Detection:**
   - Minimum time per block
   - Maximum blocks per second

3. **Shadow Banning:**
   - Bots are silently rejected
   - No error message (wastes bot time)

4. **Camera Jitter:**
   - Random camera movement
   - Breaks screen-reading bots
   - Too subtle for humans to notice

## Testing

After changing config:
1. Save `src/config/gameConfig.js`
2. Restart dev server
3. Changes take effect immediately

