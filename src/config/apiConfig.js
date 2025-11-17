import { Platform } from 'react-native';

/**
 * Centralized API Configuration
 * 
 * This file provides a single source of truth for all API base URLs.
 * Use boolean flags to easily switch between environments.
 */

// ==================== CONFIGURATION FLAGS ====================
// Set these to true/false to control which URL is used

// Force production URL even in development (useful for testing production API)
export const USE_PRODUCTION_URL = false;

// Use custom URL (set CUSTOM_API_URL below)
export const USE_CUSTOM_URL = false;

// Use physical device IP instead of emulator localhost
// Set to true if testing on physical Android device
export const USE_PHYSICAL_DEVICE = true;

// Custom IP address for physical device (only used if USE_PHYSICAL_DEVICE is true)
export const PHYSICAL_DEVICE_IP = '192.168.0.76'; // Change to your computer's IP

// ==================== URL CONFIGURATION ====================

// Production API URL - Update this when deploying
const PRODUCTION_API_URL = 'https://workflowapi-quhn.onrender.com';

// Custom API URL (only used if USE_CUSTOM_URL is true)
const CUSTOM_API_URL = `http://${PHYSICAL_DEVICE_IP}:3000`; // Change to your custom URL

// Development URLs
const DEV_ANDROID_EMULATOR_URL = 'http://10.0.2.2:3000';
const DEV_IOS_SIMULATOR_URL = 'http://localhost:3000';
const DEV_ANDROID_PHYSICAL_URL = `http://${PHYSICAL_DEVICE_IP}:3000`;

/**
 * Get the base URL for API requests
 * @returns {string} Base URL for API requests
 */
export const getApiBaseUrl = () => {
  // Priority 1: Environment variable override (highest priority)
  if (process.env.API_URL) {
    return process.env.API_URL;
  }

  // Priority 2: Custom URL flag
  if (USE_CUSTOM_URL) {
    return CUSTOM_API_URL;
  }

  // Priority 3: Force production URL flag
  if (USE_PRODUCTION_URL) {
    return PRODUCTION_API_URL;
  }

  // Priority 4: Development mode
  if (__DEV__) {
    // Android
    if (Platform.OS === 'android') {
      // Use physical device IP if flag is set
      if (USE_PHYSICAL_DEVICE) {
        return DEV_ANDROID_PHYSICAL_URL;
      }
      // Default: Android emulator
      return DEV_ANDROID_EMULATOR_URL;
    } else {
      // iOS simulator
      return DEV_IOS_SIMULATOR_URL;
    }
  }

  // Priority 5: Production (default for non-dev builds)
  return PRODUCTION_API_URL;
};

// ==================== WEBSOCKET CONFIGURATION ====================

// Use different port for WebSocket (set to true if WebSocket runs on different port)
export const USE_SEPARATE_SOCKET_PORT = false;

// WebSocket port (only used if USE_SEPARATE_SOCKET_PORT is true)
export const SOCKET_PORT = 5000;

/**
 * Get the base URL for WebSocket connections
 * By default, uses the same URL as API, but can be overridden
 * @returns {string} Base URL for WebSocket connections
 */
export const getSocketBaseUrl = () => {
  // Check for environment variable override
  if (process.env.SOCKET_URL) {
    return process.env.SOCKET_URL;
  }

  // If using separate socket port, modify the API URL
  if (USE_SEPARATE_SOCKET_PORT) {
    const apiUrl = getApiBaseUrl();
    // Replace port in URL
    if (apiUrl.includes(':3000')) {
      return apiUrl.replace(':3000', `:${SOCKET_PORT}`);
    }
    // If no port specified, add socket port
    return `${apiUrl}:${SOCKET_PORT}`;
  }

  // Default: same as API URL
  return getApiBaseUrl();
};

/**
 * Get the base URL for file/media serving
 * Mirrors the API base URL unless explicitly overridden
 * @returns {string} Base URL for file serving
 */
export const getFileBaseUrl = () => {
  if (process.env.FILE_URL) {
    return process.env.FILE_URL;
  }

  // Default to the same base URL used for API requests
  return getApiBaseUrl();
};

// Export constants for direct use
export const API_BASE_URL = getApiBaseUrl();
export const SOCKET_BASE_URL = getSocketBaseUrl();
export const FILE_BASE_URL = getFileBaseUrl();

// Log configuration in development
if (__DEV__) {
  console.log('========== API CONFIGURATION ==========');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Socket Base URL: ${SOCKET_BASE_URL}`);
  console.log(`File Base URL: ${FILE_BASE_URL}`);
  console.log(`Platform: ${Platform.OS}`);
  console.log(`__DEV__: ${__DEV__}`);
  console.log('');
  console.log('Configuration Flags:');
  console.log(`  USE_PRODUCTION_URL: ${USE_PRODUCTION_URL}`);
  console.log(`  USE_CUSTOM_URL: ${USE_CUSTOM_URL}`);
  console.log(`  USE_PHYSICAL_DEVICE: ${USE_PHYSICAL_DEVICE}`);
  console.log(`  USE_SEPARATE_SOCKET_PORT: ${USE_SEPARATE_SOCKET_PORT}`);
  if (USE_CUSTOM_URL) {
    console.log(`  CUSTOM_API_URL: ${CUSTOM_API_URL}`);
  }
  if (USE_PHYSICAL_DEVICE) {
    console.log(`  PHYSICAL_DEVICE_IP: ${PHYSICAL_DEVICE_IP}`);
  }
  if (USE_SEPARATE_SOCKET_PORT) {
    console.log(`  SOCKET_PORT: ${SOCKET_PORT}`);
  }
  console.log('========================================');
}

