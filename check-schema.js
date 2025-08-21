#!/usr/bin/env node

require('dotenv').config();

async function checkSchema() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('🔍 Checking existing database schema...');
  
  try {
    // Check what tables exist
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const schema = await response.json();
      console.log('\n📋 Available API endpoints:');
      
      if (schema.paths) {
        const tables = Object.keys(schema.paths)
          .filter(path => path.startsWith('/') && !path.includes('{'))
          .map(path => path.replace('/', ''))
          .filter(table => table && table !== 'rpc');
          
        console.log('Tables:', tables.length > 0 ? tables : 'None found');
        
        // Check for our specific tables
        const ourTables = ['routes', 'stories', 'pois'];
        const existingTables = ourTables.filter(table => tables.includes(table));
        const missingTables = ourTables.filter(table => !tables.includes(table));
        
        console.log('\n✅ Existing tables:', existingTables.length > 0 ? existingTables : 'None');
        console.log('❌ Missing tables:', missingTables.length > 0 ? missingTables : 'None');
      }
    }
    
    // Test a simple query to routes table
    console.log('\n🧪 Testing routes table...');
    const routesTest = await fetch(`${url}/rest/v1/routes?select=count`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    });
    
    if (routesTest.ok) {
      console.log('✅ Routes table exists and is accessible');
    } else {
      console.log('❌ Routes table not accessible:', routesTest.status);
    }
    
  } catch (error) {
    console.log('❌ Error checking schema:', error.message);
  }
}

checkSchema();