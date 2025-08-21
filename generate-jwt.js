// Generate a proper JWT for testing Supabase Edge Functions
import jwt from 'https://esm.sh/jsonwebtoken@9.0.2'

const JWT_SECRET = 'c0kkdpnuxxXydfKQVdMJKF/dgRU/JJqijh8PbOGVJbSSzMRx/jkpHveX713olIF7cbgDtSnrycQfI13D7xY8yw=='

// Create a JWT payload for anonymous user
const anonPayload = {
  aud: 'authenticated',
  exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
  iat: Math.floor(Date.now() / 1000),
  iss: 'supabase',
  role: 'anon',
  sub: 'anon-user-id'
}

// Create a JWT payload for service role
const servicePayload = {
  aud: 'authenticated', 
  exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
  iat: Math.floor(Date.now() / 1000),
  iss: 'supabase',
  role: 'service_role',
  sub: 'service-role-user'
}

try {
  const anonJWT = jwt.sign(anonPayload, JWT_SECRET, { algorithm: 'HS256' })
  const serviceJWT = jwt.sign(servicePayload, JWT_SECRET, { algorithm: 'HS256' })
  
  console.log('🔑 Generated JWTs for testing:')
  console.log('\n📱 Anon JWT (for client apps):')
  console.log(anonJWT)
  console.log('\n🔧 Service Role JWT (for server operations):')
  console.log(serviceJWT)
  
  console.log('\n🧪 Test commands:')
  console.log('\n# Test with Anon JWT:')
  console.log(`curl -X POST "https://iczyxjklymjtpalfnvka.supabase.co/functions/v1/hello-test" \\
  -H "Authorization: Bearer ${anonJWT}" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "AnonUser"}'`)
  
  console.log('\n# Test with Service Role JWT:')
  console.log(`curl -X POST "https://iczyxjklymjtpalfnvka.supabase.co/functions/v1/hello-test" \\
  -H "Authorization: Bearer ${serviceJWT}" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "ServiceUser"}'`)
  
} catch (error) {
  console.error('❌ Error generating JWT:', error.message)
}