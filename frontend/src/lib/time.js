/**
 * Time utilities for the dashboard
 */

/**
 * Format a timestamp or Date to HH:MM:SS
 * @param {number|Date} input - Unix timestamp (seconds) or Date object
 * @returns {string} Formatted time string
 */
export function formatTime(input) {
  const date = typeof input === 'number' ? new Date(input * 1000) : input;
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Get current time as formatted string
 * @returns {string} Current time as HH:MM:SS
 */
export function getCurrentTime() {
  return formatTime(new Date());
}

/**
 * Get current Unix timestamp in seconds
 * @returns {number} Unix timestamp
 */
export function getTimestamp() {
  return Math.floor(Date.now() / 1000);
}
