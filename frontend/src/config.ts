/**
 * Application configuration
 * Central place for environment-specific settings
 */

export const config = {
    /**
     * Base URL for backend API
     * Can be overridden by VITE_API_BASE_URL environment variable
     */
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',

    /**
     * Whether to enable debug logging
     */
    debug: import.meta.env.DEV,
};
