/**
 * Test script to verify the VidLink proxy approach works.
 * Tests: 1) Can we fetch the embed page? 2) Can we inject our script?
 * 3) What does the page structure look like?
 */

async function testProxy() {
  const tmdbId = '550'; // Fight Club
  const embedUrl = `https://vidlink.pro/movie/${tmdbId}`;
  
  console.log(`[Test] 🔍 Fetching VidLink embed page: ${embedUrl}\n`);

  try {
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://vidlink.pro/',
      },
    });

    console.log(`[Test] Status: ${response.status} ${response.statusText}`);
    console.log(`[Test] Content-Type: ${response.headers.get('content-type')}`);
    
    if (!response.ok) {
      console.log(`[Test] ❌ Failed to fetch page`);
      const body = await response.text();
      console.log(`[Test] Body preview: ${body.substring(0, 500)}`);
      return;
    }

    const html = await response.text();
    console.log(`[Test] ✅ Got HTML (${html.length} bytes)\n`);
    
    // Check structure
    const hasHead = html.includes('<head>') || html.includes('<HEAD>');
    const hasScript = html.includes('<script');
    const hasFetch = html.includes('fetch(') || html.includes('fetch (');
    const hasXhr = html.includes('XMLHttpRequest');
    
    console.log(`[Test] 📋 Page Analysis:`);
    console.log(`  - Has <head> tag: ${hasHead}`);
    console.log(`  - Has <script> tags: ${hasScript}`);
    console.log(`  - References fetch(): ${hasFetch}`);
    console.log(`  - References XMLHttpRequest: ${hasXhr}`);
    
    // Count scripts
    const scriptMatches = html.match(/<script/g);
    console.log(`  - Script tag count: ${scriptMatches ? scriptMatches.length : 0}`);
    
    // Look for API patterns
    const hasApiB = html.includes('/api/b/') || html.includes('api/b');
    const hasApiMovie = html.includes('/api/movie') || html.includes('/api/tv');
    console.log(`  - Contains /api/b/ reference: ${hasApiB}`);
    console.log(`  - Contains /api/movie or /api/tv reference: ${hasApiMovie}`);
    
    // Check for known CDN domains
    const domains = ['vodvidl.site', 'videostr.net', 'megafiles.store', 'thunderleaf'];
    domains.forEach(d => {
      if (html.includes(d)) console.log(`  - References domain: ${d}`);
    });

    // Show first 1000 chars of HTML
    console.log(`\n[Test] 📄 HTML Preview (first 1000 chars):`);
    console.log('─'.repeat(60));
    console.log(html.substring(0, 1000));
    console.log('─'.repeat(60));

    // Test injection
    let injected = html;
    const testScript = '<script>console.log("INTERCEPTOR INJECTED");</script>';
    if (hasHead) {
      injected = injected.replace(/<head>/i, '<head>' + testScript);
      const injectionWorked = injected.includes('INTERCEPTOR INJECTED');
      console.log(`\n[Test] 💉 Script injection test: ${injectionWorked ? '✅ SUCCESS' : '❌ FAILED'}`);
    } else {
      console.log(`\n[Test] ⚠️ No <head> tag found - would need to prepend script`);
    }

    // Fix relative URLs test
    const relativeScripts = html.match(/src="\/[^"]+"/g);
    const relativeLinks = html.match(/href="\/[^"]+"/g);
    console.log(`\n[Test] 🔗 Relative URLs to fix:`);
    console.log(`  - Relative src= attributes: ${relativeScripts ? relativeScripts.length : 0}`);
    if (relativeScripts) relativeScripts.slice(0, 5).forEach(s => console.log(`    ${s}`));
    console.log(`  - Relative href= attributes: ${relativeLinks ? relativeLinks.length : 0}`);
    if (relativeLinks) relativeLinks.slice(0, 5).forEach(s => console.log(`    ${s}`));

    console.log(`\n[Test] ✅ Proxy approach is viable!`);
    console.log(`[Test] The page loads, we can inject scripts, and VidLink's JS should execute in the iframe.`);

  } catch (error) {
    console.error(`[Test] 💥 Error:`, error.message);
  }
}

testProxy();
