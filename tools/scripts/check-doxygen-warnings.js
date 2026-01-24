#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Validates Doxygen documentation generation for warnings.
 *
 * This script checks the Doxygen warning log and fails the CI pipeline
 * if any warnings are found, ensuring complete documentation coverage.
 *
 * @module check-doxygen-warnings
 */

const fs = require('fs');
const path = require('path');

const WARNINGS_LOG = path.join(__dirname, '../../docs/api/doxygen_warnings.log');

/**
 * Checks the Doxygen warnings log for any warnings.
 *
 * @returns {number} Exit code - 0 for success, 1 for warnings found
 */
function checkWarnings() {
  // If log file doesn't exist, Doxygen wasn't run
  if (!fs.existsSync(WARNINGS_LOG)) {
    console.log('No Doxygen warnings log found. Run docs:generate first.');
    return 0;
  }

  const content = fs.readFileSync(WARNINGS_LOG, 'utf8').trim();

  // Filter out non-warning lines (Doxygen outputs progress info too)
  const warnings = content.split('\n').filter((line) => {
    const trimmed = line.trim();
    // Skip empty lines and pure progress messages
    if (!trimmed) return false;
    if (trimmed.startsWith('Searching for')) return false;
    if (trimmed.startsWith('Parsing')) return false;
    if (trimmed.startsWith('Generating')) return false;
    if (trimmed.startsWith('Reading')) return false;
    if (trimmed.startsWith('Building')) return false;
    if (trimmed.startsWith('Patching')) return false;
    if (trimmed.startsWith('Adding')) return false;
    if (trimmed.startsWith('Finalizing')) return false;
    if (trimmed.startsWith('lookup')) return false;
    // Actual warnings contain 'warning:' or 'error:'
    return trimmed.includes('warning:') || trimmed.includes('error:');
  });

  if (warnings.length > 0) {
    console.error('Doxygen documentation warnings found:\n');
    warnings.forEach((warning) => {
      console.error(`  ${warning}`);
    });
    console.error(`\nTotal: ${warnings.length} warning(s)`);
    console.error('\nPlease fix the documentation issues before committing.');
    return 1;
  }

  console.log('✓ Doxygen documentation generated without warnings');
  return 0;
}

process.exit(checkWarnings());
