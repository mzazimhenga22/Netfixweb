/**
 * Multi-Provider Stream Extraction Test
 * 
 * Tests server-side stream extraction from MULTIPLE providers
 * to find working ones that return clean m3u8 URLs without ads.
 * 
 * Providers tested:
 * 1. VidSrc.cc - newer VidSrc variant
 * 2. embed.su - known for clean API
 * 3. vidsrc.icu - another VidSrc mirror
 * 4. autoembed.cc - aggregator with extraction chain
 * 5. 2embed.cc - alternate embed service
 * 6. vidsrc.net - documented JSON API
 * 7. multiembed.mov - direct stream PHP endpoint
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

async function safeFetch(url, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, ...opts.headers },
      redirect: 'follow',
      ...opts,
    });
    clearTimeout(timeout);
    return res;
  } catch (e) {
    clearTimeout(timeout);
    return { ok: false, status: 'ERR', statusText: e.message?.substring(0, 80) || 'unknown', text: async () => '', json: async () => null, headers: { get: () => null } };
  }
}

async function analyzeProvider(name, url, referer) {
  console.log(`\n  🔍 ${name}`);
  console.log(`     URL: ${url}`);
  
  const res = await safeFetch(url, {
    headers: { 'Referer': referer || url, 'Accept': 'text/html,application/json,*/*' }
  });
  
  console.log(`     Status: ${res.status} ${res.statusText || ''}`);
  
  if (!res.ok) return null;
  
  const text = await res.text();
  console.log(`     Size: ${text.length} bytes`);
  
  // Check for m3u8 URLs
  const m3u8s = text.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g);
  if (m3u8s) {
    console.log(`     🎉 M3U8 URLs FOUND!`);
    m3u8s.forEach(u => console.log(`        → ${u}`));
    return { type: 'direct_m3u8', urls: m3u8s };
  }
  
  // Check for JSON with stream data
  try {
    const json = JSON.parse(text);
    if (json) {
      console.log(`     📋 JSON response, keys: ${Object.keys(json).join(', ')}`);
      const jsonStr = JSON.stringify(json);
      const m3u8InJson = jsonStr.match(/https?:\\\/\\\/[^\s"']+\.m3u8[^\s"']*/g);
      if (m3u8InJson) {
        console.log(`     🎉 M3U8 in JSON!`);
        m3u8InJson.forEach(u => console.log(`        → ${u.replace(/\\\//g, '/')}`));
        return { type: 'json_m3u8', data: json };
      }
      // Show first level values
      for (const [k, v] of Object.entries(json)) {
        if (typeof v === 'string') console.log(`        ${k}: ${String(v).substring(0, 100)}`);
        else if (typeof v === 'object' && v) console.log(`        ${k}: {${Object.keys(v).join(', ')}}`);
      }
      return { type: 'json', data: json };
    }
  } catch {}
  
  // Check for iframe/embed sources 
  const embedSrcs = [...text.matchAll(/(?:src|data-src|href)=["'](https?:\/\/[^"']+(?:embed|player|stream|video)[^"']*)/gi)].map(m => m[1]);
  if (embedSrcs.length > 0) {
    console.log(`     📺 Embed sources: ${embedSrcs.length}`);
    embedSrcs.slice(0, 5).forEach(s => console.log(`        → ${s}`));
    return { type: 'embed', sources: embedSrcs };
  }
  
  // Check for JS-based sources
  const fileSrcs = text.match(/["'](?:file|source|src|sources)\s*["']\s*:\s*["']([^"']+)/gi);
  if (fileSrcs) {
    console.log(`     📁 Source references:`);
    fileSrcs.slice(0, 5).forEach(s => console.log(`        → ${s}`));
    return { type: 'js_source', sources: fileSrcs };
  }
  
  // Show first 300 chars for debugging
  console.log(`     Preview: ${text.substring(0, 200).replace(/\n/g, ' ')}`);
  return { type: 'html', size: text.length };
}

async function followChain(name, url, referer, depth = 0) {
  if (depth > 3) {
    console.log(`        (max chain depth reached)`);
    return null;
  }
  
  const result = await analyzeProvider(`${name} (depth ${depth})`, url, referer);
  if (!result) return null;
  if (result.type === 'direct_m3u8' || result.type === 'json_m3u8') return result;
  
  // Follow embed chain
  if (result.type === 'embed' && result.sources?.length > 0) {
    for (const src of result.sources.slice(0, 2)) {
      const chainResult = await followChain(name, src, url, depth + 1);
      if (chainResult && (chainResult.type === 'direct_m3u8' || chainResult.type === 'json_m3u8')) {
        return chainResult;
      }
    }
  }
  
  return result;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  Multi-Provider Server-Side Extraction Test       ║');
  console.log('╚════════════════════════════════════════════════════╝');
  
  const tmdbId = '550'; // Fight Club
  const imdbId = 'tt0137523';
  
  const providers = [
    // API-style providers (JSON response expected)
    { name: 'VidSrc.cc (embed)', url: `https://vidsrc.cc/v2/embed/movie/${tmdbId}`, referer: 'https://vidsrc.cc/' },
    { name: 'VidSrc.cc (API)', url: `https://vidsrc.cc/v2/api/movie/${tmdbId}`, referer: 'https://vidsrc.cc/' },
    { name: 'embed.su (movie)', url: `https://embed.su/embed/movie/${tmdbId}`, referer: 'https://embed.su/' },
    { name: 'embed.su (API)', url: `https://embed.su/api/movie/${tmdbId}`, referer: 'https://embed.su/' },
    { name: 'VidSrc.icu (embed)', url: `https://vidsrc.icu/embed/movie/${tmdbId}`, referer: 'https://vidsrc.icu/' },
    { name: 'VidSrc.icu (API)', url: `https://vidsrc.icu/api/movie/${tmdbId}`, referer: 'https://vidsrc.icu/' },
    { name: 'VidSrc.net (embed)', url: `https://vidsrc.net/embed/movie/${tmdbId}`, referer: 'https://vidsrc.net/' },
    { name: 'AutoEmbed.cc', url: `https://autoembed.cc/embed/movie/${tmdbId}`, referer: 'https://autoembed.cc/' },
    { name: 'SuperEmbed.stream', url: `https://multiembed.mov/directstream.php?video_id=${tmdbId}&tmdb=1`, referer: 'https://multiembed.mov/' },
    { name: '2embed.cc', url: `https://2embed.cc/embed/${tmdbId}`, referer: 'https://2embed.cc/' },
    { name: 'NontonGo.win', url: `https://nontongo.win/embed/movie/${tmdbId}`, referer: 'https://nontongo.win/' },
    { name: 'VidBinge', url: `https://vidbinge.dev/embed/movie/${tmdbId}`, referer: 'https://vidbinge.dev/' },
    { name: 'Filmxy', url: `https://filmxy.wafflehacker.io/api/watch?type=movie&id=${tmdbId}`, referer: 'https://filmxy.wafflehacker.io/' },
    // VidSrc.pro API endpoints
    { name: 'VidSrc.pro (embed)', url: `https://vidsrc.pro/embed/movie/${tmdbId}`, referer: 'https://vidsrc.pro/' },
    { name: 'VidSrc.in (embed)', url: `https://vidsrc.in/embed/movie/${tmdbId}`, referer: 'https://vidsrc.in/' },
  ];
  
  const results = {};
  
  for (const p of providers) {
    const result = await followChain(p.name, p.url, p.referer);
    results[p.name] = result;
  }
  
  // ─── Summary ───
  console.log('\n\n╔═══════════════════════════════════════════════════╗');
  console.log('║                  RESULTS SUMMARY                  ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');
  
  const working = [];
  const partial = [];
  const failed = [];
  
  for (const [name, result] of Object.entries(results)) {
    if (!result) {
      failed.push(name);
    } else if (result.type === 'direct_m3u8' || result.type === 'json_m3u8') {
      working.push(name);
    } else {
      partial.push(name);
    }
  }
  
  console.log('  ✅ WORKING (direct m3u8):');
  if (working.length === 0) console.log('     (none)');
  working.forEach(n => console.log(`     → ${n}`));
  
  console.log('\n  ⚠️  PARTIAL (reachable, needs extraction):');
  if (partial.length === 0) console.log('     (none)');
  partial.forEach(n => console.log(`     → ${n} [${results[n]?.type}]`));
  
  console.log('\n  ❌ FAILED (unreachable):');
  if (failed.length === 0) console.log('     (none)');
  failed.forEach(n => console.log(`     → ${n}`));
}

main().catch(e => console.error('Fatal:', e));
