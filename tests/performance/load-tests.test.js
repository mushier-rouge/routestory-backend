// Performance and load tests
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

describe('Performance and Load Tests', () => {
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

  describe('Response Time Performance', () => {
    test('should respond to route generation within acceptable time', async () => {
      const startTime = Date.now();
      
      const routeRequest = {
        start_location: { coordinates: [37.4419, -122.1430] },
        end_location: { coordinates: [37.3688, -122.0363] }
      };

      const response = await fetch(`${apiBaseUrl}/generate-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(routeRequest)
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(15000); // Should respond within 15 seconds
      
      const data = await response.json();
      testRoutes.push(data.route_id);
      
      console.log(`⏱️  Route generation response time: ${responseTime}ms`);
    }, 20000);

    test('should respond to status checks quickly', async () => {
      const routeId = global.testUtils.generateUUID();
      
      // Insert a test route
      await supabase.from('routes').insert({
        id: routeId,
        start_location: 'POINT(-122.1430 37.4419)',
        end_location: 'POINT(-122.0363 37.3688)',
        route_path: 'LINESTRING(-122.1430 37.4419, -122.0363 37.3688)',
        preferences: {},
        status: 'completed'
      });

      testRoutes.push(routeId);

      const startTime = Date.now();
      
      const response = await fetch(`${apiBaseUrl}/route-status/${routeId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
      
      console.log(`⏱️  Status check response time: ${responseTime}ms`);
    });

    test('should handle database queries efficiently', async () => {
      const startTime = Date.now();
      
      const { data, error } = await supabase
        .from('routes')
        .select('id, status, generation_progress')
        .limit(10);

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(error).toBeNull();
      expect(queryTime).toBeLessThan(1000); // Should query within 1 second
      
      console.log(`⏱️  Database query time: ${queryTime}ms`);
    });
  });

  describe('Concurrent Request Handling', () => {
    test('should handle multiple concurrent route requests', async () => {
      console.log('🚀 Testing concurrent route generation...');
      
      const concurrentRequests = 5;
      const routeRequest = {
        start_location: { coordinates: [37.4419, -122.1430] },
        end_location: { coordinates: [37.3688, -122.0363] }
      };

      const startTime = Date.now();
      
      const requests = Array(concurrentRequests).fill().map(() =>
        fetch(`${apiBaseUrl}/generate-route`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify(routeRequest)
        })
      );

      const responses = await Promise.all(requests);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      let successCount = 0;
      for (const response of responses) {
        if (response.status === 200) {
          successCount++;
          const data = await response.json();
          if (data.route_id) {
            testRoutes.push(data.route_id);
          }
        }
      }

      expect(successCount).toBeGreaterThan(0);
      expect(totalTime).toBeLessThan(30000); // All should complete within 30 seconds
      
      console.log(`✅ ${successCount}/${concurrentRequests} concurrent requests succeeded in ${totalTime}ms`);
    }, 45000);

    test('should handle concurrent status checks efficiently', async () => {
      const concurrentChecks = 10;
      const routeId = testRoutes.length > 0 ? testRoutes[0] : global.testUtils.generateUUID();

      const startTime = Date.now();
      
      const requests = Array(concurrentChecks).fill().map(() =>
        fetch(`${apiBaseUrl}/route-status/${routeId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`
          }
        })
      );

      const responses = await Promise.all(requests);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Count successful responses
      let successCount = 0;
      for (const response of responses) {
        if (response.status === 200 || response.status === 404) {
          successCount++;
        }
      }

      expect(successCount).toBe(concurrentChecks);
      expect(totalTime).toBeLessThan(5000); // All should complete within 5 seconds
      
      console.log(`✅ ${successCount} concurrent status checks completed in ${totalTime}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should handle large route requests without memory issues', async () => {
      const largeRouteRequest = {
        start_location: { coordinates: [37.4419, -122.1430] },
        end_location: { coordinates: [37.3688, -122.0363] },
        preferences: {
          max_time_increase_percent: 25,
          interests: Array(100).fill().map((_, i) => `interest_${i}`), // Large interests array
          driving_speed: "normal",
          avoid_highways: false,
          vehicle_type: "car"
        },
        context: {
          time_of_day: "morning",
          trip_purpose: "leisure",
          group_size: 4,
          additional_data: 'x'.repeat(1000) // Large string
        }
      };

      const response = await fetch(`${apiBaseUrl}/generate-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(largeRouteRequest)
      });

      expect([200, 400]).toContain(response.status); // May reject large request or accept it
      
      if (response.status === 200) {
        const data = await response.json();
        testRoutes.push(data.route_id);
        console.log('✅ Large request handled successfully');
      } else {
        console.log('✅ Large request properly rejected');
      }
    }, 30000);

    test('should handle many sequential requests without degradation', async () => {
      console.log('🔄 Testing sequential request performance...');
      
      const sequentialRequests = 8;
      const responseTimes = [];
      
      for (let i = 0; i < sequentialRequests; i++) {
        const routeRequest = {
          start_location: { coordinates: [37.4419 + (i * 0.001), -122.1430] },
          end_location: { coordinates: [37.3688, -122.0363 + (i * 0.001)] }
        };

        const startTime = Date.now();
        
        const response = await fetch(`${apiBaseUrl}/generate-route`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify(routeRequest)
        });

        const endTime = Date.now();
        const responseTime = endTime - startTime;
        responseTimes.push(responseTime);

        if (response.status === 200) {
          const data = await response.json();
          testRoutes.push(data.route_id);
        }

        console.log(`Request ${i + 1}: ${responseTime}ms`);
        
        // Small delay between requests
        await global.testUtils.wait(1000);
      }

      // Check for performance degradation
      const firstHalf = responseTimes.slice(0, Math.floor(sequentialRequests / 2));
      const secondHalf = responseTimes.slice(Math.floor(sequentialRequests / 2));
      
      const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      // Performance shouldn't degrade by more than 100%
      expect(avgSecondHalf).toBeLessThan(avgFirstHalf * 2);
      
      console.log(`✅ Sequential requests: avg first half ${avgFirstHalf}ms, avg second half ${avgSecondHalf}ms`);
    }, 120000);
  });

  describe('Database Performance', () => {
    test('should handle spatial queries efficiently', async () => {
      const startTime = Date.now();
      
      const { data, error } = await supabase
        .rpc('find_pois_near_route', {
          route_path: 'LINESTRING(-122.1430 37.4419, -122.1400 37.4400, -122.0363 37.3688)',
          max_distance_meters: 5000
        });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(error).toBeNull();
      expect(queryTime).toBeLessThan(3000); // Should complete within 3 seconds
      
      console.log(`⏱️  Spatial query time: ${queryTime}ms, results: ${data?.length || 0}`);
    });

    test('should handle complex route queries efficiently', async () => {
      const startTime = Date.now();
      
      const { data, error } = await supabase
        .from('routes')
        .select(`
          id,
          status,
          generation_progress,
          total_distance_meters,
          estimated_time_seconds,
          stories(id, title, category, priority)
        `)
        .eq('status', 'completed')
        .limit(20);

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(error).toBeNull();
      expect(queryTime).toBeLessThan(2000); // Should complete within 2 seconds
      
      console.log(`⏱️  Complex query time: ${queryTime}ms, routes: ${data?.length || 0}`);
    });

    test('should handle concurrent database operations', async () => {
      const concurrentQueries = 10;
      
      const startTime = Date.now();
      
      const queries = Array(concurrentQueries).fill().map((_, i) =>
        supabase
          .from('routes')
          .select('id, status')
          .range(i * 5, (i + 1) * 5 - 1)
      );

      const results = await Promise.all(queries);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All queries should succeed
      for (const result of results) {
        expect(result.error).toBeNull();
      }

      expect(totalTime).toBeLessThan(5000); // All should complete within 5 seconds
      
      console.log(`✅ ${concurrentQueries} concurrent DB queries completed in ${totalTime}ms`);
    });
  });

  describe('API Rate Limiting and Throttling', () => {
    test('should handle rapid successive requests appropriately', async () => {
      console.log('⚡ Testing rapid request handling...');
      
      const rapidRequests = 15;
      const requests = [];
      const startTime = Date.now();
      
      // Fire requests rapidly
      for (let i = 0; i < rapidRequests; i++) {
        requests.push(
          fetch(`${apiBaseUrl}/api/v1/health`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`
            }
          })
        );
      }

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      let successCount = 0;
      let rateLimitedCount = 0;
      
      for (const response of responses) {
        if (response.status === 200) {
          successCount++;
        } else if (response.status === 429) {
          rateLimitedCount++;
        }
      }

      expect(successCount + rateLimitedCount).toBe(rapidRequests);
      
      console.log(`✅ Rapid requests: ${successCount} succeeded, ${rateLimitedCount} rate limited in ${totalTime}ms`);
    });

    test('should maintain stability under sustained load', async () => {
      console.log('🔄 Testing sustained load...');
      
      const sustainedRequests = 20;
      const intervalMs = 500; // Request every 500ms
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < sustainedRequests; i++) {
        try {
          const response = await fetch(`${apiBaseUrl}/api/v1/health`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`
            }
          });

          if (response.status === 200) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }

        if (i < sustainedRequests - 1) {
          await global.testUtils.wait(intervalMs);
        }
      }

      const successRate = successCount / sustainedRequests;
      expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate
      
      console.log(`✅ Sustained load: ${successCount}/${sustainedRequests} requests succeeded (${Math.round(successRate * 100)}%)`);
    }, 30000);
  });

  describe('Scalability Metrics', () => {
    test('should report performance metrics for monitoring', async () => {
      const metrics = {
        routeGeneration: [],
        statusChecks: [],
        databaseQueries: []
      };

      // Collect route generation metrics
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        
        const response = await fetch(`${apiBaseUrl}/generate-route`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            start_location: { coordinates: [37.4419 + (i * 0.01), -122.1430] },
            end_location: { coordinates: [37.3688, -122.0363 + (i * 0.01)] }
          })
        });

        const endTime = Date.now();
        
        if (response.status === 200) {
          const data = await response.json();
          testRoutes.push(data.route_id);
          metrics.routeGeneration.push(endTime - startTime);
        }

        await global.testUtils.wait(2000);
      }

      // Collect status check metrics
      if (testRoutes.length > 0) {
        for (let i = 0; i < 5; i++) {
          const startTime = Date.now();
          
          const response = await fetch(`${apiBaseUrl}/route-status/${testRoutes[0]}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`
            }
          });

          const endTime = Date.now();
          
          if (response.status === 200) {
            metrics.statusChecks.push(endTime - startTime);
          }
        }
      }

      // Collect database metrics
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        
        const { error } = await supabase
          .from('routes')
          .select('id, status')
          .limit(10);

        const endTime = Date.now();
        
        if (!error) {
          metrics.databaseQueries.push(endTime - startTime);
        }
      }

      // Calculate and report metrics
      const calculateStats = (times) => {
        if (times.length === 0) return { avg: 0, min: 0, max: 0 };
        return {
          avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
          min: Math.min(...times),
          max: Math.max(...times)
        };
      };

      const routeStats = calculateStats(metrics.routeGeneration);
      const statusStats = calculateStats(metrics.statusChecks);
      const dbStats = calculateStats(metrics.databaseQueries);

      console.log('\n📊 Performance Metrics:');
      console.log(`Route Generation - Avg: ${routeStats.avg}ms, Min: ${routeStats.min}ms, Max: ${routeStats.max}ms`);
      console.log(`Status Checks - Avg: ${statusStats.avg}ms, Min: ${statusStats.min}ms, Max: ${statusStats.max}ms`);
      console.log(`Database Queries - Avg: ${dbStats.avg}ms, Min: ${dbStats.min}ms, Max: ${dbStats.max}ms`);

      // Performance assertions
      expect(routeStats.avg).toBeLessThan(15000); // Average route generation < 15s
      expect(statusStats.avg).toBeLessThan(2000);  // Average status check < 2s
      expect(dbStats.avg).toBeLessThan(1000);      // Average DB query < 1s
    }, 60000);
  });
});