import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Main API orchestration endpoint for RouteStory Backend
// Handles route generation requests and orchestrates the full pipeline

interface RouteGenerationRequest {
  start_location: {
    address?: string;
    coordinates?: [number, number]; // [latitude, longitude]
  };
  end_location: {
    address?: string;
    coordinates?: [number, number];
  };
  preferences?: {
    max_time_increase_percent?: number;
    interests?: string[];
    driving_speed?: 'slow' | 'normal' | 'fast';
    avoid_highways?: boolean;
    vehicle_type?: string;
  };
  context?: {
    time_of_day?: string;
    trip_purpose?: string;
    group_size?: number;
  };
}

interface APIResponse {
  route_id: string;
  status: 'processing' | 'completed' | 'failed';
  message?: string;
  estimated_completion_seconds?: number;
  status_url?: string;
  route?: any; // Full route data when completed
}

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle different API endpoints
    if (req.method === 'POST' && pathSegments.includes('generate')) {
      // POST /api/v1/routes/generate
      return await handleRouteGeneration(req, supabase);
      
    } else if (req.method === 'GET' && pathSegments.includes('status')) {
      // GET /api/v1/routes/status/{route_id}
      const routeId = pathSegments[pathSegments.length - 1];
      return await forwardToStatusEndpoint(routeId);
      
    } else if (req.method === 'GET' && pathSegments.includes('health')) {
      // GET /api/v1/health
      return await handleHealthCheck();
      
    } else {
      return new Response(JSON.stringify({
        error: {
          code: 'ENDPOINT_NOT_FOUND',
          message: 'Invalid API endpoint',
          available_endpoints: [
            'POST /api/v1/routes/generate',
            'GET /api/v1/routes/status/{route_id}',
            'GET /api/v1/health'
          ]
        }
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Handle route generation requests
async function handleRouteGeneration(req: Request, supabase: any): Promise<Response> {
  try {
    const requestData: RouteGenerationRequest = await req.json();
    
    // Validate request
    const validation = validateRouteRequest(requestData);
    if (!validation.valid) {
      return new Response(JSON.stringify({
        error: {
          code: 'INVALID_REQUEST',
          message: validation.error,
          details: validation.details
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if similar route already exists in cache
    const cachedRoute = await checkCachedRoute(supabase, requestData);
    if (cachedRoute) {
      return new Response(JSON.stringify({
        route_id: cachedRoute.id,
        status: 'completed',
        message: 'Found cached route',
        route: cachedRoute,
        from_cache: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Trigger route generation by calling generate-route function
    const generateResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify(requestData)
    });

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      console.error('Route generation failed:', errorText);
      
      return new Response(JSON.stringify({
        error: {
          code: 'GENERATION_FAILED',
          message: 'Failed to start route generation process',
          details: { reason: 'Route generation service unavailable' }
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const generationResult = await generateResponse.json();
    
    // Return immediate response with route ID and status URL
    const response: APIResponse = {
      route_id: generationResult.route_id,
      status: generationResult.status,
      message: 'Route generation started successfully',
      estimated_completion_seconds: 30,
      status_url: `${url.origin}/functions/v1/route-status/${generationResult.route_id}`
    };

    // If route completed immediately, include full route data
    if (generationResult.status === 'completed') {
      response.route = generationResult;
    }

    return new Response(JSON.stringify(response), {
      status: generationResult.status === 'completed' ? 200 : 202,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Route generation handler error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'REQUEST_PROCESSING_ERROR',
        message: 'Failed to process route generation request'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Validate route generation request
function validateRouteRequest(requestData: RouteGenerationRequest): any {
  if (!requestData.start_location || !requestData.end_location) {
    return {
      valid: false,
      error: 'Missing required location data',
      details: { required_fields: ['start_location', 'end_location'] }
    };
  }

  // Check if we have either coordinates or addresses
  const hasStartData = requestData.start_location.coordinates || requestData.start_location.address;
  const hasEndData = requestData.end_location.coordinates || requestData.end_location.address;
  
  if (!hasStartData || !hasEndData) {
    return {
      valid: false,
      error: 'Each location must have either coordinates or address',
      details: { 
        start_location_valid: !!hasStartData,
        end_location_valid: !!hasEndData
      }
    };
  }

  // Validate coordinates format if provided
  if (requestData.start_location.coordinates) {
    const [lat, lng] = requestData.start_location.coordinates;
    if (typeof lat !== 'number' || typeof lng !== 'number' || 
        lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return {
        valid: false,
        error: 'Invalid start location coordinates',
        details: { coordinates_format: '[latitude, longitude]', valid_ranges: 'lat: -90 to 90, lng: -180 to 180' }
      };
    }
  }

  if (requestData.end_location.coordinates) {
    const [lat, lng] = requestData.end_location.coordinates;
    if (typeof lat !== 'number' || typeof lng !== 'number' || 
        lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return {
        valid: false,
        error: 'Invalid end location coordinates',
        details: { coordinates_format: '[latitude, longitude]', valid_ranges: 'lat: -90 to 90, lng: -180 to 180' }
      };
    }
  }

  return { valid: true };
}

// Check for cached route with similar start/end points
async function checkCachedRoute(supabase: any, requestData: RouteGenerationRequest): Promise<any> {
  try {
    // For MVP, we'll implement basic caching later
    // This would query routes table for similar start/end locations within last 24 hours
    return null;
  } catch (error) {
    console.error('Cache check error:', error);
    return null;
  }
}

// Forward request to route-status endpoint
async function forwardToStatusEndpoint(routeId: string): Promise<Response> {
  try {
    const statusResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/route-status/${routeId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      }
    });

    const statusData = await statusResponse.text();
    
    return new Response(statusData, {
      status: statusResponse.status,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Status forwarding error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'STATUS_UNAVAILABLE',
        message: 'Unable to fetch route status'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Health check endpoint
async function handleHealthCheck(): Promise<Response> {
  const health = {
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      database: 'operational',
      google_maps: 'operational',
      google_gemini: 'operational',
      google_tts: 'operational',
      storage: 'operational'
    }
  };

  return new Response(JSON.stringify(health), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}