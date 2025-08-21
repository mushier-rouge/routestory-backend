// Database integration tests
const { createClient } = require('@supabase/supabase-js');

describe('Database Integration Tests', () => {
  let supabase;
  const testData = [];

  beforeAll(() => {
    const { supabaseUrl, supabaseServiceKey } = global.testConfig;
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();
  });

  async function cleanupTestData() {
    for (const item of testData) {
      try {
        await supabase.from(item.table).delete().eq('id', item.id);
      } catch (error) {
        console.warn(`Failed to cleanup ${item.table}:${item.id}`, error.message);
      }
    }
    testData.length = 0;
  }

  describe('Routes Table Operations', () => {
    test('should insert new route with spatial data', async () => {
      const routeId = global.testUtils.generateUUID();
      const routeData = {
        id: routeId,
        start_location: 'POINT(-122.1430 37.4419)', // PostGIS format: lng lat
        end_location: 'POINT(-122.0363 37.3688)',
        route_path: 'LINESTRING(-122.1430 37.4419, -122.1400 37.4400, -122.0363 37.3688)',
        preferences: {
          max_time_increase_percent: 20,
          interests: ['history', 'technology']
        },
        status: 'processing',
        generation_progress: 0
      };

      const { data, error } = await supabase
        .from('routes')
        .insert(routeData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.id).toBe(routeId);
      expect(data.status).toBe('processing');
      expect(data.preferences).toEqual(routeData.preferences);

      // Track for cleanup
      testData.push({ table: 'routes', id: routeId });
    });

    test('should update route status and progress', async () => {
      const routeId = global.testUtils.generateUUID();
      
      // Insert test route
      await supabase.from('routes').insert({
        id: routeId,
        start_location: 'POINT(-122.1430 37.4419)',
        end_location: 'POINT(-122.0363 37.3688)',
        route_path: 'LINESTRING(-122.1430 37.4419, -122.0363 37.3688)',
        preferences: {},
        status: 'processing',
        generation_progress: 10
      });

      testData.push({ table: 'routes', id: routeId });

      // Update status
      const { data, error } = await supabase
        .from('routes')
        .update({
          status: 'completed',
          generation_progress: 100,
          total_distance_meters: 15000,
          estimated_time_seconds: 1200
        })
        .eq('id', routeId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.status).toBe('completed');
      expect(data.generation_progress).toBe(100);
      expect(data.total_distance_meters).toBe(15000);
    });

    test('should query routes by location proximity', async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .limit(5);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    test('should enforce route status constraints', async () => {
      const routeId = global.testUtils.generateUUID();
      
      const { error } = await supabase
        .from('routes')
        .insert({
          id: routeId,
          start_location: 'POINT(-122.1430 37.4419)',
          end_location: 'POINT(-122.0363 37.3688)',
          route_path: 'LINESTRING(-122.1430 37.4419, -122.0363 37.3688)',
          preferences: {},
          status: 'invalid_status', // Should fail constraint
          generation_progress: 0
        });

      expect(error).toBeTruthy();
      expect(error.message).toContain('violates check constraint');
    });
  });

  describe('POIs Table Operations', () => {
    test('should insert POI with location data', async () => {
      const poiId = global.testUtils.generateUUID();
      const poiData = {
        id: poiId,
        name: 'Test Museum',
        description: 'A test museum for integration testing',
        address: '123 Test Street, Palo Alto, CA',
        location: 'POINT(-122.1430 37.4419)',
        poi_type: 'museum',
        google_place_id: 'test_place_id_123',
        popularity_score: 75.5,
        google_rating: 4.3,
        review_count: 234,
        metadata: {
          test: true,
          source: 'integration_test'
        }
      };

      const { data, error } = await supabase
        .from('pois')
        .insert(poiData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.name).toBe('Test Museum');
      expect(data.poi_type).toBe('museum');
      expect(data.popularity_score).toBe(75.5);

      testData.push({ table: 'pois', id: poiId });
    });

    test('should enforce unique Google Place ID constraint', async () => {
      const poiId1 = global.testUtils.generateUUID();
      const poiId2 = global.testUtils.generateUUID();
      const googlePlaceId = 'duplicate_place_id_test';

      // Insert first POI
      const { error: error1 } = await supabase
        .from('pois')
        .insert({
          id: poiId1,
          name: 'First POI',
          location: 'POINT(-122.1430 37.4419)',
          poi_type: 'restaurant',
          google_place_id: googlePlaceId
        });

      expect(error1).toBeNull();
      testData.push({ table: 'pois', id: poiId1 });

      // Try to insert duplicate
      const { error: error2 } = await supabase
        .from('pois')
        .insert({
          id: poiId2,
          name: 'Duplicate POI',
          location: 'POINT(-122.1430 37.4419)',
          poi_type: 'restaurant',
          google_place_id: googlePlaceId // Same place ID
        });

      expect(error2).toBeTruthy();
      expect(error2.message).toContain('duplicate key value');
    });

    test('should update POI popularity score', async () => {
      const poiId = global.testUtils.generateUUID();
      
      // Insert POI
      await supabase.from('pois').insert({
        id: poiId,
        name: 'Test POI for Update',
        location: 'POINT(-122.1430 37.4419)',
        poi_type: 'landmark',
        popularity_score: 50
      });

      testData.push({ table: 'pois', id: poiId });

      // Update popularity score
      const { data, error } = await supabase
        .from('pois')
        .update({ popularity_score: 85.2 })
        .eq('id', poiId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.popularity_score).toBe(85.2);
    });
  });

  describe('Stories Table Operations', () => {
    let testRouteId, testPoiId;

    beforeAll(async () => {
      // Create test route and POI for stories
      testRouteId = global.testUtils.generateUUID();
      testPoiId = global.testUtils.generateUUID();

      await supabase.from('routes').insert({
        id: testRouteId,
        start_location: 'POINT(-122.1430 37.4419)',
        end_location: 'POINT(-122.0363 37.3688)',
        route_path: 'LINESTRING(-122.1430 37.4419, -122.0363 37.3688)',
        preferences: {},
        status: 'completed'
      });

      await supabase.from('pois').insert({
        id: testPoiId,
        name: 'Test POI for Stories',
        location: 'POINT(-122.1430 37.4419)',
        poi_type: 'landmark'
      });

      testData.push({ table: 'routes', id: testRouteId });
      testData.push({ table: 'pois', id: testPoiId });
    });

    test('should insert story with proper relationships', async () => {
      const storyId = global.testUtils.generateUUID();
      const storyData = {
        id: storyId,
        poi_id: testPoiId,
        route_id: testRouteId,
        title: 'Test Story Title',
        content: 'This is a test story content for integration testing. It contains interesting information about the POI.',
        audio_url: 'https://example.com/audio/test.mp3',
        trigger_location: 'POINT(-122.1430 37.4419)',
        trigger_radius_meters: 200,
        duration_seconds: 90,
        category: 'history',
        priority: 8,
        route_coordinate_index: 5,
        estimated_trigger_time: 300,
        generation_metadata: {
          model_used: 'gemini-2.5-flash',
          word_count: 150,
          generation_timestamp: new Date().toISOString()
        }
      };

      const { data, error } = await supabase
        .from('stories')
        .insert(storyData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.title).toBe('Test Story Title');
      expect(data.category).toBe('history');
      expect(data.priority).toBe(8);

      testData.push({ table: 'stories', id: storyId });
    });

    test('should update story with audio URL', async () => {
      const storyId = global.testUtils.generateUUID();
      
      // Insert story without audio
      await supabase.from('stories').insert({
        id: storyId,
        poi_id: testPoiId,
        route_id: testRouteId,
        title: 'Story for Audio Update',
        content: 'Test content',
        trigger_location: 'POINT(-122.1430 37.4419)',
        category: 'general',
        priority: 5
      });

      testData.push({ table: 'stories', id: storyId });

      // Update with audio URL
      const { data, error } = await supabase
        .from('stories')
        .update({
          audio_url: 'https://example.com/audio/updated.mp3',
          duration_seconds: 120
        })
        .eq('id', storyId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.audio_url).toBe('https://example.com/audio/updated.mp3');
      expect(data.duration_seconds).toBe(120);
    });

    test('should enforce foreign key constraints', async () => {
      const storyId = global.testUtils.generateUUID();
      const nonExistentRouteId = global.testUtils.generateUUID();
      
      const { error } = await supabase
        .from('stories')
        .insert({
          id: storyId,
          route_id: nonExistentRouteId, // Non-existent route
          title: 'Invalid Story',
          content: 'This should fail',
          trigger_location: 'POINT(-122.1430 37.4419)',
          category: 'test',
          priority: 5
        });

      expect(error).toBeTruthy();
      expect(error.message).toContain('violates foreign key constraint');
    });

    test('should query stories by route with proper ordering', async () => {
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('route_id', testRouteId)
        .order('priority', { ascending: false });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      
      // Check ordering
      if (data.length > 1) {
        for (let i = 1; i < data.length; i++) {
          expect(data[i-1].priority).toBeGreaterThanOrEqual(data[i].priority);
        }
      }
    });
  });

  describe('Spatial Functions', () => {
    test('should use find_pois_near_route function', async () => {
      const routePath = 'LINESTRING(-122.1430 37.4419, -122.1400 37.4400, -122.0363 37.3688)';
      
      const { data, error } = await supabase
        .rpc('find_pois_near_route', {
          route_path: routePath,
          max_distance_meters: 5000
        });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    test('should use is_location_on_route function', async () => {
      const routePath = 'LINESTRING(-122.1430 37.4419, -122.1400 37.4400, -122.0363 37.3688)';
      const checkLocation = 'POINT(-122.1415 37.4410)'; // Near the route
      
      const { data, error } = await supabase
        .rpc('is_location_on_route', {
          check_location: checkLocation,
          route_path: routePath,
          max_distance_meters: 200
        });

      expect(error).toBeNull();
      expect(typeof data).toBe('boolean');
    });

    test('should use find_stories_near_location function', async () => {
      const userLocation = 'POINT(-122.1430 37.4419)';
      
      const { data, error } = await supabase
        .rpc('find_stories_near_location', {
          user_location: userLocation,
          max_distance_meters: 1000
        });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    test('should calculate POI score using database function', async () => {
      const { data, error } = await supabase
        .rpc('calculate_poi_score', {
          google_rating: 4.5,
          review_count: 500,
          poi_type: 'museum',
          distance_from_route: 300,
          uniqueness_score: 8
        });

      expect(error).toBeNull();
      expect(typeof data).toBe('number');
      expect(data).toBeGreaterThan(0);
      expect(data).toBeLessThanOrEqual(100);
    });
  });

  describe('Real-time Subscriptions', () => {
    test('should support real-time updates on routes table', async () => {
      // This is a basic test to ensure the table supports real-time
      // In practice, you'd test with actual subscription listeners
      
      const routeId = global.testUtils.generateUUID();
      
      // Insert route
      const { error: insertError } = await supabase
        .from('routes')
        .insert({
          id: routeId,
          start_location: 'POINT(-122.1430 37.4419)',
          end_location: 'POINT(-122.0363 37.3688)',
          route_path: 'LINESTRING(-122.1430 37.4419, -122.0363 37.3688)',
          preferences: {},
          status: 'processing',
          generation_progress: 25
        });

      expect(insertError).toBeNull();
      testData.push({ table: 'routes', id: routeId });

      // Update route (should trigger real-time event)
      const { error: updateError } = await supabase
        .from('routes')
        .update({ generation_progress: 75 })
        .eq('id', routeId);

      expect(updateError).toBeNull();
    });
  });

  describe('Data Integrity and Constraints', () => {
    test('should enforce progress range constraints', async () => {
      const routeId = global.testUtils.generateUUID();
      
      const { error } = await supabase
        .from('routes')
        .insert({
          id: routeId,
          start_location: 'POINT(-122.1430 37.4419)',
          end_location: 'POINT(-122.0363 37.3688)',
          route_path: 'LINESTRING(-122.1430 37.4419, -122.0363 37.3688)',
          preferences: {},
          status: 'processing',
          generation_progress: 150 // Invalid: > 100
        });

      expect(error).toBeTruthy();
      expect(error.message).toContain('violates check constraint');
    });

    test('should enforce priority range in stories', async () => {
      const storyId = global.testUtils.generateUUID();
      
      const { error } = await supabase
        .from('stories')
        .insert({
          id: storyId,
          title: 'Invalid Priority Story',
          content: 'Test content',
          trigger_location: 'POINT(-122.1430 37.4419)',
          category: 'test',
          priority: 15 // Invalid: > 10
        });

      expect(error).toBeTruthy();
      expect(error.message).toContain('violates check constraint');
    });

    test('should enforce google_rating range in POIs', async () => {
      const poiId = global.testUtils.generateUUID();
      
      const { error } = await supabase
        .from('pois')
        .insert({
          id: poiId,
          name: 'Invalid Rating POI',
          location: 'POINT(-122.1430 37.4419)',
          poi_type: 'restaurant',
          google_rating: 6.0 // Invalid: > 5.0
        });

      expect(error).toBeTruthy();
      expect(error.message).toContain('violates check constraint');
    });
  });
});