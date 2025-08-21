-- Enable real-time subscriptions for route status updates
ALTER TABLE routes REPLICA IDENTITY FULL;

-- Enable realtime for routes table so clients can subscribe to route generation updates
ALTER PUBLICATION supabase_realtime ADD TABLE routes;

-- Enable realtime for stories table for live story updates
ALTER TABLE stories REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE stories;

-- Create materialized view for popular routes caching
CREATE MATERIALIZED VIEW popular_routes AS
SELECT 
  start_location,
  end_location,
  COUNT(*) as request_count,
  AVG(ST_Length(route_path::geometry)) as avg_distance_meters,
  AVG(total_distance_meters) as avg_total_distance,
  AVG(estimated_time_seconds) as avg_time_seconds
FROM routes 
WHERE created_at > NOW() - INTERVAL '30 days'
  AND status = 'completed'
GROUP BY start_location, end_location
HAVING COUNT(*) > 2
ORDER BY COUNT(*) DESC;

-- Create index on materialized view
CREATE INDEX popular_routes_start_location_idx ON popular_routes USING GIST (start_location);
CREATE INDEX popular_routes_end_location_idx ON popular_routes USING GIST (end_location);
CREATE INDEX popular_routes_request_count_idx ON popular_routes (request_count DESC);

-- Create function to refresh popular routes view
CREATE OR REPLACE FUNCTION refresh_popular_routes()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW popular_routes;
END;
$$ LANGUAGE plpgsql;

-- Set up Row Level Security (RLS) policies for API key authentication
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
-- Note: In production, you'd want more restrictive policies based on API keys
CREATE POLICY "Allow all operations for authenticated users" ON routes
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read access to POIs" ON pois
  FOR SELECT USING (true);

CREATE POLICY "Allow all operations on stories for authenticated users" ON stories
  FOR ALL USING (auth.role() = 'authenticated');

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-files',
  'audio-files', 
  false,
  52428800, -- 50MB limit
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav']
);

-- Enable RLS on storage
CREATE POLICY "Allow authenticated uploads to audio-files bucket" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'audio-files');

CREATE POLICY "Allow public downloads from audio-files bucket" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'audio-files');