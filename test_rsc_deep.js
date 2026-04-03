/**
 * Deep dive into VidLink's RSC payload and VidSrc.xyz embed page
 * to find usable stream URLs or API patterns
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

async function testRSCPayload() {
  console.log('═══ TEST A: VidLink RSC Payload Deep Analysis ═══\n');
  
  const tmdbId = '550';
  
  // The RSC endpoint responded 200 with the RSC Accept header
  const res = await fetch(`https://vidlink.pro/movie/${tmdbId}`, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/x-component',
      'RSC': '1',
      'Referer': `https://vidlink.pro/movie/${tmdbId}`,
      'Next-Url': `/movie/${tmdbId}`,
    }
  });
  
  console.log(`Status: ${res.status}`);
  const text = await res.text();
  console.log(`Response size: ${text.length} bytes\n`);
  
  // Save full response for analysis
  const fs = require('fs');
  fs.writeFileSync('d:/Netflixweb/test_rsc_output.txt', text);
  console.log('Full RSC response saved to test_rsc_output.txt');
  
  // Look for stream-related data
  const patterns = [
    /playlist['":\s]*['"]([^'"]+\.m3u8[^'"]*)/gi,
    /https?:\/\/[^\s'"]+\.m3u8[^\s'"]*/g,
    /stream['":\s]*\{[^}]+\}/g,
    /vodvidl/gi,
    /videostr/gi,
    /thunderleaf/gi,
    /skyember/gi,
    /api\/b/gi,
    /wasm/gi,
    /decrypt/gi,
    /token/gi,
    /embed/gi,
  ];
  
  console.log('\nPattern search results:');
  for (const p of patterns) {
    const matches = text.match(p);
    if (matches) {
      console.log(`  ✅ ${p.source}: ${matches.length} matches`);
      matches.slice(0, 3).forEach(m => console.log(`     → ${m.substring(0, 150)}`));
    } else {
      console.log(`  ❌ ${p.source}: no matches`);
    }
  }
  
  // Look for the /api/b/ fetch call pattern in the RSC payload
  // The RSC payload contains serialized React elements with their JS code
  const apiPattern = /api\/b/g;
  let match;
  while ((match = apiPattern.exec(text)) !== null) {
    const ctx = text.substring(Math.max(0, match.index - 100), Math.min(text.length, match.index + 200));
    console.log(`\n  Context around api/b:\n    ...${ctx.replace(/\n/g, ' ')}...`);
  }
  
  // Look for fetch/axios patterns
  const fetchPattern = /fetch\s*\(/g;
  while ((match = fetchPattern.exec(text)) !== null) {
    const ctx = text.substring(Math.max(0, match.index - 30), Math.min(text.length, match.index + 150));
    console.log(`\n  fetch() call:\n    ...${ctx.replace(/\n/g, ' ')}...`);
  }
}

async function testVidSrcXyz() {
  console.log('\n\n═══ TEST B: VidSrc.xyz Deep Analysis ═══\n');
  
  const tmdbId = '550';
  
  // Get embed page
  const res = await fetch(`https://vidsrc.xyz/embed/movie/${tmdbId}`, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html',
      'Referer': 'https://google.com/',
    }
  });
  
  console.log(`Status: ${res.status}`);
  const html = await res.text();
  console.log(`Size: ${html.length} bytes\n`);
  
  // Look for iframe sources, API endpoints
  const iframeSrcs = [...html.matchAll(/(?:src|data-src)=["']([^"']+)/gi)].map(m => m[1]);
  console.log(`Sources found: ${iframeSrcs.length}`);
  iframeSrcs.forEach(s => console.log(`  → ${s}`));
  
  // Look for JavaScript with stream logic
  const scriptContent = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  console.log(`\nInline script content size: ${scriptContent.length} bytes`);
  
  if (scriptContent.length > 0) {
    // Check for API calls
    const apiURLs = scriptContent.match(/["'](https?:\/\/[^"']+)/g);
    if (apiURLs) {
      console.log(`\nAPI URLs in scripts:`);
      apiURLs.forEach(u => console.log(`  → ${u}`));
    }
    
    // Look for source/file references
    const sources = scriptContent.match(/(?:source|file|url|src)\s*[=:]\s*["']([^"']+)/gi);
    if (sources) {
      console.log(`\nSource references:`);
      sources.forEach(s => console.log(`  → ${s}`));
    }
  }
  
  // Try to follow the embed chain — get the inner iframe
  const innerIframes = html.match(/src=["'](https?:\/\/[^"']+)/g);
  if (innerIframes) {
    for (const src of innerIframes) {
      const url = src.replace(/src=["']/, '');
      if (url.includes('vidsrc') || url.includes('embed') || url.includes('player')) {
        console.log(`\n  Following inner iframe: ${url}`);
        try {
          const innerRes = await fetch(url, {
            headers: {
              'User-Agent': UA,
              'Referer': `https://vidsrc.xyz/embed/movie/${tmdbId}`,
            }
          });
          if (innerRes.ok) {
            const innerHtml = await innerRes.text();
            console.log(`    Got inner page (${innerHtml.length} bytes)`);
            
            const m3u8s = innerHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g);
            if (m3u8s) {
              console.log(`    🎉 M3U8 FOUND IN INNER PAGE!`);
              m3u8s.forEach(m => console.log(`      → ${m}`));
            }
            
            // Find more nested sources
            const nestedSrcs = [...innerHtml.matchAll(/(?:src|data-src|file|source|url)=?["']?\s*[:=]\s*["'](https?:\/\/[^"'\s]+)/gi)].map(m => m[1]);
            if (nestedSrcs.length > 0) {
              console.log(`    Nested sources:`);
              nestedSrcs.slice(0, 5).forEach(s => console.log(`      → ${s}`));
            }
          }
        } catch (e) {
          console.log(`    Error: ${e.message}`);
        }
      }
    }
  }
}

async function testVidSrcTo() {
  console.log('\n\n═══ TEST C: VidSrc.to → vsembed.ru Chain ═══\n');
  
  const tmdbId = '550';
  
  // VidSrc.to redirects to vsembed.ru
  const embedUrl = 'https://vsembed.ru/embed/movie/550/';
  console.log(`Testing: ${embedUrl}`);
  
  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html',
      'Referer': 'https://vidsrc.to/',
    },
    redirect: 'follow',
  });
  
  console.log(`Status: ${res.status}`);
  if (res.ok) {
    const html = await res.text();
    console.log(`Size: ${html.length} bytes`);
    
    // Look for player configuration
    const configs = html.match(/(?:player|config|setup|source)\s*[=:({]\s*[\[{]["']?[^;]{10,200}/gi);
    if (configs) {
      console.log(`\nPlayer configs:`);
      configs.forEach(c => console.log(`  → ${c.substring(0, 200)}`));
    }
    
    // Look for API/data fetch
    const fetches = html.match(/fetch\s*\(["'][^"']+/g);
    if (fetches) {
      console.log(`\nfetch() calls:`);
      fetches.forEach(f => console.log(`  → ${f}`));
    }
    
    // Look for API endpoints
    const apiUrls = html.match(/["'](\/api\/[^"']+)/g);
    if (apiUrls) {
      console.log(`\nAPI endpoints:`);
      apiUrls.forEach(u => console.log(`  → ${u}`));
    }
    
    // Save for analysis
    const fs = require('fs');
    fs.writeFileSync('d:/Netflixweb/test_vsembed_output.txt', html.substring(0, 5000));
  }
}

async function testMoviesApiClub() {
  console.log('\n\n═══ TEST D: MoviesAPI Club → vidora.stream Chain ═══\n');
  
  // MoviesAPI returned: vidora.stream/embed/e5ccbb10n1xp
  const embedUrl = 'https://vidora.stream/embed/e5ccbb10n1xp';
  console.log(`Testing: ${embedUrl}`);
  
  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html',
      'Referer': 'https://moviesapi.club/',
    },
    redirect: 'follow',
  });
  
  console.log(`Status: ${res.status}`);
  if (res.ok) {
    const html = await res.text();
    console.log(`Size: ${html.length} bytes`);
    
    // Look for m3u8
    const m3u8s = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g);
    if (m3u8s) {
      console.log(`🎉 M3U8 FOUND!`);
      m3u8s.forEach(m => console.log(`  → ${m}`));
    }
    
    // Look for source/file
    const sources = html.match(/["'](?:file|source|src|url)["']\s*:\s*["']([^"']+)/gi);
    if (sources) {
      console.log(`\nSources:`);
      sources.forEach(s => console.log(`  → ${s}`));
    }
    
    // Look for eval/packed/obfuscated
    if (html.includes('eval(')) console.log('  ⚠️ Contains eval() - obfuscated');
    if (html.includes('atob(')) console.log('  ⚠️ Contains atob() - base64 encoded');
    
    // Save
    const fs = require('fs');
    fs.writeFileSync('d:/Netflixweb/test_vidora_output.txt', html.substring(0, 5000));
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Deep Provider Analysis                       ║');
  console.log('╚════════════════════════════════════════════════╝\n');
  
  await testRSCPayload();
  await testVidSrcXyz();
  await testVidSrcTo();
  await testMoviesApiClub();
  
  console.log('\n\n═══ FINAL SUMMARY ═══');
  console.log('Check the saved output files for complete data.');
}

main().catch(e => console.error('Fatal:', e));
