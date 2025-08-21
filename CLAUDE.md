# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RouteStory Backend is an MVP system for generating scenic driving routes with location-triggered audio stories. The system integrates maps APIs, LLM content generation, text-to-speech services, and intelligent route optimization.

**Core Request Flow:** Receive start/end coordinates → Generate scenic route → Discover POIs → Generate stories with LLM → Convert to audio → Return route + audio URLs

## Architecture

### Platform: Supabase-Based Stack
- **Database:** PostgreSQL with PostGIS extension for spatial queries
- **Compute:** Supabase Edge Functions (Deno runtime)
- **Storage:** Supabase Storage with global CDN for audio files
- **Real-time:** Built-in subscriptions for route generation status
- **API:** Auto-generated REST API from database schema

### Core Services (Edge Functions)
- **Route Generator Function:** Maps integration and route optimization
- **Content Generator Function:** POI discovery and story generation with LLM
- **Audio Processor Function:** Text-to-speech and audio processing
- **Route Status Function:** Real-time status updates during generation

### Key External APIs
- **Google Maps Platform:** Directions API, Places API, Geocoding API, Roads API
- **Google Gemini:** Primary LLM for content generation
- **Google Cloud Text-to-Speech:** Primary text-to-speech service
- **ElevenLabs API:** Backup TTS provider (if premium voices needed)

## Route Generation Algorithm

**MVP Design Principle:** Single route generation only - no dynamic rerouting
- Generate one high-quality scenic route
- Client handles off-route detection and stops audio
- User can request new route generation if needed

**Route Optimization Steps:**
1. Calculate baseline route using Google Directions API
2. Discover POIs within 2-5km radius using Google Places API
3. Score POIs based on: Google rating (25%), review count (20%), attraction type (20%), uniqueness (15%), distance from route (10%), historical significance (10%)
4. Generate route variants including high-scoring POIs
5. Select route with highest POI score within 15-20% time increase

## Database Schema (PostgreSQL + PostGIS)

### Core Tables
- **routes:** Stores route paths, preferences, generation status with GEOGRAPHY columns
- **stories:** POI-linked audio stories with trigger locations and metadata
- **pois:** Points of interest with spatial indexing and Google Places data

### Spatial Queries
- Use PostGIS functions for geographic calculations
- Spatial indexes on all location columns for performance
- Custom functions like `find_pois_near_route()` for route optimization

## API Design

### Primary Endpoint: Route Generation
```
POST /api/v1/routes/generate
```

**Response Format:** MapKit-compatible structure
- `coordinates`: Array of [latitude, longitude] pairs for route path
- `instructions`: Turn-by-turn directions in MapKit format
- `waypoints`: POI stops with coordinates and names
- `stories`: Audio stories with trigger locations and URLs

### Key Response Requirements
- Coordinate arrays in [latitude, longitude] format (not lng,lat)
- MapKit-compatible turn-by-turn instructions
- Audio URLs from Supabase Storage with CDN delivery
- Real-time status updates via Supabase subscriptions

## Content Generation Pipeline

### Story Generation Process
1. Research POI using Wikipedia API and Google Places
2. Generate 60-90 second stories using Gemini API
3. Target 150-250 words for natural speech synthesis
4. Convert to audio using Google Cloud Text-to-Speech
5. Store in Supabase Storage with signed URL access

### Content Quality Requirements
- Family-friendly, conversational tone
- Historical context and surprising details
- Optimized for car audio systems
- 22kHz MP3 format with audio normalization

## Development Workflow

### Testing Strategy
- Unit tests for individual service functionality
- Integration tests for end-to-end route generation
- Load testing for concurrent user scenarios
- External API integration reliability testing

### Performance Targets
- Route generation: < 15 seconds for new routes
- Cached route retrieval: < 2 seconds
- Audio file delivery: < 3 seconds via CDN
- Real-time updates: < 500ms

### Error Handling
- Standard HTTP status codes (200, 202, 400, 401, 429, 500, 503)
- Custom error responses with actionable suggestions
- Automatic retry logic for external API failures
- Real-time error status updates

## Storage Architecture

### Supabase Storage Organization
```
audio-files/
├── stories/[story_id]/
│   ├── main.mp3 (primary audio)
│   ├── fast.mp3 (highway speeds)
│   └── slow.mp3 (city driving)
├── temp/ (processing files)
└── cache/[route_id]/ (route packages)
```

### Caching Strategy
- Route caching for 24-48 hours
- Popular route materialized views
- CDN caching for audio files
- Geographic clustering for cache efficiency

## Security Considerations

### Data Protection
- API key management for client authentication
- Rate limiting per client and endpoint
- Encryption in transit and at rest
- User location data anonymization
- GDPR compliance for EU users

### Audio File Security
- Signed URLs with configurable expiration
- Secure upload from Edge Functions
- Content moderation pipeline for generated stories

## Current Development Status

**Project Phase:** Planning and Architecture Complete
- Detailed technical plan available in `plan.md`
- Architecture decisions documented
- **Next Steps:** Implementation of Supabase Edge Functions and database schema

### Getting Started with Implementation
1. **Initialize Supabase Project:**
   ```bash
   npx supabase init
   supabase start
   ```

2. **Create Database Schema:**
   - Implement PostGIS tables from schema design
   - Set up spatial indexes and custom functions
   - Configure row-level security policies

3. **Develop Edge Functions:**
   ```bash
   supabase functions new generate-route
   supabase functions new generate-content
   supabase functions new generate-audio
   supabase functions new route-status
   ```

4. **Environment Setup:**
   - Configure Google Maps API keys
   - Set up Gemini API access
   - Configure Google Cloud Text-to-Speech API credentials
   - Set up Supabase project keys

### Development Commands (To be implemented)
Once the project structure is created, common commands will include:
- `supabase functions serve` - Local development server
- `supabase functions deploy` - Deploy edge functions
- `supabase db push` - Apply database migrations
- `supabase gen types typescript` - Generate TypeScript types

This backend system prioritizes rapid MVP development using Supabase's built-in features while maintaining a clear migration path to AWS for future scaling needs.