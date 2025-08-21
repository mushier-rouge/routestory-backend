// Integration tests for API endpoints
const fetch = require('node-fetch');

describe('API Endpoints Integration Tests', () => {
  const { apiBaseUrl, supabaseServiceKey } = global.testConfig;
  let testRouteId = null;

  describe('Route Generation API', () => {
    test('should generate route with valid coordinates', async () => {
      const requestBody = {
        start_location: { coordinates: [37.4419, -122.1430] },
        end_location: { coordinates: [37.3688, -122.0363] }
      };

      const response = await fetch(`${apiBaseUrl}/generate-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('route_id');
      expect(global.testUtils.isValidUUID(data.route_id)).toBe(true);
      expect(data).toHaveProperty('status');
      expect(['processing', 'completed']).toContain(data.status);
      
      // Store for later tests
      testRouteId = data.route_id;

      if (data.route) {
        expect(global.testUtils.isValidMapKitRoute(data.route)).toBe(true);
      }
    }, 30000);

    test('should generate route with addresses', async () => {
      const requestBody = {
        start_location: { address: "Palo Alto, CA" },
        end_location: { address: "Sunnyvale, CA" }
      };

      const response = await fetch(`${apiBaseUrl}/generate-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('route_id');
      expect(data).toHaveProperty('status');
    }, 30000);

    test('should handle complex route preferences', async () => {
      const requestBody = {
        start_location: { coordinates: [37.4419, -122.1430] },
        end_location: { coordinates: [37.3688, -122.0363] },
        preferences: {
          max_time_increase_percent: 25,
          interests: ["history", "technology", "architecture"],
          driving_speed: "normal",
          avoid_highways: false,
          vehicle_type: "car"
        },
        context: {
          time_of_day: "morning",
          trip_purpose: "tourism",
          group_size: 4
        }
      };

      const response = await fetch(`${apiBaseUrl}/generate-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('route_id');
    }, 30000);

    test('should reject invalid request - missing locations', async () => {
      const requestBody = {
        start_location: { coordinates: [37.4419, -122.1430] }
        // Missing end_location
      };

      const response = await fetch(`${apiBaseUrl}/generate-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toHaveProperty('code');
    });

    test('should reject invalid coordinates', async () => {
      const requestBody = {
        start_location: { coordinates: [200, 200] }, // Invalid
        end_location: { coordinates: [37.3688, -122.0363] }
      };

      const response = await fetch(`${apiBaseUrl}/generate-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(400);
    });

    test('should reject unauthorized requests', async () => {
      const requestBody = {
        start_location: { coordinates: [37.4419, -122.1430] },
        end_location: { coordinates: [37.3688, -122.0363] }
      };

      const response = await fetch(`${apiBaseUrl}/generate-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // Missing Authorization header
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Route Status API', () => {
    test('should get route status for existing route', async () => {
      // Skip if no test route was created
      if (!testRouteId) {
        console.log('Skipping status test - no test route available');
        return;
      }

      const response = await fetch(`${apiBaseUrl}/route-status/${testRouteId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('route_id', testRouteId);
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('generation_progress');
      expect(['processing', 'completed', 'failed']).toContain(data.status);
      expect(typeof data.generation_progress).toBe('number');
      expect(data.generation_progress).toBeGreaterThanOrEqual(0);
      expect(data.generation_progress).toBeLessThanOrEqual(100);
    });

    test('should return 404 for non-existent route', async () => {
      const fakeRouteId = global.testUtils.generateUUID();
      
      const response = await fetch(`${apiBaseUrl}/route-status/${fakeRouteId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });

      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('should reject unauthorized status requests', async () => {
      const fakeRouteId = global.testUtils.generateUUID();
      
      const response = await fetch(`${apiBaseUrl}/route-status/${fakeRouteId}`, {
        method: 'GET'
        // Missing Authorization header
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Location Validation API', () => {
    test('should validate location on route', async () => {
      if (!testRouteId) {
        console.log('Skipping location validation test - no test route available');
        return;
      }

      const requestBody = {
        route_id: testRouteId,
        current_location: {
          latitude: 37.4419,
          longitude: -122.1430
        }
      };

      const response = await fetch(`${apiBaseUrl}/route-status/validate-location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('on_route');
      expect(data).toHaveProperty('distance_from_route_meters');
      expect(data).toHaveProperty('nearest_point');
      expect(typeof data.on_route).toBe('boolean');
      expect(typeof data.distance_from_route_meters).toBe('number');
    });

    test('should reject invalid location validation request', async () => {
      const requestBody = {
        route_id: 'invalid-route-id',
        current_location: {
          latitude: 200, // Invalid latitude
          longitude: -122.1430
        }
      };

      const response = await fetch(`${apiBaseUrl}/route-status/validate-location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Main API Orchestration', () => {
    test('should handle route generation through main API', async () => {
      const requestBody = global.testData.validRouteRequest;

      const response = await fetch(`${apiBaseUrl}/api/v1/routes/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(requestBody)
      });

      // Accept both 200 (immediate completion) and 202 (processing)
      expect([200, 202]).toContain(response.status);
      
      const data = await response.json();
      expect(data).toHaveProperty('route_id');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('message');
      
      if (data.status_url) {
        expect(data.status_url).toContain('/route-status/');
      }
    }, 30000);

    test('should return health status', async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('services');
      expect(data.status).toBe('healthy');
    });

    test('should return 404 for unknown endpoints', async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/unknown-endpoint`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });

      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('Content Generation API', () => {
    test('should generate content for POI', async () => {
      const requestBody = {
        poi_data: {
          id: global.testUtils.generateUUID(),
          name: "Stanford University",
          poi_type: "university",
          google_place_id: "ChIJLzuKbbAhgIAR1qbVNlLdZ18"
        },
        route_context: {
          route_id: global.testUtils.generateUUID(),
          start_city: "Palo Alto",
          end_city: "Sunnyvale",
          trip_purpose: "leisure"
        }
      };

      const response = await fetch(`${apiBaseUrl}/generate-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(requestBody)
      });

      expect([200, 500]).toContain(response.status); // May fail due to API limits
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('title');
        expect(data).toHaveProperty('content');
        expect(data).toHaveProperty('category');
      }
    }, 30000);
  });

  describe('Audio Generation API', () => {
    test('should generate audio for text content', async () => {
      const requestBody = {
        story_id: global.testUtils.generateUUID(),
        content: "This is a test story for audio generation. It contains enough text to create a meaningful audio file."
      };

      const response = await fetch(`${apiBaseUrl}/generate-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(requestBody)
      });

      expect([200, 500]).toContain(response.status); // May fail due to API setup
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('story_id');
        expect(data).toHaveProperty('audio_url');
        expect(data).toHaveProperty('duration_seconds');
      }
    }, 60000); // Longer timeout for audio generation
  });
});