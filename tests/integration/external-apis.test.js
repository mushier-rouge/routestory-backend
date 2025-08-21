// External API integration tests
const fetch = require('node-fetch');
const nock = require('nock');

describe('External API Integration Tests', () => {
  const {
    googleMapsApiKey,
    googleGeminiApiKey
  } = global.testConfig;

  // Skip tests if API keys are not configured
  const skipGoogleMaps = !googleMapsApiKey || googleMapsApiKey === 'your_google_maps_api_key';
  const skipGemini = !googleGeminiApiKey || googleGeminiApiKey === 'your_google_gemini_api_key';

  describe('Google Maps API Integration', () => {
    beforeAll(() => {
      if (skipGoogleMaps) {
        console.log('⚠️  Skipping Google Maps tests - API key not configured');
      }
    });

    test('should geocode address successfully', async () => {
      if (skipGoogleMaps) return;

      const address = "Palo Alto, CA";
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleMapsApiKey}`;
      
      const response = await fetch(url);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.status).toBe('OK');
      expect(data.results).toBeDefined();
      expect(data.results.length).toBeGreaterThan(0);
      
      const result = data.results[0];
      expect(result.geometry).toBeDefined();
      expect(result.geometry.location).toBeDefined();
      expect(typeof result.geometry.location.lat).toBe('number');
      expect(typeof result.geometry.location.lng).toBe('number');
    }, 10000);

    test('should get directions between two points', async () => {
      if (skipGoogleMaps) return;

      const origin = "Palo Alto, CA";
      const destination = "Sunnyvale, CA";
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${googleMapsApiKey}`;
      
      const response = await fetch(url);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.status).toBe('OK');
      expect(data.routes).toBeDefined();
      expect(data.routes.length).toBeGreaterThan(0);
      
      const route = data.routes[0];
      expect(route.legs).toBeDefined();
      expect(route.legs.length).toBeGreaterThan(0);
      expect(route.overview_polyline).toBeDefined();
      expect(route.overview_polyline.points).toBeDefined();
    }, 10000);

    test('should find nearby places', async () => {
      if (skipGoogleMaps) return;

      const location = "37.4419,-122.1430"; // Palo Alto
      const radius = 5000;
      const type = "tourist_attraction";
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location}&radius=${radius}&type=${type}&key=${googleMapsApiKey}`;
      
      const response = await fetch(url);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.status).toBe('OK');
      expect(data.results).toBeDefined();
      expect(Array.isArray(data.results)).toBe(true);
      
      if (data.results.length > 0) {
        const place = data.results[0];
        expect(place.place_id).toBeDefined();
        expect(place.name).toBeDefined();
        expect(place.geometry).toBeDefined();
        expect(place.geometry.location).toBeDefined();
      }
    }, 10000);

    test('should get place details', async () => {
      if (skipGoogleMaps) return;

      // First get a place ID from nearby search
      const location = "37.4419,-122.1430";
      const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location}&radius=5000&type=restaurant&key=${googleMapsApiKey}`;
      
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();
      
      if (searchData.results.length === 0) {
        console.log('No places found for details test');
        return;
      }

      const placeId = searchData.results[0].place_id;
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,rating,user_ratings_total,reviews&key=${googleMapsApiKey}`;
      
      const response = await fetch(detailsUrl);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.status).toBe('OK');
      expect(data.result).toBeDefined();
      expect(data.result.name).toBeDefined();
    }, 15000);

    test('should handle invalid geocoding requests gracefully', async () => {
      if (skipGoogleMaps) return;

      const invalidAddress = "ThisIsNotARealAddressAnywhere12345";
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(invalidAddress)}&key=${googleMapsApiKey}`;
      
      const response = await fetch(url);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.status).toBe('ZERO_RESULTS');
      expect(data.results.length).toBe(0);
    }, 10000);

    test('should respect API rate limits', async () => {
      if (skipGoogleMaps) return;

      // Test multiple requests in succession
      const requests = [];
      for (let i = 0; i < 5; i++) {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=Test+${i}&key=${googleMapsApiKey}`;
        requests.push(fetch(url));
      }
      
      const responses = await Promise.all(requests);
      
      // All requests should either succeed or return appropriate rate limit status
      for (const response of responses) {
        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(['OK', 'ZERO_RESULTS', 'OVER_QUERY_LIMIT']).toContain(data.status);
      }
    }, 20000);
  });

  describe('Google Gemini API Integration', () => {
    beforeAll(() => {
      if (skipGemini) {
        console.log('⚠️  Skipping Gemini tests - API key not configured');
      }
    });

    test('should generate content successfully', async () => {
      if (skipGemini) return;

      const prompt = "Write a short 50-word story about Stanford University for travelers passing by.";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleGeminiApiKey}`;
      
      const response = await fetch(url, {
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
            maxOutputTokens: 200,
          }
        })
      });

      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.candidates).toBeDefined();
      expect(data.candidates.length).toBeGreaterThan(0);
      expect(data.candidates[0].content).toBeDefined();
      expect(data.candidates[0].content.parts).toBeDefined();
      expect(data.candidates[0].content.parts[0].text).toBeDefined();
      
      const generatedText = data.candidates[0].content.parts[0].text;
      expect(typeof generatedText).toBe('string');
      expect(generatedText.length).toBeGreaterThan(0);
    }, 15000);

    test('should handle different temperature settings', async () => {
      if (skipGemini) return;

      const prompt = "Describe a landmark in one sentence.";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleGeminiApiKey}`;
      
      // Test with low temperature (more deterministic)
      const lowTempResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 100,
          }
        })
      });

      expect(lowTempResponse.ok).toBe(true);
      
      const lowTempData = await lowTempResponse.json();
      expect(lowTempData.candidates).toBeDefined();
      expect(lowTempData.candidates[0].content.parts[0].text).toBeDefined();
    }, 15000);

    test('should handle content generation errors gracefully', async () => {
      if (skipGemini) return;

      const invalidPrompt = ""; // Empty prompt
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleGeminiApiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: invalidPrompt
            }]
          }]
        })
      });

      // Should handle gracefully - either success with empty content or proper error
      if (response.ok) {
        const data = await response.json();
        // If successful, should have some response structure
        expect(data).toBeDefined();
      } else {
        // If error, should be proper HTTP error
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    }, 10000);

    test('should respect token limits', async () => {
      if (skipGemini) return;

      const longPrompt = "Write a very detailed story. ".repeat(100); // Very long prompt
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleGeminiApiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: longPrompt }] }],
          generationConfig: {
            maxOutputTokens: 50, // Very small limit
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.candidates && data.candidates[0]) {
          const text = data.candidates[0].content.parts[0].text;
          // Should be truncated due to token limit
          expect(text.split(' ').length).toBeLessThanOrEqual(100);
        }
      }
    }, 10000);
  });

  describe('Google Cloud Text-to-Speech API Integration', () => {
    test('should list available voices', async () => {
      if (skipGoogleMaps) return; // Using same API key

      const url = `https://texttospeech.googleapis.com/v1/voices?key=${googleMapsApiKey}`;
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        expect(data.voices).toBeDefined();
        expect(Array.isArray(data.voices)).toBe(true);
        expect(data.voices.length).toBeGreaterThan(0);
        
        const voice = data.voices[0];
        expect(voice.languageCodes).toBeDefined();
        expect(voice.name).toBeDefined();
        expect(voice.ssmlGender).toBeDefined();
      } else {
        // TTS API might not be enabled, which is expected in test environment
        console.log('TTS API not enabled or configured');
      }
    }, 10000);

    test('should synthesize speech from text', async () => {
      if (skipGoogleMaps) return;

      const text = "Hello, this is a test of the text to speech API.";
      const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleMapsApiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text: text },
          voice: {
            languageCode: 'en-US',
            ssmlGender: 'NEUTRAL'
          },
          audioConfig: {
            audioEncoding: 'MP3'
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        expect(data.audioContent).toBeDefined();
        expect(typeof data.audioContent).toBe('string');
        
        // Should be base64 encoded audio
        expect(data.audioContent.length).toBeGreaterThan(0);
      } else {
        console.log('TTS synthesis not available in test environment');
      }
    }, 15000);
  });

  describe('Wikipedia API Integration', () => {
    test('should fetch page summary', async () => {
      const title = "Stanford University";
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      
      const response = await fetch(url);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.title).toBeDefined();
      expect(data.extract).toBeDefined();
      expect(typeof data.extract).toBe('string');
      expect(data.extract.length).toBeGreaterThan(0);
    }, 10000);

    test('should handle non-existent pages gracefully', async () => {
      const invalidTitle = "ThisPageDoesNotExistOnWikipedia12345";
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(invalidTitle)}`;
      
      const response = await fetch(url);
      expect(response.status).toBe(404);
    }, 10000);

    test('should fetch multiple page summaries', async () => {
      const titles = ["Stanford University", "Palo Alto", "Silicon Valley"];
      const requests = titles.map(title => 
        fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
      );
      
      const responses = await Promise.all(requests);
      
      for (const response of responses) {
        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(data.title).toBeDefined();
        expect(data.extract).toBeDefined();
      }
    }, 15000);
  });

  describe('API Error Handling and Resilience', () => {
    test('should handle network timeouts gracefully', async () => {
      // Mock slow API response
      nock('https://httpstat.us')
        .get('/200?sleep=5000')
        .delay(6000)
        .reply(200, 'OK');

      try {
        const response = await fetch('https://httpstat.us/200?sleep=5000', {
          timeout: 3000 // 3 second timeout
        });
        // If it doesn't timeout, that's fine too
      } catch (error) {
        // Should handle timeout gracefully
        expect(error.message).toMatch(/timeout|aborted/i);
      }
    });

    test('should handle API rate limiting', async () => {
      // Mock rate limit response
      nock('https://api.example.com')
        .get('/rate-limited')
        .reply(429, {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests'
          }
        });

      const response = await fetch('https://api.example.com/rate-limited');
      expect(response.status).toBe(429);
      
      const data = await response.json();
      expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    test('should handle malformed API responses', async () => {
      // Mock malformed JSON response
      nock('https://api.example.com')
        .get('/malformed')
        .reply(200, 'This is not JSON');

      const response = await fetch('https://api.example.com/malformed');
      expect(response.ok).toBe(true);
      
      try {
        await response.json();
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Should catch JSON parsing error
        expect(error.message).toMatch(/json/i);
      }
    });

    test('should handle API service unavailable', async () => {
      // Mock service unavailable
      nock('https://api.example.com')
        .get('/unavailable')
        .reply(503, {
          error: 'Service temporarily unavailable'
        });

      const response = await fetch('https://api.example.com/unavailable');
      expect(response.status).toBe(503);
    });
  });

  afterEach(() => {
    // Clean up nock mocks
    nock.cleanAll();
  });
});