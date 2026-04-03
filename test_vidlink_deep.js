/**
 * VidLink Deep Dive: Reverse-engineer the stream resolution flow
 * 
 * We know:
 * - RSC endpoint returns 200 with 58KB of page data
 * - The page loads JS bundles that call /api/b/ with a WASM-generated token
 * - We need to find: what params /api/b/ needs, how the token is generated
 * 
 * Strategy:
 * 1. Parse the RSC payload to find component structure & data
 * 2. Download ALL JS bundles from the page
 * 3. Search for /api/b/ call pattern, token generation, WASM loading
 * 4. Try to replicate the API call server-side
 */

const fs = require('fs');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

async function safeFetch(url, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, ...opts.headers },
      ...opts,
    });
    clearTimeout(timeout);
    return res;
  } catch (e) {
    clearTimeout(timeout);
    return { ok: false, status: 'ERR:' + e.message.substring(0, 60), text: async () => '', headers: { get: () => null } };
  }
}

// ═══ STEP 1: Get the full HTML page (with standard Accept to get real HTML) ═══
async function step1_getFullPage(tmdbId) {
  console.log('═══ STEP 1: Fetch VidLink Full HTML Page ═══\n');
  
  // The RSC headers gave us 200. Let's also try getting the full HTML
  // Sometimes Cloudflare blocks based on Accept header
  const approaches = [
    {
      name: 'RSC Accept (confirmed 200)',
      headers: { 'Accept': 'text/x-component', 'RSC': '1', 'Next-Url': `/movie/${tmdbId}` }
    },
    {
      name: 'HTML Accept with Cloudflare cookie sim',
      headers: { 
        'Accept': 'text/html,application/xhtml+xml',
        'Sec-CH-UA': '"Chromium";v="121", "Not A(Brand";v="99"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
      }
    },
  ];
  
  let htmlContent = null;
  let rscContent = null;
  
  for (const approach of approaches) {
    console.log(`  Trying: ${approach.name}`);
    const res = await safeFetch(`https://vidlink.pro/movie/${tmdbId}`, { headers: approach.headers });
    console.log(`    Status: ${res.status}`);
    
    if (res.ok) {
      const text = await res.text();
      const ct = res.headers.get('content-type') || '';
      console.log(`    Content-Type: ${ct}`);
      console.log(`    Size: ${text.length} bytes`);
      
      if (ct.includes('html')) {
        htmlContent = text;
        console.log(`    ✅ Got HTML!`);
        // Check for Cloudflare challenge
        if (text.includes('challenge-platform') || text.includes('cf-turnstile')) {
          console.log(`    ⚠️  Cloudflare challenge page!`);
          htmlContent = null;
        }
      } else if (ct.includes('x-component')) {
        rscContent = text;
        console.log(`    ✅ Got RSC payload`);
      }
    }
  }
  
  return { htmlContent, rscContent };
}

// ═══ STEP 2: Parse RSC payload for JS bundle URLs and component data ═══
async function step2_parseRSC(rscContent, tmdbId) {
  console.log('\n═══ STEP 2: Parse RSC Payload ═══\n');
  
  if (!rscContent) {
    console.log('  ❌ No RSC content');
    return [];
  }
  
  fs.writeFileSync('d:/Netflixweb/test_vidlink_rsc_full.txt', rscContent);
  console.log('  Saved full RSC to test_vidlink_rsc_full.txt');
  
  // RSC payload format: "N:data\n" where N is a numeric ID
  // Parse each line
  const lines = rscContent.split('\n').filter(l => l.trim());
  console.log(`  Lines in RSC payload: ${lines.length}`);
  
  // Extract CSS/JS references
  const cssFiles = [...rscContent.matchAll(/\/_next\/static\/css\/[^"'\s]+/g)].map(m => m[0]);
  const jsFiles = [...rscContent.matchAll(/\/_next\/static\/[^"'\s]*\.js[^"'\s]*/g)].map(m => m[0]);
  const chunkFiles = [...rscContent.matchAll(/\/_next\/static\/chunks\/[^"'\s]+/g)].map(m => m[0]);
  
  console.log(`  CSS files: ${cssFiles.length}`);
  cssFiles.forEach(f => console.log(`    → ${f}`));
  console.log(`  JS files: ${jsFiles.length}`);
  jsFiles.forEach(f => console.log(`    → ${f}`));
  console.log(`  Chunk files: ${chunkFiles.length}`);
  chunkFiles.forEach(f => console.log(`    → ${f}`));
  
  // Look for interesting strings in RSC payload
  const interestingPatterns = [
    { name: 'fetch', regex: /fetch/gi },
    { name: 'api/b', regex: /api\/b/gi },
    { name: 'api/e', regex: /api\/e/gi },
    { name: 'stream', regex: /"stream"/gi },
    { name: 'playlist', regex: /"playlist"/gi },
    { name: 'wasm', regex: /wasm/gi },
    { name: 'token', regex: /"token"/gi },
    { name: 'encrypt', regex: /encrypt|decrypt|cipher/gi },
    { name: 'key', regex: /"key"/gi },
    { name: 'secret', regex: /secret/gi },
    { name: 'tmdbId', regex: /tmdb/gi },
    { name: 'movieId', regex: /movieId|movie_id/gi },
    { name: 'useEffect', regex: /useEffect/gi },
    { name: 'useState', regex: /useState/gi },
    { name: 'WebAssembly', regex: /WebAssembly/gi },
    { name: '.wasm', regex: /\.wasm/gi },
    { name: 'vodvidl', regex: /vodvidl/gi },
    { name: 'proxy', regex: /proxy/gi },
  ];
  
  console.log('\n  Pattern search in RSC payload:');
  for (const p of interestingPatterns) {
    const matches = rscContent.match(p.regex);
    if (matches) {
      console.log(`    ✅ ${p.name}: ${matches.length} matches`);
      // Show context
      let idx = rscContent.search(p.regex);
      if (idx >= 0) {
        const ctx = rscContent.substring(Math.max(0, idx - 60), Math.min(rscContent.length, idx + 120));
        console.log(`       → ...${ctx.replace(/\n/g, '\\n').substring(0, 150)}...`);
      }
    }
  }
  
  // Extract the buildId  
  const buildIdMatch = rscContent.match(/"buildId"\s*:\s*"([^"]+)"/);
  if (buildIdMatch) {
    console.log(`\n  BuildId: ${buildIdMatch[1]}`);
  }
  
  return [...new Set([...jsFiles, ...chunkFiles])];
}

// ═══ STEP 3: Download and analyze VidLink's JS bundles ═══
async function step3_analyzeJsBundles(bundleUrls, tmdbId) {
  console.log('\n═══ STEP 3: Analyze VidLink JS Bundles ═══\n');
  
  // If we couldn't get bundle URLs from RSC, try common Next.js patterns
  if (!bundleUrls || bundleUrls.length === 0) {
    console.log('  No bundle URLs from RSC, trying to get from HTML page...');
    
    // Try fetching the page with HTML Accept
    const res = await safeFetch(`https://vidlink.pro/movie/${tmdbId}`, {
      headers: { 'Accept': 'text/x-component', 'RSC': '1', 'Next-Url': `/movie/${tmdbId}` }
    });
    
    if (res.ok) {
      const text = await res.text();
      bundleUrls = [...new Set([...text.matchAll(/\/_next\/static\/[^"'\s\\]*\.js/g)].map(m => m[0]))];
      console.log(`  Found ${bundleUrls.length} bundle URLs from RSC`);
    }
  }
  
  const results = [];
  
  for (const relUrl of bundleUrls.slice(0, 15)) {  // Check up to 15 bundles
    const fullUrl = `https://vidlink.pro${relUrl}`;
    console.log(`\n  Fetching: ${relUrl}`);
    
    const res = await safeFetch(fullUrl, {
      headers: { 'Referer': 'https://vidlink.pro/', 'Accept': '*/*' }
    });
    
    if (!res.ok) {
      console.log(`    ❌ ${res.status}`);
      continue;
    }
    
    const js = await res.text();
    console.log(`    ✅ ${js.length} bytes`);
    
    // Critical patterns for stream resolution
    const criticalPatterns = [
      { name: '/api/b/', regex: /["']?\/?api\/b\/?["']?/g, priority: 'HIGH' },
      { name: 'fetch.*api', regex: /fetch\s*\(\s*[`"'][^`"']*api[^`"']*/g, priority: 'HIGH' },
      { name: '.m3u8', regex: /\.m3u8/g, priority: 'HIGH' },
      { name: 'playlist', regex: /["']playlist["']/g, priority: 'HIGH' },
      { name: 'stream', regex: /["']stream["']\s*:/g, priority: 'HIGH' },
      { name: 'WebAssembly', regex: /WebAssembly/g, priority: 'HIGH' },
      { name: '.wasm', regex: /\.wasm/g, priority: 'HIGH' },
      { name: 'decrypt', regex: /decrypt/g, priority: 'MED' },
      { name: 'token', regex: /["']token["']/g, priority: 'MED' },
      { name: 'vodvidl|videostr|thunderleaf|skyember', regex: /vodvidl|videostr|thunderleaf|skyember/g, priority: 'HIGH' },
      { name: 'captions|subtitles', regex: /captions|subtitles/g, priority: 'MED' },
      { name: 'intro|outro|skip', regex: /["'](?:intro|outro|skip)["']/g, priority: 'MED' },
    ];
    
    let hasHighPriority = false;
    
    for (const p of criticalPatterns) {
      const matches = js.match(p.regex);
      if (matches) {
        if (p.priority === 'HIGH') hasHighPriority = true;
        console.log(`    ${p.priority === 'HIGH' ? '🎯' : '📋'} ${p.name}: ${matches.length}x`);
        
        // Show context for HIGH priority matches
        if (p.priority === 'HIGH') {
          const regex = new RegExp(p.regex.source, p.regex.flags.replace('g', ''));
          let searchIdx = 0;
          let matchCount = 0;
          while (matchCount < 3) {
            const idx = js.substring(searchIdx).search(regex);
            if (idx < 0) break;
            const absIdx = searchIdx + idx;
            const ctx = js.substring(Math.max(0, absIdx - 80), Math.min(js.length, absIdx + 150));
            console.log(`       → ...${ctx.replace(/\n/g, ' ').replace(/\s+/g, ' ').substring(0, 200)}...`);
            searchIdx = absIdx + 10;
            matchCount++;
          }
        }
      }
    }
    
    if (hasHighPriority) {
      results.push({ url: relUrl, size: js.length, content: js });
      // Save high-priority bundles
      const filename = relUrl.split('/').pop().replace(/[^a-zA-Z0-9._-]/g, '_');
      fs.writeFileSync(`d:/Netflixweb/test_bundle_${filename}`, js);
      console.log(`    💾 Saved to test_bundle_${filename}`);
    }
  }
  
  return results;
}

// ═══ STEP 4: Deep analysis of API call pattern ═══
async function step4_deepApiAnalysis(bundles) {
  console.log('\n═══ STEP 4: Deep API Call Analysis ═══\n');
  
  if (bundles.length === 0) {
    console.log('  ❌ No high-priority bundles found');
    return;
  }
  
  for (const bundle of bundles) {
    console.log(`\n  Analyzing: ${bundle.url} (${bundle.size} bytes)`);
    const js = bundle.content;
    
    // Find the function that calls /api/b/
    // Look for the fetch call and its surrounding context
    const apiBPattern = /api\/b/g;
    let match;
    while ((match = apiBPattern.exec(js)) !== null) {
      // Extract a larger context window
      const start = Math.max(0, match.index - 500);
      const end = Math.min(js.length, match.index + 500);
      const context = js.substring(start, end);
      
      console.log(`\n  ─── /api/b/ context (±500 chars) ───`);
      console.log(context.replace(/\n/g, '\n  '));
      console.log(`  ─── end context ───`);
    }
    
    // Find WASM loading
    const wasmPattern = /(?:WebAssembly|\.wasm)/g;
    while ((match = wasmPattern.exec(js)) !== null) {
      const start = Math.max(0, match.index - 300);
      const end = Math.min(js.length, match.index + 300);
      const context = js.substring(start, end);
      
      console.log(`\n  ─── WASM context (±300 chars) ───`);
      console.log(context.replace(/\n/g, '\n  '));
      console.log(`  ─── end context ───`);
    }
    
    // Find CDN domain references
    const cdnPattern = /vodvidl|videostr|thunderleaf|skyember|storm\./g;
    while ((match = cdnPattern.exec(js)) !== null) {
      const start = Math.max(0, match.index - 200);
      const end = Math.min(js.length, match.index + 200);
      const context = js.substring(start, end);
      
      console.log(`\n  ─── CDN domain context (±200 chars) ───`);
      console.log(context.replace(/\n/g, '\n  '));
      console.log(`  ─── end context ───`);
    }
  }
}

// ═══ STEP 5: Try direct /api/b/ with RSC cookie ═══
async function step5_tryApiWithRSCSession(tmdbId) {
  console.log('\n═══ STEP 5: Try /api/b/ with Full Session Headers ═══\n');
  
  // First get the RSC page to establish a "session"
  const pageRes = await safeFetch(`https://vidlink.pro/movie/${tmdbId}`, {
    headers: { 
      'Accept': 'text/x-component', 
      'RSC': '1', 
      'Next-Url': `/movie/${tmdbId}` 
    }
  });
  
  // Get any Set-Cookie headers
  const cookies = pageRes.headers?.get?.('set-cookie') || 'none';
  console.log(`  Cookies from page: ${cookies.substring(0, 200)}`);
  
  // Now try the API with those cookies
  const apiEndpoints = [
    `/api/b/movie/${tmdbId}`,
    `/api/b/${tmdbId}`,
    `/api/e/movie/${tmdbId}`,
  ];
  
  for (const path of apiEndpoints) {
    const url = `https://vidlink.pro${path}`;
    console.log(`\n  Testing: ${url}`);
    
    // Try with standard JSON request
    const res = await safeFetch(url, {
      headers: {
        'Accept': 'application/json',
        'Referer': `https://vidlink.pro/movie/${tmdbId}`,
        'Origin': 'https://vidlink.pro',
        'Cookie': cookies !== 'none' ? cookies : '',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
      }
    });
    
    console.log(`  Status: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      console.log(`  Response: ${text.substring(0, 500)}`);
    }
  }
}

// ═══ MAIN ═══
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  VidLink Deep Dive: Reverse Engineering               ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  const tmdbId = '550';
  
  const { htmlContent, rscContent } = await step1_getFullPage(tmdbId);
  const bundleUrls = await step2_parseRSC(rscContent, tmdbId);
  const bundles = await step3_analyzeJsBundles(bundleUrls, tmdbId);
  await step4_deepApiAnalysis(bundles);
  await step5_tryApiWithRSCSession(tmdbId);
  
  console.log('\n\n═══ CONCLUSION ═══');
  console.log('Check the saved bundle files for the full /api/b/ calling code.');
  console.log('The key is: what parameters does /api/b/ need and how is the token generated?');
}

main().catch(e => console.error('Fatal:', e));
