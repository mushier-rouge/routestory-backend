# RouteStory Backend Test Suite

## Overview

Comprehensive test suite for the RouteStory Backend covering all aspects of the system from unit tests to end-to-end workflow validation. The test suite ensures reliability, performance, and correctness of the route generation and audio story pipeline.

## Test Structure

```
tests/
├── unit/                   # Fast, isolated logic tests
├── integration/           # API and database integration  
├── e2e/                   # Complete workflow validation
├── performance/           # Load and response time tests
├── fixtures/              # Test data and utilities
├── setup/                 # Test environment configuration
├── run-tests.js          # Comprehensive test runner
└── README.md             # This documentation
```

## Test Categories

### Unit Tests (`tests/unit/`)
- **Route Generation Logic**: Polyline decoding, coordinate validation, POI scoring
- **Content Generation**: Story formatting, metadata processing
- **Audio Processing**: Format validation, duration calculations
- **Utilities**: Helper functions, data transformations

### Integration Tests (`tests/integration/`)
- **API Endpoints**: All Edge Function endpoints with authentication
- **Database Operations**: CRUD operations, spatial queries, constraints
- **External APIs**: Google Maps, Gemini, TTS service integration
- **Error Handling**: Various failure scenarios and recovery

### End-to-End Tests (`tests/e2e/`)
- **Complete Workflow**: Full route generation pipeline
- **Real-time Updates**: Status monitoring and progress tracking
- **Concurrent Operations**: Multiple simultaneous route generations
- **Data Consistency**: Cross-service data validation

### Performance Tests (`tests/performance/`)
- **Load Testing**: Concurrent user scenarios up to 50 users
- **Response Times**: Sub-15s route generation validation
- **Memory Usage**: Resource consumption monitoring
- **Scalability**: Performance degradation analysis

## Running Tests

### Prerequisites

1. **Environment Setup**: Copy `.env.example` to `.env` and configure:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_key
   GOOGLE_MAPS_API_KEY=your_google_maps_key
   GOOGLE_GEMINI_API_KEY=your_gemini_key
   ```

2. **Database**: Ensure Supabase project is running with schema deployed

3. **Dependencies**: Install test dependencies:
   ```bash
   npm install
   ```

### Test Commands

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only  
npm run test:e2e           # End-to-end tests only
npm run test:performance   # Performance tests only

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/unit/route-generation.test.js
```

### Comprehensive Test Runner

Use the built-in test runner for advanced features:

```bash
# Run all test suites with environment validation
node tests/run-tests.js

# Run specific suite
node tests/run-tests.js unit

# Generate coverage report
node tests/run-tests.js --coverage

# Help and options
node tests/run-tests.js --help
```

## Test Configuration

### Environment Variables

The test suite validates these environment variables:

**Required:**
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database access
- `GOOGLE_MAPS_API_KEY`: Google Maps Platform API key

**Optional (some tests will be skipped if missing):**
- `GOOGLE_GEMINI_API_KEY`: For LLM content generation tests
- `GOOGLE_TTS_API_KEY`: For text-to-speech tests

### Test Timeouts

- **Unit Tests**: 10 seconds (fast execution)
- **Integration Tests**: 30 seconds (API calls)
- **End-to-End Tests**: 90 seconds (complete workflows)
- **Performance Tests**: 120 seconds (load testing)

## Test Data and Fixtures

### Test Locations
```javascript
// Standard test coordinates
const testLocations = {
  paloAlto: [37.4419, -122.1430],
  sunnyvale: [37.3688, -122.0363],
  sanFrancisco: [37.7749, -122.4194],
  sanJose: [37.3382, -121.8863]
};
```

### Mock Data
- **Routes**: Pre-generated route data with known POIs
- **Stories**: Sample content with various categories
- **POIs**: Test points of interest with ratings and metadata

### Test Utilities
```javascript
// Available in global.testUtils
global.testUtils = {
  generateUUID: () => crypto.randomUUID(),
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  isValidUUID: (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str),
  validateMapKitResponse: (response) => { /* validation logic */ }
};
```

## Coverage Requirements

### Minimum Coverage Targets
- **Overall Coverage**: 85%
- **Function Coverage**: 90%
- **Line Coverage**: 85%
- **Branch Coverage**: 80%

### Critical Path Coverage
- Route generation pipeline: 95%
- Database operations: 90%
- Error handling: 85%
- External API integration: 80%

## Performance Benchmarks

### Response Time Targets
- Route generation: < 15 seconds
- Status updates: < 500ms
- Audio file access: < 3 seconds
- Database queries: < 200ms

### Load Testing Scenarios
- **Light Load**: 5 concurrent users
- **Medium Load**: 15 concurrent users  
- **Heavy Load**: 50 concurrent users
- **Stress Test**: 100+ concurrent users

## Debugging Tests

### Common Issues

1. **API Rate Limits**: Tests may fail if hitting Google API limits
   - **Solution**: Add delays between tests, use test API keys

2. **Database Connection**: Timeout errors with Supabase
   - **Solution**: Check SUPABASE_URL and network connectivity

3. **Missing Environment Variables**: Tests skipped or failing
   - **Solution**: Verify `.env` file has all required keys

### Debug Mode

Run tests with verbose output:
```bash
node tests/run-tests.js unit --verbose
```

Enable detailed logging:
```bash
DEBUG=true npm test
```

## Continuous Integration

### GitHub Actions Configuration
```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

### Test Reports
- **Coverage Reports**: Generated in `coverage/` directory
- **Test Results**: JSON format in `tests/test-report.json`
- **Performance Metrics**: Detailed timing and memory usage

## Best Practices

### Writing Tests
1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Assertions**: Use descriptive expect messages
4. **Mocking**: Mock external services when appropriate

### Performance
1. **Parallel Execution**: Tests run in parallel where possible
2. **Resource Management**: Clean up connections and timeouts
3. **Data Volume**: Use minimal test data for speed

### Maintenance
1. **Regular Updates**: Keep test data current
2. **API Changes**: Update mocks when external APIs change
3. **Schema Evolution**: Update database tests with schema changes

## Troubleshooting

### Environment Issues
```bash
# Check environment setup
node tests/run-tests.js --help

# Validate API connectivity
npm run test:integration -- --grep "API Integration"

# Test database connection
npm run test:integration -- --grep "Database"
```

### Performance Issues
```bash
# Run performance analysis
npm run test:performance

# Check memory usage
node --inspect tests/run-tests.js performance

# Profile slow tests
npm test -- --detectSlowTests
```

This test suite ensures the RouteStory Backend meets all quality, performance, and reliability requirements for production deployment.