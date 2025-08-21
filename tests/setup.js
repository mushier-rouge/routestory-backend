// Test setup and configuration
require('dotenv').config({ path: '../.env' });

// Global test configuration
global.testConfig = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  googleGeminiApiKey: process.env.GOOGLE_GEMINI_API_KEY,
  testTimeout: 30000, // 30 seconds for integration tests
  apiBaseUrl: process.env.SUPABASE_URL + '/functions/v1'
};

// Global test data
global.testData = {
  validLocations: {
    paloAlto: {
      address: "Palo Alto, CA",
      coordinates: [37.4419, -122.1430]
    },
    sunnyvale: {
      address: "Sunnyvale, CA", 
      coordinates: [37.3688, -122.0363]
    },
    sanFrancisco: {
      address: "San Francisco, CA",
      coordinates: [37.7749, -122.4194]
    },
    sanjose: {
      address: "San Jose, CA",
      coordinates: [37.3382, -121.8863]
    }
  },
  invalidLocations: {
    invalidCoords: {
      coordinates: [200, 200] // Invalid latitude/longitude
    },
    emptyLocation: {},
    nullLocation: null
  },
  validRouteRequest: {
    start_location: {
      address: "Palo Alto, CA",
      coordinates: [37.4419, -122.1430]
    },
    end_location: {
      address: "Sunnyvale, CA", 
      coordinates: [37.3688, -122.0363]
    },
    preferences: {
      max_time_increase_percent: 20,
      interests: ["history", "technology"],
      driving_speed: "normal",
      avoid_highways: false,
      vehicle_type: "car"
    },
    context: {
      time_of_day: "afternoon",
      trip_purpose: "leisure",
      group_size: 2
    }
  }
};

// Test utilities
global.testUtils = {
  // Generate random UUID for test data
  generateUUID: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  // Wait for async operation
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Validate UUID format
  isValidUUID: (uuid) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },

  // Validate coordinate format
  isValidCoordinate: (coord) => {
    return Array.isArray(coord) && 
           coord.length === 2 && 
           typeof coord[0] === 'number' && 
           typeof coord[1] === 'number' &&
           coord[0] >= -90 && coord[0] <= 90 &&
           coord[1] >= -180 && coord[1] <= 180;
  },

  // Validate MapKit route format
  isValidMapKitRoute: (route) => {
    return route &&
           Array.isArray(route.coordinates) &&
           route.coordinates.length > 0 &&
           route.coordinates.every(coord => testUtils.isValidCoordinate(coord)) &&
           typeof route.total_distance_meters === 'number' &&
           typeof route.estimated_time_seconds === 'number' &&
           Array.isArray(route.instructions) &&
           Array.isArray(route.waypoints);
  },

  // Clean up test data
  cleanupTestData: async () => {
    // Implementation for cleaning up test routes/stories from database
    console.log('Cleaning up test data...');
  }
};

// Set longer timeout for integration tests
jest.setTimeout(global.testConfig.testTimeout);

// Setup and teardown hooks
beforeAll(async () => {
  console.log('🧪 Starting RouteStory Backend Test Suite');
  
  // Verify required environment variables
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_MAPS_API_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
});

afterAll(async () => {
  console.log('🧹 Cleaning up after tests');
  await global.testUtils.cleanupTestData();
});

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});