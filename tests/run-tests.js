#!/usr/bin/env node

// Comprehensive test runner for RouteStory Backend
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  unit: {
    pattern: 'tests/unit/**/*.test.js',
    description: 'Unit Tests - Fast, isolated logic tests',
    timeout: 10000
  },
  integration: {
    pattern: 'tests/integration/**/*.test.js',
    description: 'Integration Tests - API and database integration',
    timeout: 30000
  },
  e2e: {
    pattern: 'tests/e2e/**/*.test.js',
    description: 'End-to-End Tests - Complete workflow validation',
    timeout: 90000
  },
  performance: {
    pattern: 'tests/performance/**/*.test.js',
    description: 'Performance Tests - Load and response time validation',
    timeout: 120000
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(text) {
  const line = '='.repeat(60);
  console.log(colorize(line, 'cyan'));
  console.log(colorize(`  ${text}`, 'bright'));
  console.log(colorize(line, 'cyan'));
}

function printSection(text) {
  console.log(colorize(`\n📋 ${text}`, 'blue'));
  console.log(colorize('-'.repeat(40), 'blue'));
}

function checkEnvironment() {
  console.log('🔍 Checking test environment...\n');
  
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_MAPS_API_KEY'
  ];

  const missing = [];
  const configured = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar] || process.env[envVar].includes('your_')) {
      missing.push(envVar);
    } else {
      configured.push(envVar);
    }
  }

  console.log(colorize('✅ Configured:', 'green'));
  configured.forEach(env => console.log(`   ${env}`));

  if (missing.length > 0) {
    console.log(colorize('\n⚠️  Missing or not configured:', 'yellow'));
    missing.forEach(env => console.log(`   ${env}`));
    console.log(colorize('\n💡 Some tests may be skipped due to missing configuration.', 'yellow'));
  }

  // Check for optional environment variables
  const optional = ['GOOGLE_GEMINI_API_KEY', 'ELEVENLABS_API_KEY'];
  const optionalConfigured = optional.filter(env => 
    process.env[env] && !process.env[env].includes('your_')
  );

  if (optionalConfigured.length > 0) {
    console.log(colorize('\n🎯 Optional APIs configured:', 'cyan'));
    optionalConfigured.forEach(env => console.log(`   ${env}`));
  }

  console.log('');
}

function runTestSuite(suiteKey, suiteConfig) {
  printSection(`${suiteConfig.description}`);
  
  try {
    const command = `npx jest ${suiteConfig.pattern} --verbose --testTimeout=${suiteConfig.timeout}`;
    console.log(colorize(`Running: ${command}\n`, 'cyan'));
    
    execSync(command, { 
      stdio: 'inherit',
      cwd: path.join(__dirname)
    });
    
    console.log(colorize(`\n✅ ${suiteKey.toUpperCase()} tests completed successfully!`, 'green'));
    return { suite: suiteKey, status: 'passed', error: null };
    
  } catch (error) {
    console.log(colorize(`\n❌ ${suiteKey.toUpperCase()} tests failed!`, 'red'));
    return { suite: suiteKey, status: 'failed', error: error.message };
  }
}

function runCoverageReport() {
  printSection('Generating Test Coverage Report');
  
  try {
    const command = 'npx jest --coverage --coverageDirectory=coverage';
    console.log(colorize(`Running: ${command}\n`, 'cyan'));
    
    execSync(command, { 
      stdio: 'inherit',
      cwd: path.join(__dirname)
    });
    
    console.log(colorize('\n✅ Coverage report generated in ./coverage/', 'green'));
    return true;
  } catch (error) {
    console.log(colorize('\n❌ Coverage report generation failed!', 'red'));
    return false;
  }
}

function generateTestReport(results) {
  const timestamp = new Date().toISOString();
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  
  const report = {
    timestamp,
    summary: {
      total: results.length,
      passed,
      failed,
      success_rate: Math.round((passed / results.length) * 100)
    },
    results,
    environment: {
      node_version: process.version,
      platform: process.platform,
      configured_apis: Object.keys(process.env)
        .filter(key => key.includes('API_KEY') && !process.env[key].includes('your_'))
        .length
    }
  };

  const reportPath = path.join(__dirname, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(colorize(`\n📊 Test report saved to: ${reportPath}`, 'cyan'));
  return report;
}

function printSummary(results) {
  printSection('Test Execution Summary');
  
  const passed = results.filter(r => r.status === 'passed');
  const failed = results.filter(r => r.status === 'failed');
  
  console.log(colorize(`Total Test Suites: ${results.length}`, 'bright'));
  console.log(colorize(`✅ Passed: ${passed.length}`, 'green'));
  console.log(colorize(`❌ Failed: ${failed.length}`, failed.length > 0 ? 'red' : 'green'));
  
  if (failed.length > 0) {
    console.log(colorize('\n❌ Failed Suites:', 'red'));
    failed.forEach(result => {
      console.log(`   ${result.suite.toUpperCase()}`);
    });
  }
  
  const successRate = Math.round((passed.length / results.length) * 100);
  console.log(colorize(`\n📈 Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'red'));
}

async function main() {
  const args = process.argv.slice(2);
  const runCoverage = args.includes('--coverage');
  const specificSuite = args.find(arg => Object.keys(TEST_CONFIG).includes(arg));
  
  printHeader('RouteStory Backend Test Suite');
  
  console.log('🧪 RouteStory Backend Comprehensive Test Suite');
  console.log('📅 ' + new Date().toLocaleString());
  console.log('');
  
  checkEnvironment();
  
  const results = [];
  
  if (specificSuite) {
    // Run specific test suite
    console.log(colorize(`\n🎯 Running specific test suite: ${specificSuite.toUpperCase()}`, 'magenta'));
    const result = runTestSuite(specificSuite, TEST_CONFIG[specificSuite]);
    results.push(result);
  } else {
    // Run all test suites in order
    console.log(colorize('\n🚀 Running all test suites...', 'magenta'));
    
    for (const [suiteKey, suiteConfig] of Object.entries(TEST_CONFIG)) {
      const result = runTestSuite(suiteKey, suiteConfig);
      results.push(result);
      
      // Small delay between test suites
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Generate coverage report if requested
  if (runCoverage) {
    runCoverageReport();
  }
  
  // Generate and save test report
  const report = generateTestReport(results);
  
  // Print final summary
  printSummary(results);
  
  // Exit with appropriate code
  const hasFailures = results.some(r => r.status === 'failed');
  
  if (hasFailures) {
    console.log(colorize('\n💥 Some tests failed. Check the output above for details.', 'red'));
    process.exit(1);
  } else {
    console.log(colorize('\n🎉 All tests passed successfully!', 'green'));
    console.log(colorize('🚀 RouteStory Backend is ready for deployment!', 'bright'));
    process.exit(0);
  }
}

// Handle command line arguments
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
${colorize('RouteStory Backend Test Runner', 'bright')}

Usage: node run-tests.js [options] [suite]

Test Suites:
  unit         Run unit tests only
  integration  Run integration tests only  
  e2e          Run end-to-end tests only
  performance  Run performance tests only

Options:
  --coverage   Generate test coverage report
  --help, -h   Show this help message

Examples:
  node run-tests.js                 # Run all test suites
  node run-tests.js unit            # Run unit tests only
  node run-tests.js --coverage      # Run all tests with coverage
  node run-tests.js e2e --coverage  # Run e2e tests with coverage

Environment Setup:
  Copy .env.example to .env and configure your API keys:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY  
  - GOOGLE_MAPS_API_KEY
  - GOOGLE_GEMINI_API_KEY (optional)
  - ELEVENLABS_API_KEY (optional)
`);
    process.exit(0);
  }
  
  main().catch(error => {
    console.error(colorize('💥 Test runner crashed:', 'red'), error);
    process.exit(1);
  });
}

module.exports = {
  runTestSuite,
  checkEnvironment,
  generateTestReport
};