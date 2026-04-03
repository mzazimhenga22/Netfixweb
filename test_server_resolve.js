/**
 * Test Script: Server-Side VidLink Resolution
 * 
 * Tests whether we can resolve VidLink streams entirely server-side
 * (like the React Native native module does) without needing an iframe.
 * 
 * Tests:
 * 1. Fetch VidLink embed page and analyze its structure
 * 2. Extract __NEXT_DATA__, inline scripts, API tokens
 * 3. Try calling /api/b/ directly with extracted data
 * 4. Test alternative direct API endpoints
 * 5. Test fallback providers (vidsrc, etc.)
 */

const TMDB_ID = '550'; // Fight Club (classic test)
const TMDB_ID_2 = '872585'; // Oppenheimer (newer)
const TMDB_TV = '1396'; // Breaking Bad

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

// ─── Helper ───
async function safeFetch(url, opts = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, ...opts.headers },
      redirect: 'follow',
      ...opts,
    });
    return res;
  } catch (e) {
    return { ok: false, status: 'ERR', statusText: e.message, text: async () => '', json: async () => null, headers: new Map() };
  }
}

function separator(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

// ═══════════════════════════════════════════════════════════
// TEST 1: Fetch & Analyze VidLink Embed Page
// ═══════════════════════════════════════════════════════════
async function test1_fetchEmbedPage(tmdbId, type = 'movie') {
  separator(`TEST 1: Fetch VidLink Embed Page (${type}/${tmdbId})`);
  
  const url = type === 'movie' 
    ? `https://vidlink.pro/movie/${tmdbId}`
    : `https://vidlink.pro/tv/${tmdbId}/1/1`;
  
  console.log(`  URL: ${url}`);
  
  const res = await safeFetch(url, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://vidlink.pro/',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
    }
  });
  
  console.log(`  Status: ${res.status} ${res.statusText || ''}`);
  
  if (!res.ok) {
    console.log('  ❌ Failed to fetch embed page');
    return null;
  }
  
  const html = await res.text();
  console.log(`  ✅ Got HTML (${html.length} bytes)`);
  
  // Analyze structure
  console.log('\n  📋 Page Analysis:');
  
  // Check for __NEXT_DATA__
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    console.log('  ✅ Found __NEXT_DATA__');
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      console.log(`    - buildId: ${nextData.buildId || 'N/A'}`);
      console.log(`    - page: ${nextData.page || 'N/A'}`);
      if (nextData.props?.pageProps) {
        const keys = Object.keys(nextData.props.pageProps);
        console.log(`    - pageProps keys: ${keys.join(', ')}`);
        // Check if stream data is embedded
        if (nextData.props.pageProps.stream) {
          console.log('    🎉 STREAM DATA FOUND IN __NEXT_DATA__!');
          console.log(`    - playlist: ${JSON.stringify(nextData.props.pageProps.stream).substring(0, 200)}`);
          return { type: 'next_data', data: nextData.props.pageProps };
        }
      }
      // Check runtimeConfig for API keys
      if (nextData.runtimeConfig) {
        console.log(`    - runtimeConfig keys: ${Object.keys(nextData.runtimeConfig).join(', ')}`);
      }
    } catch (e) {
      console.log(`    ⚠️ Failed to parse: ${e.message}`);
    }
  } else {
    console.log('  ❌ No __NEXT_DATA__ found');
  }
  
  // Check for inline script data
  const scriptTags = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  console.log(`  📝 Script tags found: ${scriptTags.length}`);
  
  // Look for API-related patterns
  const patterns = [
    { name: '/api/b/', regex: /\/api\/b\//g },
    { name: '/api/movie/', regex: /\/api\/movie\//g },
    { name: '/api/tv/', regex: /\/api\/tv\//g },
    { name: '/api/e/', regex: /\/api\/e\//g },
    { name: 'playlist', regex: /playlist/gi },
    { name: 'stream', regex: /stream/gi },
    { name: '.m3u8', regex: /\.m3u8/gi },
    { name: 'token', regex: /token/gi },
    { name: 'wasm', regex: /wasm/gi },
    { name: 'self.__next', regex: /self\.__next/g },
    { name: 'buildManifest', regex: /buildManifest/g },
  ];
  
  for (const p of patterns) {
    const matches = html.match(p.regex);
    if (matches) {
      console.log(`  ✅ Pattern "${p.name}" found ${matches.length} times`);
    }
  }
  
  // Extract all script src URLs
  const scriptSrcs = [...html.matchAll(/src="([^"]*\.js[^"]*)"/g)].map(m => m[1]);
  console.log(`\n  📦 External JS files: ${scriptSrcs.length}`);
  scriptSrcs.slice(0, 8).forEach(s => console.log(`    - ${s.substring(0, 100)}`));
  
  // Look for RSC payload or fetch calls
  const fetchCalls = html.match(/fetch\s*\([^)]*\)/g);
  if (fetchCalls) {
    console.log(`\n  🌐 Inline fetch() calls: ${fetchCalls.length}`);
    fetchCalls.slice(0, 5).forEach(f => console.log(`    - ${f.substring(0, 120)}`));
  }
  
  // Check for data-reactroot or app router markers
  if (html.includes('data-reactroot')) console.log('  📌 Uses Pages Router (data-reactroot)');
  if (html.includes('__next_f')) console.log('  📌 Uses App Router (RSC)');
  
  return { type: 'html', html, scriptSrcs };
}

// ═══════════════════════════════════════════════════════════
// TEST 2: Try Direct API Calls
// ═══════════════════════════════════════════════════════════
async function test2_directApiCalls(tmdbId) {
  separator(`TEST 2: Direct API Calls (TMDB: ${tmdbId})`);
  
  const endpoints = [
    { name: '/api/movie/{id}', url: `https://vidlink.pro/api/movie/${tmdbId}` },
    { name: '/api/b/movie/{id}', url: `https://vidlink.pro/api/b/movie/${tmdbId}` },
    { name: '/api/e/movie/{id}', url: `https://vidlink.pro/api/e/movie/${tmdbId}` },
    { name: '/api/v/movie/{id}', url: `https://vidlink.pro/api/v/movie/${tmdbId}` },
    { name: '/api/s/movie/{id}', url: `https://vidlink.pro/api/s/movie/${tmdbId}` },
  ];
  
  for (const ep of endpoints) {
    console.log(`\n  Testing: ${ep.name}`);
    console.log(`    URL: ${ep.url}`);
    
    const res = await safeFetch(ep.url, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Referer': `https://vidlink.pro/movie/${tmdbId}`,
        'Origin': 'https://vidlink.pro',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
      }
    });
    
    console.log(`    Status: ${res.status}`);
    
    if (res.ok) {
      try {
        const text = await res.text();
        console.log(`    ✅ Response (${text.length} bytes): ${text.substring(0, 300)}`);
        
        // Try parsing as JSON
        try {
          const json = JSON.parse(text);
          if (json?.stream?.playlist) {
            console.log(`    🎉 STREAM FOUND! playlist: ${json.stream.playlist.substring(0, 120)}`);
            return json;
          }
          if (json?.url || json?.playlist) {
            console.log(`    🎉 URL/PLAYLIST FOUND!`);
            return json;
          }
          console.log(`    📋 JSON keys: ${Object.keys(json).join(', ')}`);
        } catch {
          console.log(`    (Not JSON)`);
        }
      } catch (e) {
        console.log(`    ⚠️ Error reading response: ${e.message}`);
      }
    }
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════
// TEST 3: Extract API Route from JS Bundle
// ═══════════════════════════════════════════════════════════
async function test3_analyzeJsBundle(scriptSrcs) {
  separator('TEST 3: Analyze JS Bundles for API Patterns');
  
  if (!scriptSrcs || scriptSrcs.length === 0) {
    console.log('  ⚠️ No script sources to analyze');
    return;
  }
  
  // Focus on app-specific bundles (not framework chunks)
  const appBundles = scriptSrcs.filter(s => 
    !s.includes('framework') && 
    !s.includes('webpack') &&
    !s.includes('polyfill') &&
    (s.includes('page') || s.includes('app') || s.includes('main') || s.includes('layout'))
  );
  
  const toCheck = appBundles.length > 0 ? appBundles.slice(0, 3) : scriptSrcs.slice(0, 3);
  
  for (const src of toCheck) {
    const fullUrl = src.startsWith('http') ? src : `https://vidlink.pro${src.startsWith('/') ? '' : '/'}${src}`;
    console.log(`\n  Fetching: ${fullUrl.substring(0, 100)}...`);
    
    const res = await safeFetch(fullUrl, {
      headers: {
        'Accept': '*/*',
        'Referer': 'https://vidlink.pro/',
      }
    });
    
    if (!res.ok) {
      console.log(`    ❌ Failed: ${res.status}`);
      continue;
    }
    
    const js = await res.text();
    console.log(`    ✅ Got JS (${js.length} bytes)`);
    
    // Search for API patterns
    const apiPatterns = [
      { name: '/api/b/', regex: /["']\/api\/b\/["']/g },
      { name: 'api/b', regex: /api\/b/g },
      { name: 'fetch.*api', regex: /fetch\([^)]*api[^)]*\)/g },
      { name: 'playlist', regex: /["']playlist["']/g },
      { name: '.m3u8', regex: /\.m3u8/g },
      { name: 'stream', regex: /["']stream["']/g },
      { name: 'wasm', regex: /\.wasm/g },
      { name: 'token', regex: /["']token["']/g },
      { name: 'resolver', regex: /resolver/gi },
      { name: 'vodvidl', regex: /vodvidl/g },
      { name: 'videostr', regex: /videostr/g },
    ];
    
    let found = false;
    for (const p of apiPatterns) {
      const matches = js.match(p.regex);
      if (matches) {
        found = true;
        console.log(`    ✅ "${p.name}" found ${matches.length}x`);
        // Show context around first match
        const idx = js.search(p.regex);
        if (idx >= 0) {
          const context = js.substring(Math.max(0, idx - 40), Math.min(js.length, idx + 80));
          console.log(`       Context: ...${context.replace(/\n/g, ' ')}...`);
        }
      }
    }
    if (!found) console.log('    (No API patterns found in this bundle)');
  }
}

// ═══════════════════════════════════════════════════════════
// TEST 4: Test Alternative Providers (Fallback)
// ═══════════════════════════════════════════════════════════
async function test4_alternativeProviders(tmdbId) {
  separator(`TEST 4: Alternative Providers (TMDB: ${tmdbId})`);
  
  const providers = [
    {
      name: 'VidSrc.xyz',
      embedUrl: `https://vidsrc.xyz/embed/movie/${tmdbId}`,
      apiUrl: `https://vidsrc.xyz/api/movie/${tmdbId}`,
    },
    {
      name: 'VidSrc.me',
      embedUrl: `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`,
      apiUrl: null,
    },
    {
      name: 'VidSrc.to',
      embedUrl: `https://vidsrc.to/embed/movie/${tmdbId}`,
      apiUrl: null,
    },
    {
      name: '2embed',
      embedUrl: `https://2embed.org/e.php?id=${tmdbId}&t=movie`,
      apiUrl: null,
    },
    {
      name: 'Autoembed',
      embedUrl: `https://autoembed.co/movie/tmdb/${tmdbId}`,
      apiUrl: null,
    },
    {
      name: 'NontonGo',
      embedUrl: `https://nontongo.win/movie/${tmdbId}`,
      apiUrl: null,
    },
    {
      name: 'MoviesAPI Club',
      embedUrl: `https://moviesapi.club/movie/${tmdbId}`,
      apiUrl: null,
    },
    {
      name: 'MultiEmbed',
      embedUrl: `https://multiembed.mov/directstream.php?video_id=${tmdbId}&tmdb=1`,
      apiUrl: null,
    },
  ];
  
  for (const p of providers) {
    console.log(`\n  Testing: ${p.name}`);
    
    // Test embed URL
    console.log(`    Embed URL: ${p.embedUrl}`);
    const embedRes = await safeFetch(p.embedUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': 'https://google.com/',
      }
    });
    console.log(`    Embed Status: ${embedRes.status}`);
    
    if (embedRes.ok) {
      const html = await embedRes.text();
      console.log(`    ✅ Got HTML (${html.length} bytes)`);
      
      // Look for stream URLs or iframe sources
      const iframeSrcs = [...html.matchAll(/(?:src|href)=["']([^"']*(?:m3u8|stream|player|embed)[^"']*)/gi)].map(m => m[1]);
      if (iframeSrcs.length > 0) {
        console.log(`    📺 Found ${iframeSrcs.length} stream/embed references:`);
        iframeSrcs.slice(0, 3).forEach(s => console.log(`      - ${s.substring(0, 120)}`));
      }
      
      // Look for m3u8 links directly
      const m3u8Links = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g);
      if (m3u8Links) {
        console.log(`    🎉 DIRECT M3U8 LINKS FOUND!`);
        m3u8Links.forEach(l => console.log(`      - ${l.substring(0, 150)}`));
      }
      
      // Look for source/file URLs
      const fileUrls = html.match(/["'](?:file|source|src|url)["']\s*:\s*["']([^"']+)/g);
      if (fileUrls) {
        console.log(`    📁 File/source URLs found:`);
        fileUrls.slice(0, 3).forEach(f => console.log(`      - ${f.substring(0, 120)}`));
      }
    }
    
    // Test API URL if available
    if (p.apiUrl) {
      console.log(`    API URL: ${p.apiUrl}`);
      const apiRes = await safeFetch(p.apiUrl, {
        headers: { 'Accept': 'application/json' }
      });
      console.log(`    API Status: ${apiRes.status}`);
      if (apiRes.ok) {
        const text = await apiRes.text();
        console.log(`    API Response: ${text.substring(0, 300)}`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// TEST 5: Test VidLink's RSC/App Router Endpoints
// ═══════════════════════════════════════════════════════════
async function test5_rscEndpoints(tmdbId) {
  separator(`TEST 5: RSC / App Router Data Endpoints`);
  
  // Next.js App Router serves RSC payloads with specific headers
  const rscHeaders = {
    'Accept': 'text/x-component',
    'RSC': '1',
    'Next-Router-State-Tree': '%5B%22%22%2C%7B%22children%22%3A%5B%22movie%22%2C%7B%22children%22%3A%5B%5B%22id%22%2C%22' + tmdbId + '%22%2C%22d%22%5D%2C%7B%7D%5D%7D%5D%7D%5D',
    'Referer': `https://vidlink.pro/movie/${tmdbId}`,
    'Next-Url': `/movie/${tmdbId}`,
  };
  
  const rscEndpoints = [
    `https://vidlink.pro/movie/${tmdbId}`,
    `https://vidlink.pro/movie/${tmdbId}?_rsc=1`,
    `https://vidlink.pro/api/stream/movie/${tmdbId}`,
    `https://vidlink.pro/api/source/movie/${tmdbId}`,
  ];
  
  for (const url of rscEndpoints) {
    console.log(`\n  Testing RSC: ${url}`);
    const res = await safeFetch(url, { headers: { ...rscHeaders, 'User-Agent': UA } });
    console.log(`    Status: ${res.status}`);
    console.log(`    Content-Type: ${res.headers?.get?.('content-type') || 'N/A'}`);
    
    if (res.ok) {
      const text = await res.text();
      console.log(`    Response (${text.length} bytes): ${text.substring(0, 300)}`);
      
      // Check for stream data in RSC payload
      if (text.includes('playlist') || text.includes('.m3u8')) {
        console.log(`    🎉 STREAM DATA FOUND IN RSC PAYLOAD!`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  VidLink Server-Side Resolution Test                  ║');
  console.log('║  Testing if we can resolve streams without an iframe  ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  // Test 1: Fetch and analyze embed page
  const pageData = await test1_fetchEmbedPage(TMDB_ID);
  
  // Test 2: Try direct API calls
  const apiResult = await test2_directApiCalls(TMDB_ID);
  
  // Test 3: Analyze JS bundles
  if (pageData?.scriptSrcs) {
    await test3_analyzeJsBundle(pageData.scriptSrcs);
  }
  
  // Test 5: RSC endpoints
  await test5_rscEndpoints(TMDB_ID);
  
  // Test 4: Alternative providers
  await test4_alternativeProviders(TMDB_ID);
  
  // Summary
  separator('SUMMARY');
  console.log(`  VidLink direct API: ${apiResult ? '✅ WORKS' : '❌ Needs iframe/WASM'}`);
  console.log(`  __NEXT_DATA__ stream: ${pageData?.type === 'next_data' ? '✅ Available' : '❌ Not available'}`);
  console.log('');
  console.log('  Recommendation:');
  if (apiResult) {
    console.log('  ✅ Server-side resolution is viable! Direct API call works.');
  } else if (pageData?.type === 'next_data') {
    console.log('  ✅ Server-side resolution is viable! Stream data in __NEXT_DATA__.');
  } else {
    console.log('  ⚠️  VidLink requires client-side execution (likely WASM token).');
    console.log('  → Use alternative providers as primary, VidLink iframe as fallback.');
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
