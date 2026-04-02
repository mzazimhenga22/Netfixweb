import { NextResponse } from 'next/server';

/**
 * VidLink Proxy Resolver
 * 
 * Serves VidLink's embed page through our domain with an interceptor
 * script injected to capture the /api/b/ response containing the m3u8 URL.
 * 
 * Key design decisions:
 * - Static resources (script/link/img tags in HTML) → rewritten to absolute
 *   vidlink.pro URLs. Script/CSS tags are CORS-exempt so this works.
 * - Dynamic fetch/XHR calls (VidLink's API) → intercepted and routed through
 *   our /api/vidlink/proxy/ route to avoid CORS. We capture /api/b/ responses.
 * - Dynamic script creation → intercept createElement to rewrite src URLs
 *   to absolute vidlink.pro URLs (CORS-exempt for script tags).
 */

const INTERCEPTOR_SCRIPT = `
<script>
(function() {
  let resolved = false;
  const PROXY_BASE = '/api/vidlink/proxy/';
  const VIDLINK_ORIGIN = 'https://vidlink.pro';

  function dbg(msg) {
    try {
      window.parent.postMessage({ type: 'VIDLINK_DEBUG', data: msg }, '*');
    } catch(e) {}
  }

  // Helper: rewrite a URL for fetch/XHR (goes through our proxy to avoid CORS)
  function proxyUrl(url) {
    if (typeof url !== 'string') return url;
    // Already absolute to vidlink.pro? Route through proxy
    if (url.startsWith(VIDLINK_ORIGIN + '/')) {
      return PROXY_BASE + url.substring(VIDLINK_ORIGIN.length + 1);
    }
    if (url.startsWith(VIDLINK_ORIGIN)) {
      return PROXY_BASE + url.substring(VIDLINK_ORIGIN.length);
    }
    // Root-relative path? Route through proxy
    if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith(PROXY_BASE)) {
      return PROXY_BASE + url.substring(1);
    }
    // Relative path (no leading slash)? Route through proxy
    if (!url.startsWith('http') && !url.startsWith('//') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      return PROXY_BASE + url;
    }
    return url;
  }

  // Helper: rewrite a URL for script/link/img tags (direct to vidlink.pro, CORS-exempt)
  function directUrl(url) {
    if (typeof url !== 'string') return url;
    if (url.startsWith('/') && !url.startsWith('//')) {
      return VIDLINK_ORIGIN + url;
    }
    if (!url.startsWith('http') && !url.startsWith('//') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      return VIDLINK_ORIGIN + '/' + url;
    }
    return url;
  }

  // Blocked URLs - analytics/tracking that waste time
  const BLOCKED = ['cdn-cgi/rum', 'cdn-cgi/trace', 'cdn-cgi/beacon', 'analytics', 'sentry'];
  function isBlocked(url) {
    return BLOCKED.some(function(b) { return url.includes(b); });
  }

  dbg('Interceptor injected, hooking fetch, XHR, and DOM...');

  // ─── 1. Intercept fetch() ───
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    let url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    const originalUrl = url;
    
    // Block analytics/tracking requests instantly
    if (isBlocked(originalUrl)) {
      dbg('BLOCKED: ' + originalUrl.substring(0, 80));
      return Promise.resolve(new Response('', { status: 204 }));
    }
    
    // Rewrite URL to go through our proxy
    if (typeof args[0] === 'string') {
      args[0] = proxyUrl(args[0]);
    } else if (args[0] && args[0].url) {
      args[0] = new Request(proxyUrl(args[0].url), args[0]);
    }
    
    const fetchUrl = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    dbg('FETCH: ' + originalUrl.substring(0, 100) + ' → ' + fetchUrl.substring(0, 100));

    return originalFetch.apply(this, args).then(async response => {
      // Check BOTH original and proxied URL for /api/b/ match
      if (!resolved && (originalUrl.includes('/api/b/') || fetchUrl.includes('/api/b/'))) {
        dbg('MATCH! /api/b/ found, reading response...');
        try {
          const clone = response.clone();
          const text = await clone.text();
          dbg('Response length: ' + text.length);
          const json = JSON.parse(text);
          if (json && json.stream && json.stream.playlist) {
            resolved = true;
            dbg('SUCCESS! Playlist found: ' + json.stream.playlist.substring(0, 80));
            window.parent.postMessage({
              type: 'VIDLINK_STREAM',
              data: json
            }, '*');
          } else {
            dbg('No stream.playlist in response keys: ' + Object.keys(json || {}).join(','));
          }
        } catch(e) {
          dbg('Parse error: ' + e.message);
        }
      }
      return response;
    }).catch(err => {
      dbg('FETCH ERROR: ' + originalUrl.substring(0, 80) + ' → ' + err.message);
      throw err;
    });
  };

  // ─── 2. Intercept XMLHttpRequest ───
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._vOrigUrl = url;
    // Block analytics in XHR too
    if (typeof url === 'string' && isBlocked(url)) {
      this._vBlocked = true;
      dbg('XHR BLOCKED: ' + url.substring(0, 80));
      return;
    }
    const proxied = proxyUrl(url);
    this._vUrl = proxied;
    return origOpen.apply(this, [method, proxied, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    if (this._vBlocked) return; // Skip blocked requests
    this.addEventListener('load', function() {
      const matchUrl = this._vOrigUrl || this._vUrl || '';
      if (!resolved && matchUrl.includes('/api/b/')) {
        dbg('XHR MATCH! /api/b/ response received');
        try {
          const json = JSON.parse(this.responseText);
          if (json && json.stream && json.stream.playlist) {
            resolved = true;
            dbg('XHR SUCCESS! Playlist: ' + json.stream.playlist.substring(0, 80));
            window.parent.postMessage({
              type: 'VIDLINK_STREAM',
              data: json
            }, '*');
          }
        } catch(e) { dbg('XHR parse error: ' + e.message); }
      }
    });
    return origSend.apply(this, args);
  };

  // ─── 3. Intercept dynamic script/link creation ───
  // Scripts and CSS are CORS-exempt, so we point them directly to vidlink.pro
  const origCreateElement = document.createElement.bind(document);
  document.createElement = function(tagName, options) {
    const el = origCreateElement(tagName, options);
    const tag = tagName.toLowerCase();
    
    if (tag === 'script') {
      const origSrcDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src') ||
                          Object.getOwnPropertyDescriptor(el.__proto__, 'src');
      if (origSrcDesc && origSrcDesc.set) {
        Object.defineProperty(el, 'src', {
          get: function() { return origSrcDesc.get.call(this); },
          set: function(val) {
            const rewritten = directUrl(val);
            if (rewritten !== val) dbg('SCRIPT rewrite: ' + val + ' → ' + rewritten);
            return origSrcDesc.set.call(this, rewritten);
          },
          configurable: true,
          enumerable: true
        });
      }
    }
    
    if (tag === 'link') {
      const origHrefDesc = Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype, 'href') ||
                           Object.getOwnPropertyDescriptor(el.__proto__, 'href');
      if (origHrefDesc && origHrefDesc.set) {
        Object.defineProperty(el, 'href', {
          get: function() { return origHrefDesc.get.call(this); },
          set: function(val) {
            const rewritten = directUrl(val);
            if (rewritten !== val) dbg('LINK rewrite: ' + val + ' → ' + rewritten);
            return origHrefDesc.set.call(this, rewritten);
          },
          configurable: true,
          enumerable: true
        });
      }
    }
    
    return el;
  };

  // ─── 4. Timeout ───
  setTimeout(() => {
    if (!resolved) {
      dbg('TIMEOUT - no stream found in 25s');
      window.parent.postMessage({ type: 'VIDLINK_TIMEOUT' }, '*');
    }
  }, 25000);

  dbg('All hooks installed successfully');
})();
</script>
`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tmdbId = searchParams.get('tmdbId');
  const type = searchParams.get('type') || 'movie';
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');

  if (!tmdbId) {
    return new NextResponse('Missing tmdbId', { status: 400 });
  }

  // Build the VidLink embed URL
  let embedUrl: string;
  if (type === 'tv') {
    // Default to Season 1 Episode 1 if not specified
    const s = season || '1';
    const e = episode || '1';
    embedUrl = `https://vidlink.pro/tv/${tmdbId}/${s}/${e}`;
  } else {
    embedUrl = `https://vidlink.pro/movie/${tmdbId}`;
  }

  console.log(`[VidLink-Proxy] 🔍 Fetching embed page: ${embedUrl}`);

  try {
    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://vidlink.pro/',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error(`[VidLink-Proxy] ❌ Failed: ${res.status} ${res.statusText}`);
      return new NextResponse(`VidLink returned ${res.status}`, { status: 502 });
    }

    let html = await res.text();

    // Rewrite static resource URLs in HTML to absolute vidlink.pro URLs.
    // Script/CSS/img tags are CORS-exempt, so direct loading works fine.
    // This handles: src="/path" → src="https://vidlink.pro/path"
    // But NOT: src="//..." (protocol-relative, already absolute)
    html = html.replace(/src="\/(?!\/)/g, 'src="https://vidlink.pro/');
    html = html.replace(/href="\/(?!\/)/g, 'href="https://vidlink.pro/');
    html = html.replace(/src='\/(?!\/)/g, "src='https://vidlink.pro/");
    html = html.replace(/href='\/(?!\/)/g, "href='https://vidlink.pro/");

    // Inject interceptor script as the VERY FIRST thing in <head>
    // This hooks fetch/XHR/createElement BEFORE any VidLink scripts run
    if (html.includes('<head>')) {
      html = html.replace('<head>', '<head>' + INTERCEPTOR_SCRIPT);
    } else if (html.includes('<HEAD>')) {
      html = html.replace('<HEAD>', '<HEAD>' + INTERCEPTOR_SCRIPT);
    } else {
      html = INTERCEPTOR_SCRIPT + html;
    }

    console.log(`[VidLink-Proxy] ✅ Proxied page (${html.length} bytes), interceptor injected`);

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('[VidLink-Proxy] ❌ Proxy error:', error.message);
    return new NextResponse(`Proxy error: ${error.message}`, { status: 500 });
  }
}
