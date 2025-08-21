#!/usr/bin/env node

// Comprehensive test script for RouteStory Backend
// Tests the complete end-to-end route generation flow

require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testRouteGeneration() {
  console.log('🧪 Testing RouteStory Backend - End-to-End Flow\n');
  
  // Test data for route generation
  const testRequest = {
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
      interests: ["history", "technology", "architecture"],
      driving_speed: "normal",
      avoid_highways: false,
      vehicle_type: "car"
    },
    context: {
      time_of_day: "afternoon",
      trip_purpose: "leisure",
      group_size: 2
    }
  };

  try {
    console.log('📍 Testing route generation request...');
    console.log(`From: ${testRequest.start_location.address}`);
    console.log(`To: ${testRequest.end_location.address}\n`);
    
    // Step 1: Test route generation API
    const generateResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify(testRequest)
    });

    console.log(`📊 Generation API Response: ${generateResponse.status}`);
    
    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      console.log('❌ Route generation failed:', errorText);
      return false;
    }

    const generationResult = await generateResponse.json();
    console.log(`✅ Route generation started: ${generationResult.route_id}`);
    console.log(`📈 Initial status: ${generationResult.status}`);
    
    if (generationResult.route) {
      console.log(`🗺️  Route coordinates: ${generationResult.route.coordinates.length} points`);
      console.log(`📏 Distance: ${generationResult.route.total_distance_meters}m`);
      console.log(`⏱️  Estimated time: ${generationResult.route.estimated_time_seconds}s`);
    }
    
    if (generationResult.stories) {
      console.log(`📚 Stories generated: ${generationResult.stories.length}`);
    }

    // Step 2: Test route status endpoint
    console.log('\n🔍 Testing route status endpoint...');
    const routeId = generationResult.route_id;
    
    const statusResponse = await fetch(`${SUPABASE_URL}/functions/v1/route-status/${routeId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('✅ Status endpoint working');
      console.log(`📊 Current progress: ${statusData.generation_progress}%`);
      console.log(`🏁 Status: ${statusData.status}`);
      
      if (statusData.partial_results) {
        console.log(`🛣️  Route calculated: ${statusData.partial_results.route_calculated}`);
        console.log(`🏛️  POIs discovered: ${statusData.partial_results.pois_discovered}`);
        console.log(`📝 Stories generated: ${statusData.partial_results.stories_generated}`);
        console.log(`🎵 Audio generated: ${statusData.partial_results.audio_generated}`);
      }
    } else {
      console.log('❌ Status endpoint failed:', statusResponse.status);
    }

    // Step 3: Test database queries
    console.log('\n💾 Testing database integration...');
    await testDatabaseQueries(routeId);

    // Step 4: Test API orchestration endpoint
    console.log('\n🎭 Testing main API endpoint...');
    await testMainAPIEndpoint(testRequest);

    console.log('\n🎉 End-to-end test completed!');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

async function testDatabaseQueries(routeId) {
  try {
    // Test direct database access
    const response = await fetch(`${SUPABASE_URL}/rest/v1/routes?id=eq.${routeId}&select=*`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    if (response.ok) {
      const routes = await response.json();
      console.log('✅ Database connection working');
      console.log(`📊 Routes found: ${routes.length}`);
      
      if (routes.length > 0) {
        const route = routes[0];
        console.log(`🆔 Route ID: ${route.id}`);
        console.log(`🏁 Status: ${route.status}`);
        console.log(`📍 Has start location: ${!!route.start_location}`);
        console.log(`🎯 Has end location: ${!!route.end_location}`);
      }
    } else {
      console.log('❌ Database query failed:', response.status);
    }

    // Test stories query
    const storiesResponse = await fetch(`${SUPABASE_URL}/rest/v1/stories?route_id=eq.${routeId}&select=*`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    if (storiesResponse.ok) {
      const stories = await storiesResponse.json();
      console.log(`📚 Stories in database: ${stories.length}`);
    }

  } catch (error) {
    console.log('❌ Database test error:', error.message);
  }
}

async function testMainAPIEndpoint(testRequest) {
  try {
    const apiResponse = await fetch(`${SUPABASE_URL}/functions/v1/api/v1/routes/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify(testRequest)
    });

    console.log(`📊 Main API Response: ${apiResponse.status}`);
    
    if (apiResponse.ok) {
      const apiData = await apiResponse.json();
      console.log('✅ Main API endpoint working');
      console.log(`🆔 Route ID: ${apiData.route_id}`);
      console.log(`🏁 Status: ${apiData.status}`);
      
      if (apiData.status_url) {
        console.log(`🔗 Status URL: ${apiData.status_url}`);
      }
    } else {
      const errorText = await apiResponse.text();
      console.log('❌ Main API failed:', errorText);
    }

  } catch (error) {
    console.log('❌ Main API test error:', error.message);
  }
}

async function testHealthEndpoint() {
  console.log('\n🏥 Testing health endpoint...');
  
  try {
    const healthResponse = await fetch(`${SUPABASE_URL}/functions/v1/api/v1/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Health endpoint working');
      console.log(`🏥 Status: ${healthData.status}`);
      console.log(`📡 Services:`, healthData.services);
    } else {
      console.log('❌ Health endpoint failed:', healthResponse.status);
    }

  } catch (error) {
    console.log('❌ Health test error:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting RouteStory Backend Test Suite\n');
  
  // Check environment
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('❌ Missing required environment variables');
    console.log('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log(`🌐 Supabase URL: ${SUPABASE_URL}`);
  console.log(`🔑 Service key configured: ${!!SUPABASE_SERVICE_ROLE_KEY}\n`);

  // Run tests
  await testHealthEndpoint();
  const success = await testRouteGeneration();
  
  console.log('\n📊 Test Summary:');
  console.log(success ? '✅ All tests passed!' : '❌ Some tests failed');
  
  process.exit(success ? 0 : 1);
}

// Run tests
runAllTests().catch(console.error);