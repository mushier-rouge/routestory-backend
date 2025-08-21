-- Enable PostGIS extension for spatial data types and functions
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create routes table with spatial data types
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_location GEOGRAPHY(POINT) NOT NULL,
  end_location GEOGRAPHY(POINT) NOT NULL, 
  route_path GEOGRAPHY(LINESTRING) NOT NULL,
  preferences JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  generation_progress INTEGER DEFAULT 0 CHECK (generation_progress >= 0 AND generation_progress <= 100),
  total_distance_meters INTEGER,
  estimated_time_seconds INTEGER,
  time_increase_percent INTEGER,
  baseline_time_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cache_expires_at TIMESTAMP WITH TIME ZONE
);

-- Create pois (Points of Interest) table
CREATE TABLE pois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  location GEOGRAPHY(POINT) NOT NULL,
  poi_type TEXT NOT NULL,
  google_place_id TEXT UNIQUE,
  popularity_score DECIMAL DEFAULT 0,
  google_rating DECIMAL CHECK (google_rating >= 0 AND google_rating <= 5),
  review_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}', -- Store Google Places API data
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stories table
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_id UUID REFERENCES pois(id) ON DELETE SET NULL,
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  audio_url TEXT,
  trigger_location GEOGRAPHY(POINT) NOT NULL,
  trigger_radius_meters INTEGER DEFAULT 150 CHECK (trigger_radius_meters > 0),
  duration_seconds INTEGER,
  category TEXT NOT NULL,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  route_coordinate_index INTEGER,
  estimated_trigger_time INTEGER,
  generation_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create spatial indexes for fast geographic queries
CREATE INDEX routes_start_location_idx ON routes USING GIST (start_location);
CREATE INDEX routes_end_location_idx ON routes USING GIST (end_location);
CREATE INDEX routes_route_path_idx ON routes USING GIST (route_path);
CREATE INDEX routes_status_idx ON routes (status);
CREATE INDEX routes_cache_expires_idx ON routes (cache_expires_at);

CREATE INDEX pois_location_idx ON pois USING GIST (location);
CREATE INDEX pois_popularity_idx ON pois (popularity_score DESC);
CREATE INDEX pois_google_place_id_idx ON pois (google_place_id);
CREATE INDEX pois_poi_type_idx ON pois (poi_type);

CREATE INDEX stories_trigger_location_idx ON stories USING GIST (trigger_location);
CREATE INDEX stories_route_id_idx ON stories (route_id);
CREATE INDEX stories_poi_id_idx ON stories (poi_id);
CREATE INDEX stories_category_idx ON stories (category);
CREATE INDEX stories_priority_idx ON stories (priority DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();