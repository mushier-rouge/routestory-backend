-- Custom PostgreSQL functions for route optimization and spatial queries

-- Function to find POIs within radius of route path
CREATE OR REPLACE FUNCTION find_pois_near_route(
  route_path GEOGRAPHY,
  max_distance_meters INTEGER DEFAULT 5000
) RETURNS TABLE (
  poi_id UUID,
  distance_meters DOUBLE PRECISION,
  poi_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    ST_Distance(p.location, route_path)::DOUBLE PRECISION,
    to_jsonb(p) - 'location' || jsonb_build_object(
      'latitude', ST_Y(p.location::geometry),
      'longitude', ST_X(p.location::geometry)
    )
  FROM pois p
  WHERE ST_DWithin(p.location, route_path, max_distance_meters)
  ORDER BY ST_Distance(p.location, route_path);
END;
$$ LANGUAGE plpgsql;

-- Function to check if a coordinate is within a certain distance of a route
CREATE OR REPLACE FUNCTION is_location_on_route(
  check_location GEOGRAPHY(POINT),
  route_path GEOGRAPHY(LINESTRING),
  max_distance_meters INTEGER DEFAULT 100
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN ST_DWithin(check_location, route_path, max_distance_meters);
END;
$$ LANGUAGE plpgsql;

-- Function to find nearby stories for a given location
CREATE OR REPLACE FUNCTION find_stories_near_location(
  user_location GEOGRAPHY(POINT),
  max_distance_meters INTEGER DEFAULT 500
) RETURNS TABLE (
  story_id UUID,
  distance_meters DOUBLE PRECISION,
  story_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    ST_Distance(s.trigger_location, user_location)::DOUBLE PRECISION,
    to_jsonb(s) - 'trigger_location' || jsonb_build_object(
      'trigger_latitude', ST_Y(s.trigger_location::geometry),
      'trigger_longitude', ST_X(s.trigger_location::geometry)
    )
  FROM stories s
  WHERE ST_DWithin(s.trigger_location, user_location, max_distance_meters)
  ORDER BY s.priority DESC, ST_Distance(s.trigger_location, user_location);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate POI popularity score based on multiple factors
CREATE OR REPLACE FUNCTION calculate_poi_score(
  google_rating DECIMAL,
  review_count INTEGER,
  poi_type TEXT,
  distance_from_route DOUBLE PRECISION,
  uniqueness_score INTEGER DEFAULT 5
) RETURNS DECIMAL AS $$
DECLARE
  rating_score DECIMAL := 0;
  popularity_score DECIMAL := 0;
  type_score DECIMAL := 0;
  distance_score DECIMAL := 0;
  final_score DECIMAL := 0;
BEGIN
  -- Google rating component (25% weight)
  IF google_rating IS NOT NULL THEN
    rating_score := (google_rating / 5.0) * 0.25;
  END IF;
  
  -- Review count component (20% weight) - logarithmic scale
  IF review_count > 0 THEN
    popularity_score := LEAST(ln(review_count) / ln(1000), 1.0) * 0.20;
  END IF;
  
  -- POI type component (20% weight)
  CASE poi_type
    WHEN 'tourist_attraction' THEN type_score := 0.20;
    WHEN 'museum' THEN type_score := 0.18;
    WHEN 'historical_site' THEN type_score := 0.16;
    WHEN 'landmark' THEN type_score := 0.15;
    WHEN 'park' THEN type_score := 0.12;
    WHEN 'restaurant' THEN type_score := 0.10;
    ELSE type_score := 0.08;
  END CASE;
  
  -- Distance penalty (10% weight) - closer is better
  IF distance_from_route <= 500 THEN
    distance_score := 0.10;
  ELSIF distance_from_route <= 1000 THEN
    distance_score := 0.08;
  ELSIF distance_from_route <= 2000 THEN
    distance_score := 0.05;
  ELSE
    distance_score := 0.02;
  END IF;
  
  -- Uniqueness score (15% weight) + historical significance (10% weight)
  final_score := rating_score + popularity_score + type_score + distance_score + 
                (uniqueness_score / 10.0 * 0.15) + 0.10; -- Default historical significance
  
  RETURN ROUND(final_score * 100, 2); -- Return score out of 100
END;
$$ LANGUAGE plpgsql;

-- Function to find popular route combinations for caching
CREATE OR REPLACE FUNCTION get_popular_routes(
  days_back INTEGER DEFAULT 30,
  min_requests INTEGER DEFAULT 3
) RETURNS TABLE (
  start_lat DOUBLE PRECISION,
  start_lng DOUBLE PRECISION,
  end_lat DOUBLE PRECISION,
  end_lng DOUBLE PRECISION,
  request_count BIGINT,
  avg_distance_meters DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ST_Y(r.start_location::geometry) as start_lat,
    ST_X(r.start_location::geometry) as start_lng,
    ST_Y(r.end_location::geometry) as end_lat,
    ST_X(r.end_location::geometry) as end_lng,
    COUNT(*) as request_count,
    AVG(r.total_distance_meters)::DOUBLE PRECISION as avg_distance_meters
  FROM routes r 
  WHERE r.created_at > NOW() - INTERVAL '1 day' * days_back
    AND r.status = 'completed'
  GROUP BY r.start_location, r.end_location
  HAVING COUNT(*) >= min_requests
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;