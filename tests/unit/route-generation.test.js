// Unit tests for route generation logic
const nock = require('nock');

describe('Route Generation Logic', () => {
  describe('Coordinate Validation', () => {
    test('should validate correct coordinates', () => {
      const validCoords = [37.4419, -122.1430];
      expect(global.testUtils.isValidCoordinate(validCoords)).toBe(true);
    });

    test('should reject invalid latitude', () => {
      const invalidCoords = [91, -122.1430]; // Latitude > 90
      expect(global.testUtils.isValidCoordinate(invalidCoords)).toBe(false);
    });

    test('should reject invalid longitude', () => {
      const invalidCoords = [37.4419, -181]; // Longitude < -180
      expect(global.testUtils.isValidCoordinate(invalidCoords)).toBe(false);
    });

    test('should reject non-array coordinates', () => {
      expect(global.testUtils.isValidCoordinate("37.4419,-122.1430")).toBe(false);
    });

    test('should reject incomplete coordinates', () => {
      expect(global.testUtils.isValidCoordinate([37.4419])).toBe(false);
    });
  });

  describe('Polyline Decoding', () => {
    // Mock polyline decoding function (extracted from route generation)
    function decodePolyline(encoded) {
      const coordinates = [];
      let index = 0;
      let lat = 0;
      let lng = 0;

      while (index < encoded.length) {
        let b;
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

        coordinates.push([lat / 1e5, lng / 1e5]);
      }

      return coordinates;
    }

    test('should decode simple polyline correctly', () => {
      // Simple polyline from Google Maps
      const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
      const decoded = decodePolyline(encoded);
      
      expect(Array.isArray(decoded)).toBe(true);
      expect(decoded.length).toBeGreaterThan(0);
      
      // Check first coordinate is valid
      expect(global.testUtils.isValidCoordinate(decoded[0])).toBe(true);
    });

    test('should handle empty polyline', () => {
      const decoded = decodePolyline('');
      expect(decoded).toEqual([]);
    });

    test('should return coordinates in [lat, lng] format', () => {
      const encoded = '_p~iF~ps|U_ulLnnqC';
      const decoded = decodePolyline(encoded);
      
      if (decoded.length > 0) {
        const [lat, lng] = decoded[0];
        expect(typeof lat).toBe('number');
        expect(typeof lng).toBe('number');
        expect(lat).toBeGreaterThanOrEqual(-90);
        expect(lat).toBeLessThanOrEqual(90);
        expect(lng).toBeGreaterThanOrEqual(-180);
        expect(lng).toBeLessThanOrEqual(180);
      }
    });
  });

  describe('POI Scoring Algorithm', () => {
    // Mock POI scoring function
    function calculatePOIScore(googleRating, reviewCount, poiType, distanceFromRoute) {
      const ratingScore = googleRating > 0 ? (googleRating / 5.0) * 0.25 : 0;
      const popularityScore = reviewCount > 0 ? Math.min(Math.log(reviewCount) / Math.log(1000), 1.0) * 0.20 : 0;
      
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
      
      let distanceScore = 0;
      if (distanceFromRoute <= 500) distanceScore = 0.10;
      else if (distanceFromRoute <= 1000) distanceScore = 0.08;
      else if (distanceFromRoute <= 2000) distanceScore = 0.05;
      else distanceScore = 0.02;
      
      const uniquenessScore = 0.15 * 0.5;
      const historicalScore = 0.10 * 0.5;
      
      const finalScore = ratingScore + popularityScore + typeScore + distanceScore + uniquenessScore + historicalScore;
      return Math.round(finalScore * 100);
    }

    test('should score high-rated tourist attraction highly', () => {
      const score = calculatePOIScore(4.8, 1500, 'tourist_attraction', 300);
      expect(score).toBeGreaterThan(70);
    });

    test('should score low-rated restaurant lower', () => {
      const score = calculatePOIScore(2.1, 50, 'restaurant', 1500);
      expect(score).toBeLessThan(50);
    });

    test('should penalize distance from route', () => {
      const closeScore = calculatePOIScore(4.5, 1000, 'museum', 200);
      const farScore = calculatePOIScore(4.5, 1000, 'museum', 3000);
      expect(closeScore).toBeGreaterThan(farScore);
    });

    test('should handle zero ratings gracefully', () => {
      const score = calculatePOIScore(0, 0, 'unknown', 500);
      expect(score).toBeGreaterThan(0); // Should still have base scores
      expect(score).toBeLessThan(50);
    });

    test('should return integer scores', () => {
      const score = calculatePOIScore(3.7, 234, 'park', 750);
      expect(Number.isInteger(score)).toBe(true);
    });
  });

  describe('Google Maneuver Mapping', () => {
    // Mock maneuver mapping function
    function mapGoogleManeuverToMapKit(googleManeuver) {
      const maneuverMap = {
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

    test('should map basic turn maneuvers correctly', () => {
      expect(mapGoogleManeuverToMapKit('turn-left')).toBe('turn_left');
      expect(mapGoogleManeuverToMapKit('turn-right')).toBe('turn_right');
    });

    test('should map complex maneuvers correctly', () => {
      expect(mapGoogleManeuverToMapKit('turn-sharp-left')).toBe('turn_sharp_left');
      expect(mapGoogleManeuverToMapKit('uturn-right')).toBe('u_turn');
    });

    test('should handle unknown maneuvers with default', () => {
      expect(mapGoogleManeuverToMapKit('unknown-maneuver')).toBe('continue_straight');
      expect(mapGoogleManeuverToMapKit('')).toBe('continue_straight');
      expect(mapGoogleManeuverToMapKit(null)).toBe('continue_straight');
    });

    test('should handle highway maneuvers', () => {
      expect(mapGoogleManeuverToMapKit('ramp-left')).toBe('ramp_left');
      expect(mapGoogleManeuverToMapKit('merge')).toBe('merge');
      expect(mapGoogleManeuverToMapKit('keep-right')).toBe('keep_right');
    });
  });

  describe('Request Validation', () => {
    // Mock validation function
    function validateRouteRequest(requestData) {
      if (!requestData.start_location || !requestData.end_location) {
        return {
          valid: false,
          error: 'Missing required location data',
          details: { required_fields: ['start_location', 'end_location'] }
        };
      }

      const hasStartData = requestData.start_location.coordinates || requestData.start_location.address;
      const hasEndData = requestData.end_location.coordinates || requestData.end_location.address;
      
      if (!hasStartData || !hasEndData) {
        return {
          valid: false,
          error: 'Each location must have either coordinates or address',
          details: { 
            start_location_valid: !!hasStartData,
            end_location_valid: !!hasEndData
          }
        };
      }

      // Validate coordinates format if provided
      if (requestData.start_location.coordinates) {
        const [lat, lng] = requestData.start_location.coordinates;
        if (typeof lat !== 'number' || typeof lng !== 'number' || 
            lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return {
            valid: false,
            error: 'Invalid start location coordinates'
          };
        }
      }

      return { valid: true };
    }

    test('should validate complete route request', () => {
      const result = validateRouteRequest(global.testData.validRouteRequest);
      expect(result.valid).toBe(true);
    });

    test('should reject request without start location', () => {
      const invalidRequest = {
        end_location: global.testData.validLocations.sunnyvale
      };
      const result = validateRouteRequest(invalidRequest);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required location data');
    });

    test('should reject request without end location', () => {
      const invalidRequest = {
        start_location: global.testData.validLocations.paloAlto
      };
      const result = validateRouteRequest(invalidRequest);
      expect(result.valid).toBe(false);
    });

    test('should reject invalid coordinates', () => {
      const invalidRequest = {
        start_location: { coordinates: [200, 200] },
        end_location: global.testData.validLocations.sunnyvale
      };
      const result = validateRouteRequest(invalidRequest);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid start location coordinates');
    });

    test('should accept valid address-only request', () => {
      const addressRequest = {
        start_location: { address: "Palo Alto, CA" },
        end_location: { address: "Sunnyvale, CA" }
      };
      const result = validateRouteRequest(addressRequest);
      expect(result.valid).toBe(true);
    });

    test('should accept mixed address and coordinates', () => {
      const mixedRequest = {
        start_location: { address: "Palo Alto, CA" },
        end_location: { coordinates: [37.3688, -122.0363] }
      };
      const result = validateRouteRequest(mixedRequest);
      expect(result.valid).toBe(true);
    });
  });

  describe('MapKit Response Format Validation', () => {
    test('should validate complete MapKit route format', () => {
      const mockRoute = {
        coordinates: [[37.4419, -122.1430], [37.4420, -122.1435]],
        total_distance_meters: 1500,
        estimated_time_seconds: 180,
        time_increase_percent: 15,
        baseline_time_seconds: 150,
        instructions: [
          {
            instruction: "Head north on University Ave",
            distance_meters: 500,
            coordinate: [37.4419, -122.1430],
            maneuver_type: "continue_straight"
          }
        ],
        waypoints: [
          {
            coordinate: [37.4419, -122.1430],
            name: "Starting Point",
            type: "start"
          }
        ]
      };

      expect(global.testUtils.isValidMapKitRoute(mockRoute)).toBe(true);
    });

    test('should reject route without coordinates', () => {
      const invalidRoute = {
        total_distance_meters: 1500,
        estimated_time_seconds: 180,
        instructions: [],
        waypoints: []
      };

      expect(global.testUtils.isValidMapKitRoute(invalidRoute)).toBe(false);
    });

    test('should reject route with invalid coordinates', () => {
      const invalidRoute = {
        coordinates: [[200, 200]], // Invalid coordinates
        total_distance_meters: 1500,
        estimated_time_seconds: 180,
        instructions: [],
        waypoints: []
      };

      expect(global.testUtils.isValidMapKitRoute(invalidRoute)).toBe(false);
    });
  });
});