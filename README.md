# RouteStory Backend

A Supabase-powered backend system that generates scenic driving routes with location-triggered audio stories. Built with Edge Functions, PostGIS, and external APIs for maps, content generation, and text-to-speech.

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Deno](https://deno.land/) (for Edge Functions)

### Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Start Supabase locally:**
   ```bash
   npm run dev
   ```

4. **Apply database migrations:**
   ```bash
   npm run migrate
   ```

5. **Deploy Edge Functions:**
   ```bash
   npm run deploy-functions
   ```

## 🏗️ Architecture

### Core Services
- **Route Generation**: Google Maps integration with MapKit-compatible output
- **Content Generation**: AI-powered story creation using Google Gemini
- **Audio Processing**: Text-to-speech via ElevenLabs/Google TTS
- **Real-time Status**: WebSocket updates for route generation progress

### Database Schema
- **PostGIS-enabled**: Spatial queries for routes and POIs
- **Real-time subscriptions**: Live status updates
- **Optimized indexes**: Fast geographic lookups

## 📡 API Endpoints

### Route Generation
```bash
POST /functions/v1/generate-route
```

**Request:**
```json
{
  "start_location": {
    "address": "Palo Alto, CA",
    "coordinates": [37.4419, -122.1430]
  },
  "end_location": {
    "address": "Sunnyvale, CA",
    "coordinates": [37.3688, -122.0363]
  },
  "preferences": {
    "max_time_increase_percent": 20,
    "interests": ["history", "technology"],
    "driving_speed": "normal"
  }
}
```

**Response:**
```json
{
  "route_id": "uuid-12345",
  "status": "completed",
  "route": {
    "coordinates": [[37.4419, -122.1430], ...],
    "total_distance_meters": 15200,
    "estimated_time_seconds": 1320,
    "instructions": [...],
    "waypoints": [...]
  },
  "stories": [...],
  "metadata": {
    "total_stories": 5,
    "generation_time_seconds": 12.5,
    "cache_expires_utc": "2024-08-21T15:30:00Z"
  }
}
```

### Route Status
```bash
GET /functions/v1/route-status/{route_id}
```

### Location Validation
```bash
POST /functions/v1/route-status/validate-location
```

## 🛠️ Development Commands

```bash
# Start local development
npm run dev

# Deploy all functions
npm run build

# Run database migrations
npm run migrate

# Generate TypeScript types
npm run generate-types

# Format and lint code
npm run format
npm run lint

# Run tests
npm run test
```

## 🌐 Environment Variables

Required API keys:
- `GOOGLE_MAPS_API_KEY` - Google Maps Platform APIs
- `GOOGLE_GEMINI_API_KEY` - Google Gemini for content generation
- `ELEVENLABS_API_KEY` - Primary text-to-speech service
- `GOOGLE_CLOUD_TTS_API_KEY` - Fallback text-to-speech
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` - Database access

## 📊 Performance Targets

- Route generation: < 15 seconds
- Cached routes: < 2 seconds
- Audio delivery: < 3 seconds via CDN
- Real-time updates: < 500ms

## 🔒 Security

- Row Level Security (RLS) enabled
- API key authentication
- Rate limiting per endpoint
- Secure audio file access via signed URLs
- User location data anonymization

## 📁 Project Structure

```
backend/
├── supabase/
│   ├── functions/
│   │   ├── generate-route/       # Main route generation
│   │   ├── generate-content/     # AI story generation
│   │   ├── generate-audio/       # Text-to-speech processing
│   │   └── route-status/         # Status and validation
│   ├── migrations/               # Database schema
│   └── config.toml              # Supabase configuration
├── types/                       # TypeScript definitions
├── package.json
├── .env.example
└── README.md
```

## 🚢 Deployment

### Production Deployment
1. Set up Supabase project
2. Configure environment variables
3. Deploy functions: `supabase functions deploy`
4. Apply migrations: `supabase db push --linked`

### Scaling Considerations
- Edge Functions auto-scale with traffic
- Database connection pooling enabled
- CDN caching for audio files
- Geographic clustering for popular routes

## 📈 Monitoring

- Real-time function logs via Supabase Dashboard
- Database performance metrics
- API usage and rate limiting statistics
- Error tracking and alerting

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.