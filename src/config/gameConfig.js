/**
 * GAME CONFIGURATION
 * 
 * This file contains all game configuration settings.
 * Modify values here to change game behavior.
 */

export const GAME_CONFIG = {
  // === SCORE RESET CONFIGURATION ===
  // After 48 hours, the high score resets to this value
  // Players must beat this score to claim the pot
  RESET_SCORE: 180, // <-- CHANGE THIS VALUE TO SET RESET SCORE
  
  // === POT DISTRIBUTION ===
  // When a player wins:
  // - WINNER_PERCENTAGE% goes to the winner
  // - POT_PERCENTAGE% stays in the pot for the next round
  WINNER_PERCENTAGE: 80, // Winner gets 80%
  POT_PERCENTAGE: 20,    // 20% stays in pot
  
  // === TIMER CONFIGURATION ===
  RESET_TIMER_HOURS: 48, // Score resets after 48 hours
  
  // === ANTI-CHEAT SETTINGS ===
  ANTI_CHEAT: {
    // Minimum time per block (milliseconds)
    // Humans need at least this much time per block
    MIN_TIME_PER_BLOCK: 200,
    
    // Maximum blocks per second
    MAX_BLOCKS_PER_SECOND: 3,
    
    // Suspicious click threshold
    // If this many suspicious clicks detected, shadow ban
    SUSPICIOUS_CLICK_THRESHOLD: 3,
    
    // Human jitter requirements
    MIN_INTERVAL_VARIANCE: 2500,  // Milliseconds squared
    MIN_POSITION_VARIANCE: 25,    // Pixels squared
  },
};

/**
 * HOW TO CHANGE THE RESET SCORE:
 * 
 * 1. Open this file: src/config/gameConfig.js
 * 2. Find the line: RESET_SCORE: 180,
 * 3. Change 180 to your desired score (e.g., 200, 150, etc.)
 * 4. Save the file
 * 5. The new score will be used when the 48-hour timer resets
 * 
 * EXAMPLE:
 *   RESET_SCORE: 200,  // Players must score >200 to win
 */

export default GAME_CONFIG;

