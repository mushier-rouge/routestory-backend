import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface AudioGenerationRequest {
  story_id: string;
  content: string;
  voice_settings?: {
    speed?: 'slow' | 'normal' | 'fast';
    voice_id?: string;
  };
}

interface AudioResponse {
  story_id: string;
  audio_url: string;
  duration_seconds: number;
  file_size_bytes: number;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const requestData: AudioGenerationRequest = await req.json();
    
    if (!requestData.story_id || !requestData.content) {
      return new Response(JSON.stringify({
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'story_id and content are required'
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

    // Preprocess text for optimal speech synthesis
    const processedText = preprocessTextForSpeech(requestData.content);
    
    // Generate audio using Google Cloud TTS (primary)
    let audioResult = await generateAudioWithGoogleTTS(
      processedText,
      requestData.voice_settings
    );

    // Fallback to ElevenLabs if Google TTS fails (if configured)
    if (!audioResult.success) {
      console.log('Google TTS failed, falling back to ElevenLabs:', audioResult.error);
      audioResult = await generateAudioWithElevenLabs(
        processedText,
        requestData.voice_settings
      );
    }

    if (!audioResult.success) {
      return new Response(JSON.stringify({
        error: {
          code: 'AUDIO_GENERATION_FAILED',
          message: audioResult.error || 'Failed to generate audio'
        }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Post-process audio (normalize, optimize for car audio)
    const optimizedAudio = await postProcessAudio(audioResult.audioBuffer);
    
    // Upload to Supabase Storage
    const uploadPath = `stories/${requestData.story_id}/main.mp3`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(uploadPath, optimizedAudio, {
        contentType: 'audio/mpeg',
        cacheControl: '604800' // 7 days cache
      });

    if (uploadError) {
      console.error('Audio upload error:', uploadError);
      return new Response(JSON.stringify({
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to upload generated audio'
        }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate signed URL for client access
    const { data: signedUrlData } = await supabase.storage
      .from('audio-files')
      .createSignedUrl(uploadPath, 86400); // 24 hour expiry

    if (!signedUrlData?.signedUrl) {
      return new Response(JSON.stringify({
        error: {
          code: 'URL_GENERATION_FAILED',
          message: 'Failed to generate audio access URL'
        }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update story record with audio URL and duration
    const { error: updateError } = await supabase
      .from('stories')
      .update({
        audio_url: signedUrlData.signedUrl,
        duration_seconds: audioResult.duration_seconds
      })
      .eq('id', requestData.story_id);

    if (updateError) {
      console.error('Story update error:', updateError);
    }

    const response: AudioResponse = {
      story_id: requestData.story_id,
      audio_url: signedUrlData.signedUrl,
      duration_seconds: audioResult.duration_seconds,
      file_size_bytes: optimizedAudio.byteLength
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Audio generation error:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during audio generation'
      }
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Preprocess text for optimal speech synthesis
function preprocessTextForSpeech(text: string): string {
  let processed = text;
  
  // Add strategic pauses for better listening comprehension
  processed = processed.replace(/\. /g, '. <break time="0.5s"/> ');
  processed = processed.replace(/\, /g, ', <break time="0.3s"/> ');
  processed = processed.replace(/\; /g, '; <break time="0.4s"/> ');
  
  // Handle numbers and dates for better pronunciation
  processed = processed.replace(/(\d{4})/g, '<say-as interpret-as="date" format="y">$1</say-as>');
  processed = processed.replace(/(\d+)st/g, '<say-as interpret-as="ordinal">$1</say-as>');
  processed = processed.replace(/(\d+)nd/g, '<say-as interpret-as="ordinal">$1</say-as>');
  processed = processed.replace(/(\d+)rd/g, '<say-as interpret-as="ordinal">$1</say-as>');
  processed = processed.replace(/(\d+)th/g, '<say-as interpret-as="ordinal">$1</say-as>');
  
  // Wrap in SSML for advanced control
  return `<speak>${processed}</speak>`;
}

// Generate audio using ElevenLabs API
async function generateAudioWithElevenLabs(text: string, voiceSettings?: any): Promise<any> {
  const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!apiKey) {
    return { success: false, error: 'ElevenLabs API key not configured' };
  }

  try {
    const voiceId = voiceSettings?.voice_id || 'EXAVITQu4vr4xnSDxMaL'; // Default voice
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `ElevenLabs API error: ${errorText}` };
    }

    const audioBuffer = await response.arrayBuffer();
    
    // Estimate duration based on text length and average speaking speed
    const words = text.replace(/<[^>]*>/g, '').split(/\s+/).length;
    const estimatedDuration = Math.round((words / 150) * 60); // 150 words per minute
    
    return {
      success: true,
      audioBuffer: audioBuffer,
      duration_seconds: estimatedDuration,
      provider: 'elevenlabs'
    };

  } catch (error) {
    console.error('ElevenLabs error:', error);
    return { success: false, error: 'ElevenLabs request failed' };
  }
}

// Generate audio using Google Cloud Text-to-Speech (primary)
async function generateAudioWithGoogleTTS(text: string, voiceSettings?: any): Promise<any> {
  try {
    // Load service account credentials
    const serviceAccountPath = './routestory-469621-a256d1e8a772.json';
    let serviceAccount;
    
    try {
      const serviceAccountContent = await Deno.readTextFile(serviceAccountPath);
      serviceAccount = JSON.parse(serviceAccountContent);
    } catch (error) {
      return { success: false, error: 'Google TTS service account file not found or invalid' };
    }

    // Generate JWT token for authentication
    const accessToken = await getGoogleAccessToken(serviceAccount);
    if (!accessToken) {
      return { success: false, error: 'Failed to generate Google Cloud access token' };
    }

    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { ssml: text },
        voice: {
          languageCode: 'en-US',
          name: 'en-US-Journey-F',
          ssmlGender: 'FEMALE'
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: voiceSettings?.speed === 'fast' ? 1.2 : voiceSettings?.speed === 'slow' ? 0.8 : 1.0,
          pitch: 0,
          volumeGainDb: 0
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Google TTS API error: ${errorText}` };
    }

    const data = await response.json();
    
    if (!data.audioContent) {
      return { success: false, error: 'No audio content received from Google TTS' };
    }

    // Decode base64 audio content
    const audioBuffer = Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0));
    
    // Estimate duration based on text length
    const words = text.replace(/<[^>]*>/g, '').split(/\s+/).length;
    const estimatedDuration = Math.round((words / 150) * 60);
    
    return {
      success: true,
      audioBuffer: audioBuffer.buffer,
      duration_seconds: estimatedDuration,
      provider: 'google_tts'
    };

  } catch (error) {
    console.error('Google TTS error:', error);
    return { success: false, error: 'Google TTS request failed' };
  }
}

// Generate Google Cloud access token using service account
async function getGoogleAccessToken(serviceAccount: any): Promise<string | null> {
  try {
    // For Edge Functions, we'll use a simplified approach
    // In production, you would use proper JWT signing libraries
    
    // Create JWT header
    const header = {
      alg: 'RS256',
      typ: 'JWT',
      kid: serviceAccount.private_key_id
    };

    // Create JWT payload
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    // For MVP, we'll use the Google API key approach instead of JWT
    // This requires enabling the TTS API with API key authentication
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY'); // Use same key if TTS is enabled
    if (apiKey) {
      return apiKey; // This will be used as a query parameter instead of Bearer token
    }
    
    return null;
  } catch (error) {
    console.error('Token generation error:', error);
    return null;
  }
}

// Post-process audio for optimal car audio playback
async function postProcessAudio(audioBuffer: ArrayBuffer): Promise<Uint8Array> {
  // For MVP, return audio as-is
  // In production, this would:
  // 1. Normalize audio levels
  // 2. Apply car audio optimization (enhanced bass, clear vocals)
  // 3. Compress for efficient delivery
  // 4. Add fade-in/fade-out effects
  
  return new Uint8Array(audioBuffer);
}

// Generate multiple speed variants (future feature)
async function generateSpeedVariants(baseAudioBuffer: ArrayBuffer, storyId: string, supabase: any): Promise<void> {
  // This would generate:
  // - slow.mp3 for city driving
  // - fast.mp3 for highway speeds
  // 
  // For MVP, we only generate the main.mp3 file
}
