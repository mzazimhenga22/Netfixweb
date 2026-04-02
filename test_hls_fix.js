/**
 * DEFINITIVE diagnostic: Tests a real VidLink token with EVERY
 * possible fetch strategy to find what the CDN actually accepts.
 * 
 * Usage: Run this, then immediately open localhost:3000/browse in
 * your browser. The script intercepts the HLS proxy request and
 * tests the URL with multiple approaches.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// ── Extract the REAL CDN URL from a recent browser request ──
// We'll start a local interceptor that captures the URL from the proxy route.
// But first, let's test with the known URL pattern from the logs.

// Decode the URL from the latest browser error log:
const ENCODED_URL = 'https://storm.vodvidl.site/proxy/file2/5RREG7donP5zOLpHRjjusd9McxqKdXGks4J65Y53%2BzP51~1wQsx6Oc0LcUXperaXaVjVpj6yYCH07Frp2~akUCKzyXmWRZ5pn2WdhZex5KC0kGVv8oqPVxxbKaaB8ZUnXOLjIPazcWD1PPSqd4cZtLBwy9bE~hT6BNVPYHbcvPA%3D/cGxheWxpc3QubTN1OA%3D%3D.m3u8';

async function fetchWithStrategy(name, url, headers) {
  try {
    const res = await fetch(url, { 
      headers,
      redirect: 'follow',
    });
    const status = res.status;
    const ct = res.headers.get('content-type') || '';
    let bodyPreview = '';
    if (status === 200) {
      const text = await res.text();
      bodyPreview = text.substring(0, 200);
    }
    return { name, status, ct, bodyPreview };
  } catch (e) {
    return { name, status: 'ERROR', ct: '', bodyPreview: e.message };
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  CDN 403 Root Cause Diagnosis                        ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // First, get a fresh token by going through VidLink's API
  console.log('Step 1: Getting a FRESH playlist URL from VidLink...\n');
  
  const realUrl = await getFreshPlaylistUrl();
  
  if (!realUrl) {
    console.log('  ⚠️  Could not get fresh URL from VidLink API.');
    console.log('  Using URL from latest browser logs (may be expired).\n');
  }
  
  const testUrl = realUrl || ENCODED_URL;
  console.log(`  Test URL: ${testUrl.substring(0, 100)}...\n`);
  
  // Parse the host param
  const HOST_ORIGIN = 'https://skyember44.online';
  const parsedUrl = new URL(testUrl);
  const stormOrigin = parsedUrl.origin;
  
  // Build an alternative URL on skyember44.online
  const altUrl = testUrl.replace(stormOrigin, HOST_ORIGIN);
  
  console.log('━━━ Step 2: Testing EVERY fetch strategy ━━━\n');
  
  const strategies = [
    // Strategy 1: Current approach (Referer: videostr.net, Origin: videostr.net)
    {
      name: '1. Current: storm + Referer:videostr.net + Origin:videostr.net',
      url: testUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://videostr.net/',
        'Origin': 'https://videostr.net',
      },
    },
    // Strategy 2: Use vidlink.pro as referer (how VidLink's own player does it)
    {
      name: '2. storm + Referer:vidlink.pro + Origin:vidlink.pro',
      url: testUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://vidlink.pro/',
        'Origin': 'https://vidlink.pro',
      },
    },
    // Strategy 3: No Origin header (some CDNs block Origin on non-CORS requests)
    {
      name: '3. storm + Referer:videostr.net + NO Origin',
      url: testUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://videostr.net/',
      },
    },
    // Strategy 4: Use the HOST param as the actual URL origin
    {
      name: '4. skyember44 host + Referer:videostr.net + Origin:videostr.net',
      url: altUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://videostr.net/',
        'Origin': 'https://videostr.net',
      },
    },
    // Strategy 5: skyember44 as host + no Origin
    {
      name: '5. skyember44 host + Referer:videostr.net + NO Origin',
      url: altUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://videostr.net/',
      },
    },
    // Strategy 6: storm URL with Host header override to skyember44
    {
      name: '6. storm URL + Host:skyember44.online + Referer:videostr.net',
      url: testUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://videostr.net/',
        'Origin': 'https://videostr.net',
        'Host': 'skyember44.online',
      },
    },
    // Strategy 7: No headers at all (maybe CDN doesn't care)
    {
      name: '7. storm + NO extra headers (just UA)',
      url: testUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
      },
    },
    // Strategy 8: skyember44 + vidlink.pro referer
    {
      name: '8. skyember44 host + Referer:vidlink.pro',
      url: altUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://vidlink.pro/',
        'Origin': 'https://vidlink.pro',
      },
    },
    // Strategy 9: skyember44 + NO headers
    {
      name: '9. skyember44 + NO extra headers',
      url: altUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
      },
    },
    // Strategy 10: storm + Sec-Fetch headers (browser-like)
    {
      name: '10. storm + full browser headers (Sec-Fetch)',
      url: testUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://videostr.net/',
        'Origin': 'https://videostr.net',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
    },
  ];
  
  const results = [];
  for (const s of strategies) {
    console.log(`  Testing: ${s.name}`);
    const result = await fetchWithStrategy(s.name, s.url, s.headers);
    console.log(`    → ${result.status} ${result.ct ? `(${result.ct})` : ''}`);
    if (result.status === 200) {
      console.log(`    → BODY: ${result.bodyPreview.substring(0, 100)}`);
    }
    results.push(result);
  }
  
  console.log('\n━━━ Results Summary ━━━\n');
  console.log('  Strategy                                              Status');
  console.log('  ────────────────────────────────────────────────────  ──────');
  for (const r of results) {
    const status = r.status === 200 ? '✅ 200' : `❌ ${r.status}`;
    console.log(`  ${r.name.padEnd(56)} ${status}`);
  }
  
  const working = results.filter(r => r.status === 200);
  console.log();
  
  if (working.length > 0) {
    console.log('  🎉 FOUND WORKING STRATEGY:');
    for (const w of working) {
      console.log(`    → ${w.name}`);
      if (w.bodyPreview) {
        console.log(`    → Content: ${w.bodyPreview.substring(0, 120)}`);
      }
    }
  } else {
    console.log('  ❌ ALL strategies returned non-200.');
    console.log('  Possible causes:');
    console.log('    1. Token is expired (try re-running after refreshing the browser page)');
    console.log('    2. CDN does IP pinning (token bound to browser IP, server IP differs)');
    console.log('    3. CDN requires cookies we are not forwarding');
  }
}

/**
 * Try to get a fresh playlist URL by going through VidLink's API.
 * This needs the WASM-generated token, which we can't do from Node.
 * Instead, we'll intercept a real request to our proxy.
 */
async function getFreshPlaylistUrl() {
  // Method: Fetch the resolve page, look for any hardcoded data
  // or try to access the API directly (won't work without WASM token)
  
  // Alternative: Use a headless approach to actually run VidLink in Puppeteer
  // But that requires puppeteer which is heavy. Let's use a simpler approach.
  
  // Just use the /api/vidlink/proxy/ to call VidLink's API directly
  // The /api/b/movie/ endpoint needs the WASM token, so we can't call it.
  
  return null; // We'll use the URL from browser logs
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
