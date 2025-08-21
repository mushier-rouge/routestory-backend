#!/usr/bin/env node

// Test script to verify API connectivity
require('dotenv').config();

async function testGoogleMapsAPI() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === 'your_google_maps_api_key') {
    console.log('❌ Google Maps API key not configured');
    return false;
  }
  
  try {
    // Test geocoding API with a simple request
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=San+Francisco&key=${apiKey}`
    );
    const data = await response.json();
    
    if (data.status === 'OK') {
      console.log('✅ Google Maps API is working');
      return true;
    } else {
      console.log('❌ Google Maps API error:', data.status);
      if (data.error_message) {
        console.log('   Error details:', data.error_message);
      }
      return false;
    }
  } catch (error) {
    console.log('❌ Google Maps API connection failed:', error.message);
    return false;
  }
}

async function testGeminiAPI() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_google_gemini_api_key') {
    console.log('❌ Google Gemini API key not configured');
    return false;
  }
  
  try {
    // Test Gemini API with a simple request - using the correct model name
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Say hello'
            }]
          }]
        })
      }
    );
    
    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0) {
      console.log('✅ Google Gemini API is working');
      return true;
    } else {
      console.log('❌ Google Gemini API error:', data.error || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.log('❌ Google Gemini API connection failed:', error.message);
    return false;
  }
}

async function testGoogleTTSAPI() {
  const serviceAccountPath = './routestory-469621-a256d1e8a772.json';
  
  try {
    // Check if service account file exists
    const fs = require('fs');
    if (!fs.existsSync(serviceAccountPath)) {
      console.log('❌ Google TTS service account file not found:', serviceAccountPath);
      return false;
    }
    
    // For now, just check if the file exists and is valid JSON
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    if (serviceAccount.type === 'service_account' && serviceAccount.project_id) {
      console.log('✅ Google TTS service account file is valid');
      console.log(`   Project ID: ${serviceAccount.project_id}`);
      return true;
    } else {
      console.log('❌ Invalid service account file format');
      return false;
    }
  } catch (error) {
    console.log('❌ Google TTS service account validation failed:', error.message);
    return false;
  }
}

async function testSupabaseConnection() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  
  if (!url || url === 'your_supabase_project_url' || !key || key === 'your_supabase_anon_key') {
    console.log('❌ Supabase credentials not configured');
    return false;
  }
  
  try {
    // Test Supabase connection by hitting the REST API
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    
    if (response.ok) {
      console.log('✅ Supabase connection is working');
      return true;
    } else {
      console.log('❌ Supabase connection error:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Supabase connection failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Testing API connectivity...\n');
  
  const results = await Promise.all([
    testGoogleMapsAPI(),
    testGeminiAPI(), 
    testGoogleTTSAPI(),
    testSupabaseConnection()
  ]);
  
  const allPassed = results.every(result => result === true);
  
  console.log('\n📊 Test Results:');
  console.log(allPassed ? '✅ All APIs are working!' : '❌ Some APIs failed. Check configuration.');
  
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(console.error);