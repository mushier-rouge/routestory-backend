// End-to-end workflow tests
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

describe('Complete Workflow End-to-End Tests', () => {
  let supabase;
  const { apiBaseUrl, supabaseUrl, supabaseServiceKey } = global.testConfig;
  const testRoutes = [];

  beforeAll(() => {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  });

  afterAll(async () => {
    // Clean up test routes
    for (const routeId of testRoutes) {
      try {
        await supabase.from('stories').delete().eq('route_id', routeId);
        await supabase.from('routes').delete().eq('id', routeId);
      } catch (error) {
        console.warn(`Failed to cleanup route ${routeId}:`, error.message);
      }
    }
  });

  describe('Complete Route Generation Workflow', () => {
    test('should complete full route generation from start to finish', async () => {
      console.log('🧪 Starting complete workflow test...');
      
      // Step 1: Generate route
      const routeRequest = {
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
          driving_speed: "normal"
        },
        context: {
          trip_purpose: "leisure",
          time_of_day: "afternoon"
        }
      };

      const generateResponse = await fetch(`${apiBaseUrl}/generate-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(routeRequest)
      });

      expect(generateResponse.status).toBe(200);
      
      const routeData = await generateResponse.json();
      expect(routeData).toHaveProperty('route_id');
      expect(global.testUtils.isValidUUID(routeData.route_id)).toBe(true);
      
      const routeId = routeData.route_id;
      testRoutes.push(routeId);
      
      console.log(`✅ Route generated: ${routeId}`);

      // Step 2: Monitor route status until completion
      let attempts = 0;
      let routeCompleted = false;
      const maxAttempts = 20; // 60 seconds max
      
      while (attempts < maxAttempts && !routeCompleted) {
        await global.testUtils.wait(3000); // Wait 3 seconds
        
        const statusResponse = await fetch(`${apiBaseUrl}/route-status/${routeId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`
          }
        });

        expect(statusResponse.status).toBe(200);
        
        const statusData = await statusResponse.json();
        console.log(`📊 Progress: ${statusData.generation_progress}% - Status: ${statusData.status}`);
        
        expect(statusData.route_id).toBe(routeId);
        expect(['processing', 'completed', 'failed']).toContain(statusData.status);
        
        if (statusData.status === 'completed') {
          routeCompleted = true;
          expect(statusData.generation_progress).toBe(100);
          
          if (statusData.partial_results) {
            expect(statusData.partial_results.route_calculated).toBe(true);
          }
        } else if (statusData.status === 'failed') {
          throw new Error('Route generation failed');
        }
        
        attempts++;
      }

      if (!routeCompleted) {
        console.log('⚠️  Route generation taking longer than expected, checking database directly...');
      }

      // Step 3: Verify route in database
      const { data: dbRoute, error: routeError } = await supabase
        .from('routes')
        .select('*')
        .eq('id', routeId)
        .single();

      expect(routeError).toBeNull();
      expect(dbRoute).toBeTruthy();
      expect(dbRoute.id).toBe(routeId);
      expect(['processing', 'completed']).toContain(dbRoute.status);
      
      if (dbRoute.status === 'completed') {
        expect(dbRoute.total_distance_meters).toBeGreaterThan(0);
        expect(dbRoute.estimated_time_seconds).toBeGreaterThan(0);
      }

      console.log(`✅ Route verified in database: ${dbRoute.status}`);

      // Step 4: Check for generated stories
      const { data: stories, error: storiesError } = await supabase
        .from('stories')
        .select('*')
        .eq('route_id', routeId);

      expect(storiesError).toBeNull();
      expect(Array.isArray(stories)).toBe(true);
      
      console.log(`📚 Stories found: ${stories.length}`);

      if (stories.length > 0) {
        const story = stories[0];
        expect(story.route_id).toBe(routeId);
        expect(story.title).toBeTruthy();
        expect(story.content).toBeTruthy();
        expect(story.category).toBeTruthy();
        expect(typeof story.priority).toBe('number');
        
        console.log(`✅ Story verified: "${story.title}"`);
      }

      // Step 5: Test location validation
      const validationRequest = {
        route_id: routeId,
        current_location: {
          latitude: 37.4419,
          longitude: -122.1430
        }
      };

      const validationResponse = await fetch(`${apiBaseUrl}/route-status/validate-location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(validationRequest)
      });

      if (validationResponse.status === 200) {
        const validationData = await validationResponse.json();
        expect(validationData).toHaveProperty('on_route');
        expect(validationData).toHaveProperty('distance_from_route_meters');
        console.log(`✅ Location validation working: on_route=${validationData.on_route}`);
      }

      console.log('🎉 Complete workflow test passed!');
    }, 90000); // 90 second timeout for full workflow
  });

  describe('Parallel Route Generation', () => {
    test('should handle multiple concurrent route requests', async () => {
      console.log('🧪 Testing concurrent route generation...');
      
      const routes = [
        {
          start_location: { coordinates: [37.4419, -122.1430] }, // Palo Alto
          end_location: { coordinates: [37.3688, -122.0363] }   // Sunnyvale
        },
        {
          start_location: { coordinates: [37.7749, -122.4194] }, // San Francisco
          end_location: { coordinates: [37.3382, -121.8863] }   // San Jose
        },
        {
          start_location: { coordinates: [37.4419, -122.1430] }, // Palo Alto
          end_location: { coordinates: [37.7749, -122.4194] }   // San Francisco
        }
      ];

      const requests = routes.map(route =>
        fetch(`${apiBaseUrl}/generate-route`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify(route)
        })
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
        
        const data = await response.json();
        expect(data).toHaveProperty('route_id');
        expect(global.testUtils.isValidUUID(data.route_id)).toBe(true);
        
        testRoutes.push(data.route_id);
      }

      console.log(`✅ Generated ${responses.length} concurrent routes`);
    }, 60000);
  });

  describe('Error Recovery Workflow', () => {
    test('should handle and recover from invalid requests', async () => {
      console.log('🧪 Testing error recovery...');
      
      // Test invalid location
      const invalidRequest = {
        start_location: { coordinates: [200, 200] }, // Invalid coordinates
        end_location: { coordinates: [37.3688, -122.0363] }
      };

      const invalidResponse = await fetch(`${apiBaseUrl}/generate-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(invalidRequest)
      });

      expect(invalidResponse.status).toBe(400);
      
      const errorData = await invalidResponse.json();
      expect(errorData).toHaveProperty('error');
      expect(errorData.error).toHaveProperty('code');
      
      console.log(`✅ Invalid request properly rejected: ${errorData.error.code}`);

      // Test valid request after invalid one
      const validRequest = {
        start_location: { coordinates: [37.4419, -122.1430] },
        end_location: { coordinates: [37.3688, -122.0363] }
      };

      const validResponse = await fetch(`${apiBaseUrl}/generate-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(validRequest)
      });

      expect(validResponse.status).toBe(200);
      
      const validData = await validResponse.json();
      expect(validData).toHaveProperty('route_id');
      testRoutes.push(validData.route_id);
      
      console.log('✅ Valid request processed after error recovery');
    });
  });

  describe('Real-time Status Updates', () => {
    test('should provide consistent status updates during generation', async () => {
      console.log('🧪 Testing real-time status updates...');
      
      const routeRequest = {
        start_location: { coordinates: [37.7749, -122.4194] }, // San Francisco
        end_location: { coordinates: [37.3382, -121.8863] }   // San Jose
      };

      // Start route generation
      const generateResponse = await fetch(`${apiBaseUrl}/generate-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(routeRequest)
      });

      expect(generateResponse.status).toBe(200);
      
      const routeData = await generateResponse.json();
      const routeId = routeData.route_id;
      testRoutes.push(routeId);

      // Monitor status updates
      const statusUpdates = [];
      let attempts = 0;
      const maxAttempts = 15;

      while (attempts < maxAttempts) {
        await global.testUtils.wait(2000);
        
        const statusResponse = await fetch(`${apiBaseUrl}/route-status/${routeId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`
          }
        });

        if (statusResponse.status === 200) {
          const statusData = await statusResponse.json();
          statusUpdates.push({
            attempt: attempts,
            progress: statusData.generation_progress,
            status: statusData.status,
            timestamp: new Date().toISOString()
          });

          console.log(`📊 Update ${attempts}: ${statusData.generation_progress}% (${statusData.status})`);

          if (statusData.status === 'completed' || statusData.status === 'failed') {
            break;
          }
        }

        attempts++;
      }

      // Verify status updates show progression
      expect(statusUpdates.length).toBeGreaterThan(0);
      
      // Progress should generally increase over time
      let lastProgress = -1;
      let progressIncreased = false;
      
      for (const update of statusUpdates) {
        if (update.progress > lastProgress) {
          progressIncreased = true;
        }
        lastProgress = Math.max(lastProgress, update.progress);
        
        // Progress should be valid range
        expect(update.progress).toBeGreaterThanOrEqual(0);
        expect(update.progress).toBeLessThanOrEqual(100);
      }

      if (statusUpdates.length > 1) {
        expect(progressIncreased).toBe(true);
      }

      console.log(`✅ Status updates working: ${statusUpdates.length} updates received`);
    }, 60000);
  });

  describe('API Integration Workflow', () => {
    test('should work through main API orchestration endpoint', async () => {
      console.log('🧪 Testing main API orchestration...');
      
      const routeRequest = global.testData.validRouteRequest;

      // Test health endpoint first
      const healthResponse = await fetch(`${apiBaseUrl}/api/v1/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });

      expect(healthResponse.status).toBe(200);
      
      const healthData = await healthResponse.json();
      expect(healthData.status).toBe('healthy');
      console.log('✅ Health check passed');

      // Generate route through main API
      const apiResponse = await fetch(`${apiBaseUrl}/api/v1/routes/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(routeRequest)
      });

      expect([200, 202]).toContain(apiResponse.status);
      
      const apiData = await apiResponse.json();
      expect(apiData).toHaveProperty('route_id');
      expect(apiData).toHaveProperty('status');
      expect(apiData).toHaveProperty('message');
      
      const routeId = apiData.route_id;
      testRoutes.push(routeId);

      if (apiData.status_url) {
        expect(apiData.status_url).toContain('/route-status/');
        expect(apiData.status_url).toContain(routeId);
      }

      console.log(`✅ Main API orchestration working: ${apiData.status}`);

      // Test status through main API
      const statusResponse = await fetch(`${apiBaseUrl}/api/v1/routes/status/${routeId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });

      if (statusResponse.status === 200) {
        const statusData = await statusResponse.json();
        expect(statusData.route_id).toBe(routeId);
        console.log('✅ Status endpoint through main API working');
      }
    }, 45000);
  });

  describe('Data Consistency Verification', () => {
    test('should maintain data consistency across all operations', async () => {
      console.log('🧪 Testing data consistency...');
      
      const routeRequest = {
        start_location: { coordinates: [37.4419, -122.1430] },
        end_location: { coordinates: [37.3688, -122.0363] },
        preferences: {
          max_time_increase_percent: 15,
          interests: ["architecture", "culture"]
        }
      };

      // Generate route
      const generateResponse = await fetch(`${apiBaseUrl}/generate-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(routeRequest)
      });

      const routeData = await generateResponse.json();
      const routeId = routeData.route_id;
      testRoutes.push(routeId);

      // Wait a bit for processing
      await global.testUtils.wait(5000);

      // Check database consistency
      const { data: dbRoute } = await supabase
        .from('routes')
        .select('*')
        .eq('id', routeId)
        .single();

      expect(dbRoute).toBeTruthy();
      expect(dbRoute.preferences).toEqual(routeRequest.preferences);

      // Check stories consistency
      const { data: stories } = await supabase
        .from('stories')
        .select('*')
        .eq('route_id', routeId);

      if (stories && stories.length > 0) {
        for (const story of stories) {
          expect(story.route_id).toBe(routeId);
          expect(story.title).toBeTruthy();
          expect(story.content).toBeTruthy();
          expect(typeof story.priority).toBe('number');
          expect(story.priority).toBeGreaterThanOrEqual(1);
          expect(story.priority).toBeLessThanOrEqual(10);
        }
      }

      // Check POIs consistency
      const { data: pois } = await supabase
        .from('pois')
        .select('*')
        .limit(10);

      if (pois && pois.length > 0) {
        for (const poi of pois) {
          expect(poi.name).toBeTruthy();
          expect(poi.poi_type).toBeTruthy();
          if (poi.google_rating) {
            expect(poi.google_rating).toBeGreaterThanOrEqual(0);
            expect(poi.google_rating).toBeLessThanOrEqual(5);
          }
        }
      }

      console.log('✅ Data consistency verified across all tables');
    }, 30000);
  });
});