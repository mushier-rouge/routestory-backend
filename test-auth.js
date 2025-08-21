// Test script to create a proper Supabase JWT for testing
import jwt from 'https://esm.sh/jsonwebtoken@9.0.2'

// Your JWT secret is derived from your project's JWT secret
// For testing, we can use the anon key as a JWT
const anonKey = 'sb_publishable_8V8eSchBP0mKg6rO9G7iAg_pgGJ_LLn'
const serviceKey = 'sb_secret_tKb_U7kmzXyvQOqR1C-lUA_P9vu3Qc6'

console.log('Testing Supabase JWT authentication...')
console.log('Anon Key:', anonKey)
console.log('Service Role Key:', serviceKey)

// The keys themselves should work as JWTs for Edge Functions
// Let's test the format by making a request using fetch

async function testAuth() {
  try {
    // Test with anon key
    console.log('\n--- Testing with Anon Key ---')
    const response1 = await fetch('https://iczyxjklymjtpalfnvka.supabase.co/functions/v1/hello-test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'AnonUser' })
    })
    
    console.log('Status:', response1.status)
    console.log('Response:', await response1.text())
    
    // Test with service role key
    console.log('\n--- Testing with Service Role Key ---')
    const response2 = await fetch('https://iczyxjklymjtpalfnvka.supabase.co/functions/v1/hello-test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'ServiceUser' })
    })
    
    console.log('Status:', response2.status)
    console.log('Response:', await response2.text())
    
  } catch (error) {
    console.error('Error:', error.message)
  }
}

testAuth()