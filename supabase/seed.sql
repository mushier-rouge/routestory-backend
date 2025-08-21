-- Sample data for development and testing

-- Insert sample POIs for testing
INSERT INTO pois (name, description, address, location, poi_type, google_place_id, popularity_score, google_rating, review_count, metadata) VALUES
(
  'Stanford University',
  'Prestigious private research university founded in 1885',
  '450 Serra Mall, Stanford, CA 94305',
  ST_GeogFromText('POINT(-122.1697 37.4275)'),
  'university',
  'ChIJd1MWdYO8j4ARcqjXeGavqJ8',
  85.5,
  4.6,
  2847,
  '{"established": 1885, "notable_alumni": ["Google founders", "Yahoo founders"], "campus_size": "8180 acres"}'
),
(
  'Computer History Museum',
  'World''s largest history museum dedicated to computing',
  '1401 N Shoreline Blvd, Mountain View, CA 94043',
  ST_GeogFromText('POINT(-122.0775 37.4145)'),
  'museum',
  'ChIJ_5XdZI28j4ARnGZ6pGNW-c4',
  78.2,
  4.5,
  1265,
  '{"exhibits": ["Revolution", "Internet History"], "artifacts": "largest collection", "programming": "events and lectures"}'
),
(
  'Googleplex',
  'Google headquarters and main campus',
  '1600 Amphitheatre Pkwy, Mountain View, CA 94043',
  ST_GeogFromText('POINT(-122.0840 37.4220)'),
  'corporate_campus',
  'ChIJw______96C4AR4jjQNiRqRsY',
  92.1,
  4.4,
  3892,
  '{"founded": 2004, "employees": "over 100000", "notable_features": ["Android statues", "Visitor center"]}'
),
(
  'Apple Park',
  'Apple Inc. corporate headquarters',
  'One Apple Park Way, Cupertino, CA 95014',
  ST_GeogFromText('POINT(-122.0096 37.3349)'),
  'corporate_campus',
  'ChIJXxjqM0m2j4ARfWZ6pJJaXwY',
  88.7,
  4.3,
  1567,
  '{"opened": 2017, "architect": "Norman Foster", "cost": "$5 billion", "ring_diameter": "461 meters"}'
),
(
  'NASA Ames Research Center',
  'NASA research facility focusing on aeronautics and space',
  'Moffett Blvd, Mountain View, CA 94035',
  ST_GeogFromText('POINT(-122.0553 37.4161)'),
  'research_facility',
  'ChIJh_N9fau8j4ARnoNrQ6U1DtY',
  71.3,
  4.2,
  892,
  '{"established": 1939, "focus": ["aeronautics", "space exploration"], "wind_tunnels": "several historic"}'
);

-- Sample route for testing (Palo Alto to Sunnyvale)
INSERT INTO routes (id, start_location, end_location, route_path, preferences, status, generation_progress, total_distance_meters, estimated_time_seconds, baseline_time_seconds, time_increase_percent, cache_expires_at) VALUES 
(
  'sample-route-123',
  ST_GeogFromText('POINT(-122.1430 37.4419)'), -- Palo Alto
  ST_GeogFromText('POINT(-122.0363 37.3688)'), -- Sunnyvale
  ST_GeogFromText('LINESTRING(-122.1430 37.4419, -122.1697 37.4275, -122.0840 37.4220, -122.0553 37.4161, -122.0363 37.3688)'),
  '{"max_time_increase_percent": 20, "interests": ["technology", "history"], "driving_speed": "normal"}',
  'completed',
  100,
  18500,
  1560, -- 26 minutes
  1320, -- 22 minutes baseline
  18,
  NOW() + INTERVAL '24 hours'
);

-- Sample stories linked to the route
INSERT INTO stories (id, poi_id, route_id, title, content, trigger_location, trigger_radius_meters, duration_seconds, category, priority, route_coordinate_index, estimated_trigger_time, generation_metadata) VALUES
(
  'story-stanford-123',
  (SELECT id FROM pois WHERE name = 'Stanford University'),
  'sample-route-123',
  'The Birth of Silicon Valley at Stanford',
  'As you pass Stanford University, you''re driving through the birthplace of Silicon Valley. Founded in 1885 by railroad magnate Leland Stanford, this university would become the launching pad for some of the world''s most influential technology companies. In the 1950s, Stanford''s Frederick Terman encouraged his students to start companies nearby, creating what we now know as Silicon Valley. Google''s founders Larry Page and Sergey Brin met here as PhD students, developing their PageRank algorithm in Stanford''s computer science program. The famous Stanford Research Park, established in 1951, was one of the first university-affiliated research parks and helped spawn companies like Hewlett-Packard, Varian Associates, and later, countless tech startups.',
  ST_GeogFromText('POINT(-122.1697 37.4275)'),
  200,
  75,
  'history',
  9,
  1,
  420,
  '{"research_sources": ["wikipedia"], "word_count": 142, "generation_timestamp": "2024-12-01T12:00:00Z", "model_used": "gemini-pro"}'
),
(
  'story-googleplex-123',
  (SELECT id FROM pois WHERE name = 'Googleplex'),
  'sample-route-123',
  'Inside the Googleplex',
  'Welcome to the Googleplex, the heart of Google''s operations since 2004. This sprawling campus houses over 20,000 employees working on everything from search algorithms to self-driving cars. What makes Google''s campus unique isn''t just its colorful buildings and Android statue garden, but its philosophy of creating a workplace that feels more like a university campus. The company provides free meals, on-site healthcare, and even allows employees to bring their dogs to work. The campus features volleyball courts, swimming pools, and the famous Google bikes that employees use to navigate between buildings. Interestingly, Google''s founders insisted on keeping the original building''s address, 1600 Amphitheatre Parkway, as a nod to their humble beginnings.',
  ST_GeogFromText('POINT(-122.0840 37.4220)'),
  200,
  68,
  'technology',
  8,
  2,
  780,
  '{"research_sources": ["wikipedia", "google_places"], "word_count": 135, "generation_timestamp": "2024-12-01T12:00:00Z", "model_used": "gemini-pro"}'
);

-- Refresh the popular routes materialized view
REFRESH MATERIALIZED VIEW popular_routes;