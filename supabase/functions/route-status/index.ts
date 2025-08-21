import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RouteStatusResponse {
  route_id: string;
  status: 'processing' | 'completed' | 'failed';
  generation_progress: number;
  estimated_completion_seconds?: number;
  error_message?: string;
  partial_results?: {
    route_calculated: boolean;
    pois_discovered: boolean;
    stories_generated: number;
    audio_generated: number;
  };
}

interface LocationValidationRequest {
  route_id: string;
  current_location: {
    latitude: number;
    longitude: number;
  };
}

interface LocationValidationResponse {
  on_route: boolean;
  distance_from_route_meters: number;
  nearest_point: {
    latitude: number;
    longitude: number;
  };
}

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle different endpoints
    if (req.method === 'GET' && pathSegments.length >= 2) {
      // GET /route-status/{route_id} - Get route generation status
      const routeId = pathSegments[pathSegments.length - 1];
      return await getRouteStatus(supabase, routeId);
      
    } else if (req.method === 'POST' && url.pathname.includes('validate-location')) {
      // POST /route-status/validate-location - Check if location is on route
      const requestData: LocationValidationRequest = await req.json();
      return await validateLocationOnRoute(supabase, requestData);
      
    } else {
      return new Response(JSON.stringify({
        error: {
          code: 'INVALID_ENDPOINT',
          message: 'Invalid endpoint. Use GET /{route_id} or POST /validate-location'
        }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Route status error:', error);
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

// Get route generation status
async function getRouteStatus(supabase: any, routeId: string): Promise<Response> {
  try {
    // Fetch route information
    const { data: route, error: routeError } = await supabase
      .from('routes')
      .select('*')
      .eq('id', routeId)
      .single();

    if (routeError || !route) {
      return new Response(JSON.stringify({
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: 'Route not found'
        }
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get associated stories
    const { data: stories, error: storiesError } = await supabase
      .from('stories')
      .select('id, title, audio_url, duration_seconds')
      .eq('route_id', routeId);

    if (storiesError) {
      console.error('Stories fetch error:', storiesError);
    }

    const storyCount = stories?.length || 0;
    const storiesWithAudio = stories?.filter(story => story.audio_url).length || 0;

    // Calculate estimated completion time for processing routes
    let estimatedCompletion;
    if (route.status === 'processing') {
      const progressRemaining = 100 - route.generation_progress;
      estimatedCompletion = Math.round((progressRemaining / 100) * 30); // Rough estimate: 30 seconds total
    }

    const response: RouteStatusResponse = {
      route_id: routeId,
      status: route.status,
      generation_progress: route.generation_progress,
      estimated_completion_seconds: estimatedCompletion,
      error_message: route.status === 'failed' ? 'Route generation failed' : undefined,
      partial_results: {
        route_calculated: route.generation_progress >= 40,
        pois_discovered: route.generation_progress >= 70,
        stories_generated: storyCount,
        audio_generated: storiesWithAudio
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get route status error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch route status'
      }
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Validate if a location is on the planned route
async function validateLocationOnRoute(
  supabase: any, 
  requestData: LocationValidationRequest
): Promise<Response> {
  try {
    if (!requestData.route_id || !requestData.current_location) {
      return new Response(JSON.stringify({
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'route_id and current_location are required'
        }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { latitude, longitude } = requestData.current_location;

    // Validate coordinates
    if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return new Response(JSON.stringify({
        error: {
          code: 'INVALID_COORDINATES',
          message: 'Invalid latitude or longitude values'
        }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get route path from database
    const { data: route, error: routeError } = await supabase
      .from('routes')
      .select('route_path')
      .eq('id', requestData.route_id)
      .single();

    if (routeError || !route) {
      return new Response(JSON.stringify({
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: 'Route not found'
        }
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use PostGIS function to check if location is on route
    const { data: validationResult, error: validationError } = await supabase
      .rpc('is_location_on_route', {
        check_location: `POINT(${longitude} ${latitude})`,
        route_path: route.route_path,
        max_distance_meters: 200 // 200m tolerance
      });

    if (validationError) {
      console.error('Validation RPC error:', validationError);
      return new Response(JSON.stringify({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Failed to validate location against route'
        }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate distance to route and find nearest point
    const { data: distanceResult, error: distanceError } = await supabase
      .rpc('calculate_distance_to_route', {
        check_location: `POINT(${longitude} ${latitude})`,
        route_path: route.route_path
      });

    const response: LocationValidationResponse = {
      on_route: validationResult === true,
      distance_from_route_meters: distanceResult?.distance || 0,
      nearest_point: {
        latitude: distanceResult?.nearest_lat || latitude,
        longitude: distanceResult?.nearest_lng || longitude
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Location validation error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during location validation'
      }
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
