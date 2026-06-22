/**
 * Copies the Vite single-file build to index.html for GAS deployment.
 *
 * Code.js uses createHtmlOutputFromFile + string replacement to inject
 * window.__GAS_BOOTSTRAP__ at request time, so no patching is needed here.
 * The placeholder "window.__GAS_BOOTSTRAP__=null;" in app.html is preserved
 * exactly by vite-plugin-singlefile and replaced by Code.js on every request.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const SRC = resolve('dist/app.html');
const DEST = resolve('index.html');

let html;
try {
  html = readFileSync(SRC, 'utf-8');
} catch (e) {
  console.error(`\n❌  Could not read ${SRC}\n   Run "npm run build" first.\n`);
  process.exit(1);
}

if (!html.includes('window.__GAS_BOOTSTRAP__=null;')) {
  console.error('\n❌  Bootstrap placeholder not found in built HTML.');
  console.error('   Make sure app.html still contains the gas-bootstrap-data script tag.\n');
  process.exit(1);
}

writeFileSync(DEST, html, 'utf-8');
console.log('\n✅  index.html written for GAS deployment.');
console.log('   Run "clasp push" to push to Google Apps Script.\n');
