#!/usr/bin/env node

require('dotenv').config();

async function testSimpleAPI() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('🧪 Testing simple route generation...\n');
  
  const testRequest = {
    start_location: {
      coordinates: [37.4419, -122.1430] // Palo Alto
    },
    end_location: {
      coordinates: [37.3688, -122.0363]  // Sunnyvale
    }
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify(testRequest)
    });

    console.log(`Response status: ${response.status}`);
    const responseText = await response.text();
    console.log('Response:', responseText);

  } catch (error) {
    console.error('Error:', error);
  }
}

testSimpleAPI();