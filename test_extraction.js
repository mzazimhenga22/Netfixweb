/**
 * VidSrc.xyz Stream Extraction Test
 * 
 * Chain: vidsrc.xyz → cloudnestra.com/rcp/{base64} → sources.js → actual stream
 * 
 * Also tests: direct VidLink embed (no proxy) as fallback
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
const crypto = require('crypto');

// ═══ TEST 1: VidSrc.xyz Full Chain ═══
async function testVidSrcXyzChain(tmdbId) {
  console.log('═══ VidSrc.xyz Full Extraction Chain ═══\n');
  
  // Step 1: Get embed page
  console.log('Step 1: Get embed page...');
  const embedRes = await fetch(`https://vidsrc.xyz/embed/movie/${tmdbId}`, {
    headers: { 'User-Agent': UA, 'Referer': 'https://google.com/' }
  });
  
  if (!embedRes.ok) { console.log(`  ❌ ${embedRes.status}`); return; }
  const embedHtml = await embedRes.text();
  console.log(`  ✅ Got embed page (${embedHtml.length} bytes)`);
  
  // Step 2: Extract the iframe src (cloudnestra.com/rcp/...)
  const iframeSrcMatch = embedHtml.match(/src=["'](\/\/cloudnestra\.com\/rcp\/[^"']+)/);
  if (!iframeSrcMatch) {
    console.log('  ❌ No cloudnestra iframe found');
    // Try alternative patterns
    const altIframes = [...embedHtml.matchAll(/src=["']((?:https?:)?\/\/[^"']+rcp[^"']+)/g)].map(m => m[1]);
    console.log(`  Alt iframes: ${altIframes.join(', ')}`);
    
    // Also check for direct source URLs
    const allIframes = [...embedHtml.matchAll(/src=["']([^"']+)/g)].map(m => m[1]);
    console.log('  All src attributes:');
    allIframes.filter(s => !s.startsWith('about:') && !s.includes('cloudflare')).forEach(s => console.log(`    → ${s}`));
    return;
  }
  
  const rcpUrl = 'https:' + iframeSrcMatch[1];
  console.log(`  ✅ RCP URL: ${rcpUrl.substring(0, 120)}...`);
  
  // Step 3: Fetch the RCP page
  console.log('\nStep 2: Fetch RCP endpoint...');
  const rcpRes = await fetch(rcpUrl, {
    headers: {
      'User-Agent': UA,
      'Referer': 'https://vidsrc.xyz/',
      'Accept': 'text/html',
    }
  });
  
  if (!rcpRes.ok) { console.log(`  ❌ ${rcpRes.status}`); return; }
  const rcpHtml = await rcpRes.text();
  console.log(`  ✅ Got RCP page (${rcpHtml.length} bytes)`);
  
  // Look for embedded data
  const scriptBlocks = [...rcpHtml.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim().length > 0);
  console.log(`  Script blocks: ${scriptBlocks.length}`);
  
  for (let i = 0; i < scriptBlocks.length; i++) {
    const block = scriptBlocks[i];
    if (block.length < 50) continue;
    console.log(`\n  Script block ${i} (${block.length} bytes):`);
    console.log(`    Preview: ${block.substring(0, 300).replace(/\n/g, ' ')}...`);
    
    // Check for stream patterns
    if (block.includes('.m3u8')) console.log('    🎉 Contains .m3u8!');
    if (block.includes('source')) console.log('    📋 Contains "source"');
    if (block.includes('player')) console.log('    📋 Contains "player"');
    if (block.includes('file')) console.log('    📋 Contains "file"');
    if (block.includes('fetch')) console.log('    📋 Contains "fetch"');
    if (block.includes('atob')) console.log('    📋 Contains "atob" (base64)');
    if (block.includes('eval')) console.log('    📋 Contains "eval"');
    if (block.includes('decrypt')) console.log('    📋 Contains "decrypt"');
    if (block.includes('/api/')) console.log('    📋 Contains "/api/"');
    
    // Extract URLs
    const urls = block.match(/["'](https?:\/\/[^"']+)/g);
    if (urls) {
      console.log(`    URLs found:`);
      urls.forEach(u => console.log(`      → ${u}`));
    }
    
    // Extract fetch() calls
    const fetches = block.match(/fetch\s*\(\s*["'][^"']+/g);
    if (fetches) {
      console.log(`    fetch() calls:`);
      fetches.forEach(f => console.log(`      → ${f}`));
    }
  }
  
  // Look for sources.js URL
  const sourcesJsMatch = rcpHtml.match(/src=["']([^"']*sources\.js[^"']*)/);
  if (sourcesJsMatch) {
    console.log(`\n  Found sources.js: ${sourcesJsMatch[1]}`);
    const sourcesUrl = sourcesJsMatch[1].startsWith('http') ? sourcesJsMatch[1] : 
                       sourcesJsMatch[1].startsWith('//') ? 'https:' + sourcesJsMatch[1] :
                       new URL(sourcesJsMatch[1], rcpUrl).href;
    
    const sjsRes = await fetch(sourcesUrl, {
      headers: { 'User-Agent': UA, 'Referer': rcpUrl }
    });
    if (sjsRes.ok) {
      const sjsContent = await sjsRes.text();
      console.log(`  sources.js content (${sjsContent.length} bytes):`);
      console.log(`    ${sjsContent.substring(0, 500).replace(/\n/g, ' ')}...`);
      
      // Look for API endpoints
      const apiUrls = sjsContent.match(/["'](\/[^"']+)/g);
      if (apiUrls) {
        console.log(`  API paths in sources.js:`);
        apiUrls.slice(0, 10).forEach(u => console.log(`    → ${u}`));
      }
    }
  }
}

// ═══ TEST 2: VidSrc.xyz Source API ═══
async function testVidSrcSourceApi(tmdbId) {
  console.log('\n\n═══ VidSrc.xyz Source/API Endpoints ═══\n');
  
  // Try various API patterns
  const endpoints = [
    `https://vidsrc.xyz/api/episodes/${tmdbId}/0/0`,
    `https://vidsrc.xyz/api/source/${tmdbId}`,
    `https://vidsrc.xyz/api/servers/${tmdbId}`,
    `https://vidsrc.xyz/embed/movie/${tmdbId}/sources`,
  ];
  
  for (const url of endpoints) {
    console.log(`\n  Testing: ${url}`);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Referer': 'https://vidsrc.xyz/' }
      });
      console.log(`  Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`  Response (${text.length} bytes): ${text.substring(0, 300)}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
}

// ═══ TEST 3: VidSrc.to API ═══
async function testVidSrcTo(tmdbId) {
  console.log('\n\n═══ VidSrc.to API Chain ═══\n');
  
  // VidSrc.to has a documented API
  const endpoints = [
    `https://vidsrc.to/embed/movie/${tmdbId}`,
    `https://vidsrc.to/ajax/embed/movie?tmdb=${tmdbId}`,
    `https://vidsrc.to/ajax/movie?tmdb=${tmdbId}`,
  ];
  
  for (const url of endpoints) {
    console.log(`\n  Testing: ${url}`);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          'Referer': 'https://vidsrc.to/',
          'Accept': 'application/json, text/html',
          'X-Requested-With': 'XMLHttpRequest',
        }
      });
      console.log(`  Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`  Response (${text.length} bytes): ${text.substring(0, 400)}`);
        
        // Check for redirects or embedded sources  
        const srcMatch = text.match(/src=["'](https?:\/\/[^"']+)/);
        if (srcMatch) {
          console.log(`  Embedded source: ${srcMatch[1]}`);
          
          // Follow the source
          console.log(`\n  Following embedded source...`);
          const innerRes = await fetch(srcMatch[1], {
            headers: { 'User-Agent': UA, 'Referer': 'https://vidsrc.to/' }
          });
          console.log(`  Inner status: ${innerRes.status}`);
          if (innerRes.ok) {
            const innerHtml = await innerRes.text();
            console.log(`  Inner size: ${innerHtml.length} bytes`);
            console.log(`  Preview: ${innerHtml.substring(0, 300)}`);
          }
        }
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
}

// ═══ TEST 4: Direct VidLink Embed (no proxy) ═══
async function testDirectVidLinkEmbed(tmdbId) {
  console.log('\n\n═══ Direct VidLink Embed Test ═══\n');
  console.log('Testing if VidLink embed can be loaded directly (no proxy)...');
  console.log('This tests whether using VidLink as a direct embed player is viable.\n');
  
  // Test with different approaches
  const approaches = [
    {
      name: 'Standard HTML Accept',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Sec-Fetch-Dest': 'iframe',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Referer': 'https://scarletscreen.netlify.app/',
      }
    },
    {
      name: 'RSC Accept (gets 200)',  
      headers: {
        'Accept': 'text/x-component',
        'RSC': '1',
        'Next-Url': `/movie/${tmdbId}`,
      }
    },
    {
      name: 'Embed-like headers',
      headers: {
        'Accept': 'text/html',
        'Sec-Fetch-Dest': 'iframe',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      }
    },
  ];
  
  for (const approach of approaches) {
    console.log(`  Approach: ${approach.name}`);
    const res = await fetch(`https://vidlink.pro/movie/${tmdbId}`, {
      headers: { 'User-Agent': UA, ...approach.headers }
    });
    console.log(`    Status: ${res.status}`);
    if (res.ok) {
      const ct = res.headers.get('content-type');
      const text = await res.text();
      console.log(`    Content-Type: ${ct}`);
      console.log(`    Size: ${text.length} bytes`);
      
      // Check if it's a Cloudflare challenge page
      if (text.includes('cf-challenge') || text.includes('challenge-platform')) {
        console.log('    ⚠️ Cloudflare challenge detected');
      }
      if (text.includes('Checking your browser')) {
        console.log('    ⚠️ Cloudflare browser check page');
      }
      
      // Check for actual page content
      if (text.includes('<video') || text.includes('player')) {
        console.log('    ✅ Contains player markup');
      }
    }
    console.log('');
  }
  
  // Test if X-Frame-Options blocks embedding
  console.log('  Checking embedding headers...');
  const headRes = await fetch(`https://vidlink.pro/movie/${tmdbId}`, {
    method: 'HEAD',
    headers: { 'User-Agent': UA, 'Accept': 'text/html' }
  });
  const xfo = headRes.headers.get('x-frame-options');
  const csp = headRes.headers.get('content-security-policy');
  console.log(`    X-Frame-Options: ${xfo || 'NOT SET (embedding allowed)'}`);
  console.log(`    CSP frame-ancestors: ${csp ? (csp.includes('frame-ancestors') ? 'SET' : 'NOT SET') : 'NO CSP'}`);
}

// ═══ TEST 5: VidSrc.xyz Sources.js Deep Look ═══  
async function testSourcesJs() {
  console.log('\n\n═══ VidSrc.xyz sources.js Analysis ═══\n');
  
  try {
    const res = await fetch('https://vidsrc.xyz/sources.js?t=1745104089', {
      headers: { 'User-Agent': UA, 'Referer': 'https://vidsrc.xyz/' }
    });
    
    if (!res.ok) {
      console.log(`  ❌ ${res.status}`);
      return;
    }
    
    const js = await res.text();
    console.log(`  ✅ Got sources.js (${js.length} bytes)\n`);
    console.log(`  Full content:\n`);
    console.log(js.substring(0, 3000));
    if (js.length > 3000) {
      console.log(`\n  ... (${js.length - 3000} more bytes)`);
      console.log(js.substring(js.length - 1000));
    }
    
    // Save to file
    const fs = require('fs');
    fs.writeFileSync('d:/Netflixweb/test_sources_js.txt', js);
    console.log('\n  Saved to test_sources_js.txt');
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }
}

// ═══ MAIN ═══
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  Provider Chain Extraction Test                       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  const tmdbId = '550'; // Fight Club
  
  await testVidSrcXyzChain(tmdbId);
  await testSourcesJs();
  await testVidSrcSourceApi(tmdbId);
  await testVidSrcTo(tmdbId);
  await testDirectVidLinkEmbed(tmdbId);
  
  console.log('\n\n═══ FINAL VERDICT ═══\n');
  console.log('Based on the results above, the recommended approach is:');
  console.log('1. If VidSrc.xyz sources.js extraction works → use it as primary');
  console.log('2. If VidLink direct embed works → use it as iframe player fallback');
  console.log('3. Keep HLS proxy for whatever stream URL we extract');
}

main().catch(e => console.error('Fatal:', e));
