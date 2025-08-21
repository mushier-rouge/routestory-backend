import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types for the route generation request and response
interface RouteRequest {
  start_location: {
    address?: string;
    coordinates?: [number, number]; // [latitude, longitude]
  };
  end_location: {
    address?: string;
    coordinates?: [number, number];
  };
  preferences: {
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

interface MapKitRoute {
  route_id: string;
  status: 'processing' | 'completed' | 'failed';
  route: {
    coordinates: number[][]; // [[lat, lng], ...]
    total_distance_meters: number;
    estimated_time_seconds: number;
    time_increase_percent: number;
    baseline_time_seconds: number;
    instructions: Array<{
      instruction: string;
      distance_meters: number;
      coordinate: [number, number];
      maneuver_type: string;
    }>;
    waypoints: Array<{
      coordinate: [number, number];
      name: string;
      type: string;
    }>;
  };
  stories: Array<{
    id: string;
    title: string;
    trigger_location: {
      latitude: number;
      longitude: number;
    };
    trigger_radius_meters: number;
    audio_url?: string;
    duration_seconds?: number;
    category: string;
    priority: number;
    route_coordinate_index?: number;
    estimated_trigger_time?: number;
  }>;
  metadata: {
    total_stories: number;
    generation_time_seconds: number;
    cache_expires_utc: string;
    coordinate_precision: number;
  };
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Parse request body
    const requestData: RouteRequest = await req.json();
    
    // Validate required fields
    if (!requestData.start_location || !requestData.end_location) {
      return new Response(JSON.stringify({
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'start_location and end_location are required',
          details: { required_fields: ['start_location', 'end_location'] }
        }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate unique route ID
    const routeId = crypto.randomUUID();

    // Convert addresses to coordinates if needed
    const startCoords = await getCoordinates(requestData.start_location);
    const endCoords = await getCoordinates(requestData.end_location);
    
    if (!startCoords || !endCoords) {
      return new Response(JSON.stringify({
        error: {
          code: 'GEOCODING_FAILED',
          message: 'Unable to geocode start or end location',
          details: { suggestion: 'Provide valid addresses or coordinates' }
        }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Store route in database with processing status
    const { error: insertError } = await supabase
      .from('routes')
      .insert({
        id: routeId,
        start_location: `POINT(${startCoords[1]} ${startCoords[0]})`, // PostGIS format: lng lat
        end_location: `POINT(${endCoords[1]} ${endCoords[0]})`,
        route_path: 'LINESTRING EMPTY', // Will be updated after route calculation
        preferences: requestData.preferences || {},
        status: 'processing',
        generation_progress: 10
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      return new Response(JSON.stringify({
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to create route record'
        }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate scenic route with Google Maps API
    const routeData = await calculateScenicRoute(
      startCoords, 
      endCoords, 
      requestData.preferences || {}
    );

    if (!routeData.success) {
      // Update route status to failed
      await supabase
        .from('routes')
        .update({ status: 'failed', generation_progress: 0 })
        .eq('id', routeId);

      return new Response(JSON.stringify({
        error: {
          code: 'ROUTE_GENERATION_FAILED',
          message: routeData.error || 'Unable to generate route',
          details: { 
            reason: 'No viable route found with specified parameters',
            suggestions: ['Check start/end locations', 'Increase max_time_increase_percent']
          }
        }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update progress
    await supabase
      .from('routes')
      .update({ generation_progress: 40 })
      .eq('id', routeId);

    // Discover POIs near the route
    const poisData = await discoverPOIsNearRoute(routeData.route_path, routeData.coordinates);
    
    // Update progress  
    await supabase
      .from('routes')
      .update({ generation_progress: 70 })
      .eq('id', routeId);

    // Generate stories for discovered POIs (async - trigger content generation function)
    const stories = await generateStoriesForPOIs(routeId, poisData, supabase);

    // Update route with final data
    const { error: updateError } = await supabase
      .from('routes')
      .update({
        route_path: `LINESTRING(${routeData.coordinates.map(coord => `${coord[1]} ${coord[0]}`).join(',')})`,
        total_distance_meters: routeData.total_distance_meters,
        estimated_time_seconds: routeData.estimated_time_seconds,
        baseline_time_seconds: routeData.baseline_time_seconds,
        time_increase_percent: routeData.time_increase_percent,
        status: 'completed',
        generation_progress: 100,
        cache_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      })
      .eq('id', routeId);

    if (updateError) {
      console.error('Route update error:', updateError);
    }

    const generationTime = (Date.now() - startTime) / 1000;

    // Build MapKit-compatible response
    const response: MapKitRoute = {
      route_id: routeId,
      status: 'completed',
      route: {
        coordinates: routeData.coordinates, // [[lat, lng], ...]
        total_distance_meters: routeData.total_distance_meters,
        estimated_time_seconds: routeData.estimated_time_seconds,
        time_increase_percent: routeData.time_increase_percent,
        baseline_time_seconds: routeData.baseline_time_seconds,
        instructions: routeData.instructions,
        waypoints: routeData.waypoints
      },
      stories: stories,
      metadata: {
        total_stories: stories.length,
        generation_time_seconds: generationTime,
        cache_expires_utc: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        coordinate_precision: 6
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Route generation error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during route generation'
      }
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Helper function to convert address to coordinates or validate coordinates
async function getCoordinates(location: { address?: string; coordinates?: [number, number] }): Promise<[number, number] | null> {
  if (location.coordinates) {
    // Validate coordinates format [latitude, longitude]
    const [lat, lng] = location.coordinates;
    if (typeof lat === 'number' && typeof lng === 'number' && 
        lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [lat, lng];
    }
  }
  
  if (location.address) {
    // Use Google Geocoding API
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      console.error('Google Maps API key not found');
      return null;
    }

    try {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location.address)}&key=${apiKey}`;
      const response = await fetch(geocodeUrl);
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        return [lat, lng];
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
  }
  
  return null;
}

// Calculate scenic route using Google Maps with POI waypoints
async function calculateScenicRoute(
  startCoords: [number, number], 
  endCoords: [number, number], 
  preferences: any
): Promise<any> {
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) {
    return { success: false, error: 'Google Maps API key not configured' };
  }

  try {
    // First, calculate baseline route
    const baselineUrl = `https://maps.googleapis.com/maps/api/directions/json?` +
      `origin=${startCoords[0]},${startCoords[1]}&` +
      `destination=${endCoords[0]},${endCoords[1]}&` +
      `key=${apiKey}`;

    const baselineResponse = await fetch(baselineUrl);
    const baselineData = await baselineResponse.json();

    if (baselineData.status !== 'OK' || !baselineData.routes.length) {
      return { success: false, error: 'No baseline route found' };
    }

    const baselineRoute = baselineData.routes[0];
    const baselineTime = baselineRoute.legs[0].duration.value;
    const baselineDistance = baselineRoute.legs[0].distance.value;

    // Decode polyline to coordinates for MapKit
    const coordinates = decodePolyline(baselineRoute.overview_polyline.points);
    
    // Convert Google instructions to MapKit format
    const instructions = convertGoogleInstructionsToMapKit(baselineRoute.legs[0].steps);

    // For MVP, return baseline route (POI discovery will be handled separately)
    // In production, this would generate route variants with POI waypoints
    
    return {
      success: true,
      coordinates: coordinates,
      total_distance_meters: baselineDistance,
      estimated_time_seconds: baselineTime,
      baseline_time_seconds: baselineTime,
      time_increase_percent: 0, // MVP: no increase for baseline route
      instructions: instructions,
      waypoints: [], // Will be populated by POI discovery
      route_path: baselineRoute.overview_polyline.points
    };

  } catch (error) {
    console.error('Route calculation error:', error);
    return { success: false, error: 'Route calculation failed' };
  }
}

// Decode Google polyline to coordinate array for MapKit
function decodePolyline(encoded: string): number[][] {
  const coordinates: number[][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lng += deltaLng;

    // Return in [latitude, longitude] format for MapKit
    coordinates.push([lat / 1e5, lng / 1e5]);
  }

  return coordinates;
}

// Convert Google turn instructions to MapKit format
function convertGoogleInstructionsToMapKit(steps: any[]): any[] {
  return steps.map(step => ({
    instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Strip HTML tags
    distance_meters: step.distance.value,
    coordinate: [step.start_location.lat, step.start_location.lng],
    maneuver_type: mapGoogleManeuverToMapKit(step.maneuver || 'straight')
  }));
}

// Map Google maneuver types to MapKit compatible types
function mapGoogleManeuverToMapKit(googleManeuver: string): string {
  const maneuverMap: { [key: string]: string } = {
    'turn-left': 'turn_left',
    'turn-right': 'turn_right',
    'turn-sharp-left': 'turn_sharp_left',
    'turn-sharp-right': 'turn_sharp_right',
    'turn-slight-left': 'turn_slight_left',
    'turn-slight-right': 'turn_slight_right',
    'straight': 'continue_straight',
    'uturn-left': 'u_turn',
    'uturn-right': 'u_turn',
    'merge': 'merge',
    'fork-left': 'fork_left',
    'fork-right': 'fork_right',
    'keep-left': 'keep_left',
    'keep-right': 'keep_right',
    'ramp-left': 'ramp_left',
    'ramp-right': 'ramp_right'
  };
  
  return maneuverMap[googleManeuver] || 'continue_straight';
}

// Discover POIs near the calculated route
async function discoverPOIsNearRoute(routePath: string, coordinates: number[][]): Promise<any[]> {
  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY') || Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) {
    console.error('Google Places API key not found');
    return [];
  }

  const discoveredPOIs: any[] = [];
  const searchRadius = 5000; // 5km radius
  const maxPOIsPerSearch = 10;

  // Search along the route at intervals
  const searchInterval = Math.max(1, Math.floor(coordinates.length / 5)); // Search at 5 points along route
  
  for (let i = 0; i < coordinates.length; i += searchInterval) {
    const [lat, lng] = coordinates[i];
    
    try {
      // Search for tourist attractions, museums, landmarks
      const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
        `location=${lat},${lng}&` +
        `radius=${searchRadius}&` +
        `type=tourist_attraction&` +
        `key=${apiKey}`;

      const response = await fetch(placesUrl);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        // Process and score POIs
        for (const place of data.results.slice(0, maxPOIsPerSearch)) {
          const poi = {
            google_place_id: place.place_id,
            name: place.name,
            location: [place.geometry.location.lat, place.geometry.location.lng],
            poi_type: place.types?.[0] || 'tourist_attraction',
            google_rating: place.rating || 0,
            review_count: place.user_ratings_total || 0,
            popularity_score: calculatePOIScore(
              place.rating || 0,
              place.user_ratings_total || 0,
              place.types?.[0] || 'unknown',
              0 // Distance will be calculated later
            ),
            metadata: {
              google_data: place,
              route_coordinate_index: i
            }
          };
          
          // Check if POI is not already discovered
          const existing = discoveredPOIs.find(p => p.google_place_id === poi.google_place_id);
          if (!existing) {
            discoveredPOIs.push(poi);
          }
        }
      }
      
      // Add small delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`POI search error at ${lat},${lng}:`, error);
    }
  }

  // Sort POIs by popularity score and return top candidates
  return discoveredPOIs
    .sort((a, b) => b.popularity_score - a.popularity_score)
    .slice(0, 8); // Max 8 POIs per route
}

// Calculate POI score based on multiple factors
function calculatePOIScore(
  googleRating: number,
  reviewCount: number,
  poiType: string,
  distanceFromRoute: number
): number {
  // Rating component (25% weight)
  const ratingScore = googleRating > 0 ? (googleRating / 5.0) * 0.25 : 0;
  
  // Review count component (20% weight) - logarithmic scale  
  const popularityScore = reviewCount > 0 ? Math.min(Math.log(reviewCount) / Math.log(1000), 1.0) * 0.20 : 0;
  
  // POI type component (20% weight)
  let typeScore = 0;
  switch (poiType) {
    case 'tourist_attraction': typeScore = 0.20; break;
    case 'museum': typeScore = 0.18; break;
    case 'historical_site': typeScore = 0.16; break;
    case 'landmark': typeScore = 0.15; break;
    case 'park': typeScore = 0.12; break;
    case 'restaurant': typeScore = 0.10; break;
    default: typeScore = 0.08; break;
  }
  
  // Distance penalty (10% weight) - closer is better
  let distanceScore = 0;
  if (distanceFromRoute <= 500) distanceScore = 0.10;
  else if (distanceFromRoute <= 1000) distanceScore = 0.08;
  else if (distanceFromRoute <= 2000) distanceScore = 0.05;
  else distanceScore = 0.02;
  
  // Uniqueness (15%) + historical significance (10%) - default values
  const uniquenessScore = 0.15 * 0.5; // Default medium uniqueness
  const historicalScore = 0.10 * 0.5; // Default medium historical significance
  
  const finalScore = ratingScore + popularityScore + typeScore + distanceScore + uniquenessScore + historicalScore;
  return Math.round(finalScore * 100); // Return score out of 100
}

// Generate stories for discovered POIs
async function generateStoriesForPOIs(routeId: string, poisData: any[], supabase: any): Promise<any[]> {
  const stories: any[] = [];
  
  if (poisData.length === 0) {
    return stories;
  }

  // For each POI, create a story record and trigger async content generation
  for (let i = 0; i < poisData.length; i++) {
    const poi = poisData[i];
    const storyId = crypto.randomUUID();
    
    try {
      // Store POI in database first
      const { data: poiRecord, error: poiError } = await supabase
        .from('pois')
        .upsert({
          google_place_id: poi.google_place_id,
          name: poi.name,
          location: `POINT(${poi.location[1]} ${poi.location[0]})`, // PostGIS format: lng lat
          poi_type: poi.poi_type,
          google_rating: poi.google_rating,
          review_count: poi.review_count,
          popularity_score: poi.popularity_score,
          metadata: poi.metadata
        }, { 
          onConflict: 'google_place_id',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (poiError) {
        console.error('POI insert error:', poiError);
        continue;
      }

      // Create story record with placeholder content
      const storyData = {
        id: storyId,
        poi_id: poiRecord.id,
        route_id: routeId,
        title: `Story about ${poi.name}`,
        content: 'Content generation in progress...',
        trigger_location: `POINT(${poi.location[1]} ${poi.location[0]})`,
        trigger_radius_meters: 200,
        category: poi.poi_type,
        priority: Math.min(10, Math.max(1, Math.floor(poi.popularity_score / 10))),
        route_coordinate_index: poi.metadata?.route_coordinate_index || 0,
        estimated_trigger_time: (poi.metadata?.route_coordinate_index || 0) * 30 // Rough estimate
      };

      const { error: storyError } = await supabase
        .from('stories')
        .insert(storyData);

      if (storyError) {
        console.error('Story insert error:', storyError);
        continue;
      }

      // Add to response (content will be generated asynchronously)
      stories.push({
        id: storyId,
        title: storyData.title,
        trigger_location: {
          latitude: poi.location[0],
          longitude: poi.location[1]
        },
        trigger_radius_meters: storyData.trigger_radius_meters,
        category: storyData.category,
        priority: storyData.priority,
        route_coordinate_index: storyData.route_coordinate_index,
        estimated_trigger_time: storyData.estimated_trigger_time
      });

      // TODO: Trigger async content generation function
      // This would call the generate-content Edge Function to create the actual story content
      
    } catch (error) {
      console.error(`Error creating story for POI ${poi.name}:`, error);
    }
  }
  
  return stories;
}
