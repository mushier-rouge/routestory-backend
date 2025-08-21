import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ContentGenerationRequest {
  poi_data: {
    id: string;
    name: string;
    address?: string;
    poi_type: string;
    description?: string;
    google_place_id?: string;
    google_rating?: number;
    review_count?: number;
  };
  route_context: {
    route_id: string;
    start_city?: string;
    end_city?: string;
    trip_purpose?: string;
    interests?: string[];
  };
}

interface StoryData {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: number;
  duration_estimate_seconds: number;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const requestData: ContentGenerationRequest = await req.json();
    
    if (!requestData.poi_data || !requestData.route_context) {
      return new Response(JSON.stringify({
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'poi_data and route_context are required'
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

    // Research POI using multiple data sources
    const researchData = await researchPOI(requestData.poi_data);
    
    // Generate story content using Gemini API
    const storyContent = await generateStoryWithGemini(
      requestData.poi_data,
      researchData,
      requestData.route_context
    );

    if (!storyContent.success) {
      return new Response(JSON.stringify({
        error: {
          code: 'CONTENT_GENERATION_FAILED',
          message: storyContent.error || 'Failed to generate story content'
        }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Store story in database
    const storyRecord = {
      id: crypto.randomUUID(),
      poi_id: requestData.poi_data.id,
      route_id: requestData.route_context.route_id,
      title: storyContent.title,
      content: storyContent.content,
      category: storyContent.category,
      priority: storyContent.priority,
      trigger_location: `POINT(0 0)`, // Will be set by calling function
      generation_metadata: {
        research_sources: researchData.sources,
        word_count: storyContent.word_count,
        generation_timestamp: new Date().toISOString(),
        model_used: 'gemini-2.5-flash'
      }
    };

    const { data: insertedStory, error: insertError } = await supabase
      .from('stories')
      .insert(storyRecord)
      .select()
      .single();

    if (insertError) {
      console.error('Story insert error:', insertError);
      return new Response(JSON.stringify({
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to store generated story'
        }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Trigger audio generation asynchronously
    await triggerAudioGeneration(insertedStory.id, storyContent.content);

    const response: StoryData = {
      id: insertedStory.id,
      title: storyContent.title,
      content: storyContent.content,
      category: storyContent.category,
      priority: storyContent.priority,
      duration_estimate_seconds: Math.round(storyContent.word_count * 0.4) // ~150 words per minute
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Content generation error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during content generation'
      }
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Research POI using multiple data sources
async function researchPOI(poiData: any): Promise<any> {
  const research = {
    sources: [],
    historical_data: {},
    current_info: {},
    interesting_facts: []
  };

  try {
    // Research using Wikipedia API
    const wikipediaData = await searchWikipedia(poiData.name);
    if (wikipediaData) {
      research.sources.push('wikipedia');
      research.historical_data = wikipediaData;
    }

    // Get additional details from Google Places if place_id exists
    if (poiData.google_place_id) {
      const placeDetails = await getGooglePlaceDetails(poiData.google_place_id);
      if (placeDetails) {
        research.sources.push('google_places');
        research.current_info = placeDetails;
      }
    }

    return research;
  } catch (error) {
    console.error('Research error:', error);
    return { sources: [], historical_data: {}, current_info: {}, interesting_facts: [] };
  }
}

// Search Wikipedia for POI information
async function searchWikipedia(poiName: string): Promise<any> {
  try {
    // Search for Wikipedia page
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(poiName)}`;
    const response = await fetch(searchUrl);
    
    if (response.ok) {
      const data = await response.json();
      return {
        title: data.title,
        extract: data.extract,
        description: data.description,
        page_url: data.content_urls?.desktop?.page
      };
    }
  } catch (error) {
    console.error('Wikipedia search error:', error);
  }
  return null;
}

// Get additional details from Google Places API
async function getGooglePlaceDetails(placeId: string): Promise<any> {
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) return null;

  try {
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,rating,user_ratings_total,reviews,opening_hours,website,formatted_phone_number,types&key=${apiKey}`;
    const response = await fetch(detailsUrl);
    const data = await response.json();
    
    if (data.status === 'OK') {
      return data.result;
    }
  } catch (error) {
    console.error('Google Places details error:', error);
  }
  return null;
}

// Generate story content using Google Gemini API
async function generateStoryWithGemini(poiData: any, researchData: any, routeContext: any): Promise<any> {
  const apiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
  if (!apiKey) {
    return { success: false, error: 'Google Gemini API key not configured' };
  }

  try {
    const prompt = buildStoryPrompt(poiData, researchData, routeContext);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 512,
        }
      })
    });

    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0) {
      const generatedText = data.candidates[0].content.parts[0].text;
      
      // Parse the generated content
      const storyData = parseGeneratedStory(generatedText, poiData);
      
      return {
        success: true,
        ...storyData
      };
    } else {
      return { success: false, error: 'No content generated' };
    }

  } catch (error) {
    console.error('Gemini API error:', error);
    return { success: false, error: 'Content generation failed' };
  }
}

// Build context-aware prompt for story generation
function buildStoryPrompt(poiData: any, researchData: any, routeContext: any): string {
  const contextInfo = researchData.historical_data?.extract || 
                     researchData.current_info?.name || 
                     poiData.description || '';

  return `Generate an engaging 60-90 second story about ${poiData.name} for drivers passing this location.

Context:
- Location: ${poiData.name} at ${poiData.address || 'unknown address'}
- Driver route: From ${routeContext.start_city || 'starting point'} to ${routeContext.end_city || 'destination'}
- POI type: ${poiData.poi_type}
- Current date: ${new Date().toLocaleDateString()}
- Additional research: ${contextInfo}

Requirements:
- Length: 150-250 words for natural speech (60-90 seconds when spoken)
- Style: Conversational, engaging, informative
- Audience: General public, family-friendly
- Focus: Most interesting facts and stories about this location
- Avoid: Complex statistics, visual references, lengthy descriptions
- Include: Historical context, current relevance, surprising or little-known details

Format your response as:
TITLE: [Compelling title for the story]
CATEGORY: [history/architecture/culture/nature/technology]
PRIORITY: [1-10, where 10 is most interesting]
CONTENT: [The story text only, no headers or metadata]

Generate the story:`;
}

// Parse the generated story content
function parseGeneratedStory(generatedText: string, poiData: any): any {
  const lines = generatedText.split('\n').filter(line => line.trim());
  
  let title = poiData.name;
  let category = 'general';
  let priority = 5;
  let content = generatedText;
  
  for (const line of lines) {
    if (line.startsWith('TITLE:')) {
      title = line.substring(6).trim();
    } else if (line.startsWith('CATEGORY:')) {
      category = line.substring(9).trim();
    } else if (line.startsWith('PRIORITY:')) {
      const priorityMatch = line.match(/\d+/);
      if (priorityMatch) {
        priority = Math.min(10, Math.max(1, parseInt(priorityMatch[0])));
      }
    } else if (line.startsWith('CONTENT:')) {
      const contentIndex = generatedText.indexOf('CONTENT:');
      if (contentIndex !== -1) {
        content = generatedText.substring(contentIndex + 8).trim();
      }
    }
  }
  
  // Clean up content
  content = content.replace(/^CONTENT:\s*/i, '').trim();
  
  const words = content.split(/\s+/).length;
  
  return {
    title,
    content,
    category,
    priority,
    word_count: words
  };
}

// Trigger audio generation for the story
async function triggerAudioGeneration(storyId: string, content: string): Promise<void> {
  try {
    const audioRequest = {
      story_id: storyId,
      content: content,
      voice_settings: {
        speed: 'normal',
        voice_id: 'default'
      }
    };

    // Call the generate-audio function asynchronously
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify(audioRequest)
    });

    if (!response.ok) {
      console.error('Audio generation trigger failed:', await response.text());
    }
  } catch (error) {
    console.error('Audio generation trigger error:', error);
  }
}
