// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

console.log("🚀 Hello Test Function Initialized!")

Deno.serve(async (req) => {
  console.log("📥 Request received:", req.method, req.url)
  
  try {
    const body = await req.json()
    console.log("📋 Request body:", body)
    
    const name = body.name || "World"
    console.log("👋 Saying hello to:", name)
    
    const data = {
      message: `Hello ${name}!`,
      timestamp: new Date().toISOString(),
      success: true
    }
    
    console.log("✅ Response data:", data)
    
    return new Response(
      JSON.stringify(data),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("❌ Error in hello-test function:", error)
    return new Response(
      JSON.stringify({ error: "Invalid request", message: error.message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/hello-test' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
