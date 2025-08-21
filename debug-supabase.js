#!/usr/bin/env node

require('dotenv').config();

async function debugSupabase() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  
  console.log('🔍 Debugging Supabase connection...');
  console.log('URL:', url);
  console.log('Anon Key Length:', anonKey?.length || 0);
  console.log('Anon Key Starts With:', anonKey?.substring(0, 10) + '...');
  
  if (!url || !anonKey) {
    console.log('❌ Missing credentials');
    return;
  }
  
  try {
    // Test basic connection
    console.log('\n🌐 Testing basic connection...');
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Response Body:', text);
    
    if (response.ok) {
      console.log('✅ Connection successful!');
    } else {
      console.log('❌ Connection failed');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

debugSupabase();