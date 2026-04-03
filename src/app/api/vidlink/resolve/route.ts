import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 25; // Netlify serverless timeout (seconds)

/**
 * VidLink Proxy Resolver
 * 
 * Serves VidLink's embed page through our domain with an interceptor
 * script injected to capture the /api/b/ response containing the m3u8 URL.
 * 
 * KEY FIX: ALL resources (JS, WASM, CSS, API) are routed through our
 * same-origin proxy (/api/vidlink/proxy/). This prevents the browser's
 * Tracking Prevention from blocking storage access for VidLink's scripts.
 * 
 * Before (broken):
 *   - Static resources → direct to https://vidlink.pro/ (third-party)
 *   - Browser tracking prevention blocked storage access
 *   - WASM token generation failed → /api/b/ never called → TIMEOUT
 * 
 * After (fixed):
 *   - ALL resources → through /api/vidlink/proxy/ (same-origin)
 *   - No third-party scripts = no tracking prevention
 *   - WASM loads & runs normally → /api/b/ succeeds → stream captured
 */

const INTERCEPTOR_SCRIPT = `
<script>
(function() {
  let resolved = false;
  const PROXY_BASE = '/api/vidlink/proxy/';

  function dbg(msg) {
    try {
      window.parent.postMessage({ type: 'VIDLINK_DEBUG', data: msg }, '*');
    } catch(e) {}
  }

  // Helper: rewrite ALL URLs to go through our same-origin proxy
  // This is the KEY fix - everything stays same-origin, no tracking prevention
  function proxyUrl(url) {
    if (typeof url !== 'string') return url;
    
    // Already going through our proxy
    if (url.startsWith(PROXY_BASE) || url.startsWith('/api/vidlink/')) return url;
    
    // Absolute vidlink.pro URL → proxy
    if (url.startsWith('https://vidlink.pro/')) {
      return PROXY_BASE + url.substring('https://vidlink.pro/'.length);
    }
    if (url.startsWith('http://vidlink.pro/')) {
      return PROXY_BASE + url.substring('http://vidlink.pro/'.length);
    }
    
    // Root-relative path → proxy (these are vidlink.pro resources)
    if (url.startsWith('/') && !url.startsWith('//')) {
      return PROXY_BASE + url.substring(1);
    }
    
    // Relative path (no leading slash) → proxy
    if (!url.startsWith('http') && !url.startsWith('//') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      return PROXY_BASE + url;
    }
    
    // External URLs (other domains) - leave as-is
    return url;
  }

  // Blocked URLs - analytics/tracking that waste time
  var BLOCKED = ['cdn-cgi/rum', 'cdn-cgi/trace', 'cdn-cgi/beacon', 'analytics', 'sentry', 'clarity'];
  function isBlocked(url) {
    return BLOCKED.some(function(b) { return url.indexOf(b) !== -1; });
  }

  dbg('Interceptor injected, hooking fetch, XHR, and DOM...');

  // ─── 1. Intercept fetch() ───
  var originalFetch = window.fetch;
  window.fetch = function() {
    var args = Array.prototype.slice.call(arguments);
    var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
    var originalUrl = url;
    
    // Block analytics/tracking
    if (isBlocked(originalUrl)) {
      return Promise.resolve(new Response('', { status: 204 }));
    }
    
    // Rewrite URL to go through our same-origin proxy
    var proxiedUrl = proxyUrl(url);
    if (typeof args[0] === 'string') {
      args[0] = proxiedUrl;
    } else if (args[0] && args[0].url) {
      args[0] = new Request(proxiedUrl, args[0]);
    }
    
    var fetchUrl = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
    dbg('FETCH: ' + originalUrl.substring(0, 100) + ' → ' + fetchUrl.substring(0, 100));

    return originalFetch.apply(this, args).then(function(response) {
      // Check for /api/b/ response containing the stream
      if (!resolved && (originalUrl.indexOf('/api/b/') !== -1 || fetchUrl.indexOf('/api/b/') !== -1 || fetchUrl.indexOf('proxy/api/b/') !== -1)) {
        dbg('MATCH! /api/b/ found, reading response...');
        try {
          var clone = response.clone();
          clone.text().then(function(text) {
            dbg('Response length: ' + text.length);
            try {
              var json = JSON.parse(text);
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
              dbg('JSON parse error: ' + e.message);
            }
          });
        } catch(e) {
          dbg('Clone error: ' + e.message);
        }
      }
      return response;
    }).catch(function(err) {
      dbg('FETCH ERROR: ' + originalUrl.substring(0, 80) + ' → ' + err.message);
      throw err;
    });
  };

  // ─── 2. Intercept XMLHttpRequest ───
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._vOrigUrl = url;
    var proxied = proxyUrl(url);
    this._vUrl = proxied;
    var restArgs = Array.prototype.slice.call(arguments, 2);
    return origOpen.apply(this, [method, proxied].concat(restArgs));
  };

  XMLHttpRequest.prototype.send = function() {
    var self = this;
    this.addEventListener('load', function() {
      var matchUrl = self._vOrigUrl || self._vUrl || '';
      if (!resolved && (matchUrl.indexOf('/api/b/') !== -1)) {
        dbg('XHR MATCH! /api/b/ response received');
        try {
          var json = JSON.parse(self.responseText);
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
    return origSend.apply(this, arguments);
  };

  // ─── 3. Intercept dynamic script/link/img creation ───
  // KEY: Scripts now also go through our proxy (same-origin) to avoid
  // tracking prevention. This is the fix for the storage access issue.
  var origCreateElement = document.createElement.bind(document);
  document.createElement = function(tagName, options) {
    var el = origCreateElement(tagName, options);
    var tag = (tagName || '').toLowerCase();
    
    if (tag === 'script') {
      var origDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
      if (origDesc && origDesc.set) {
        Object.defineProperty(el, 'src', {
          get: function() { return origDesc.get.call(this); },
          set: function(val) {
            var rewritten = proxyUrl(val);
            if (rewritten !== val) dbg('SCRIPT proxy: ' + val.substring(0, 60) + ' → ' + rewritten.substring(0, 60));
            return origDesc.set.call(this, rewritten);
          },
          configurable: true,
          enumerable: true
        });
      }
    }
    
    if (tag === 'link') {
      var origHrefDesc = Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype, 'href');
      if (origHrefDesc && origHrefDesc.set) {
        Object.defineProperty(el, 'href', {
          get: function() { return origHrefDesc.get.call(this); },
          set: function(val) {
            var rewritten = proxyUrl(val);
            if (rewritten !== val) dbg('LINK proxy: ' + val.substring(0, 60) + ' → ' + rewritten.substring(0, 60));
            return origHrefDesc.set.call(this, rewritten);
          },
          configurable: true,
          enumerable: true
        });
      }
    }
    
    return el;
  };

  // ─── 4. Intercept WebAssembly.instantiateStreaming to proxy WASM ───
  // WASM files must also go through our proxy for same-origin
  if (typeof WebAssembly !== 'undefined') {
    var origInstantiateStreaming = WebAssembly.instantiateStreaming;
    if (origInstantiateStreaming) {
      WebAssembly.instantiateStreaming = function(source, importObject) {
        dbg('WASM instantiateStreaming intercepted');
        // If source is a Response from a fetch, we need to re-fetch through proxy
        if (source && typeof source.then === 'function') {
          // It's a Promise<Response> (from fetch)
          return source.then(function(response) {
            var wasmUrl = response.url || '';
            dbg('WASM URL: ' + wasmUrl);
            // Re-fetch through proxy if needed
            var proxiedWasm = proxyUrl(wasmUrl);
            if (proxiedWasm !== wasmUrl) {
              dbg('WASM re-fetching through proxy: ' + proxiedWasm);
              return originalFetch(proxiedWasm).then(function(proxiedResponse) {
                return origInstantiateStreaming.call(WebAssembly, proxiedResponse, importObject);
              });
            }
            return origInstantiateStreaming.call(WebAssembly, response, importObject);
          });
        }
        return origInstantiateStreaming.call(WebAssembly, source, importObject);
      };
    }
    
    var origInstantiate = WebAssembly.instantiate;
    if (origInstantiate) {
      WebAssembly.instantiate = function(source, importObject) {
        dbg('WASM instantiate called');
        return origInstantiate.call(WebAssembly, source, importObject);
      };
    }
  }

  // ─── 5. Timeout ───
  setTimeout(function() {
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://vidlink.pro/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error(`[VidLink-Proxy] ❌ Failed: ${res.status} ${res.statusText}`);
      return new NextResponse(`VidLink returned ${res.status}`, { status: 502 });
    }

    let html = await res.text();

    // ═══ KEY FIX ═══
    // Route ALL static resources through our same-origin proxy
    // instead of direct to vidlink.pro (which triggers tracking prevention).
    // 
    // BEFORE (broken): src="/path" → src="https://vidlink.pro/path"  (third-party → blocked)
    // AFTER  (fixed):  src="/path" → src="/api/vidlink/proxy/path"   (same-origin → allowed)
    html = html.replace(/src="\/(?!\/|api\/)/g, 'src="/api/vidlink/proxy/');
    html = html.replace(/href="\/(?!\/|api\/)/g, 'href="/api/vidlink/proxy/');
    html = html.replace(/src='\/(?!\/|api\/)/g, "src='/api/vidlink/proxy/");
    html = html.replace(/href='\/(?!\/|api\/)/g, "href='/api/vidlink/proxy/");
    
    // Also rewrite any absolute vidlink.pro URLs in the HTML
    html = html.replace(/https:\/\/vidlink\.pro\//g, '/api/vidlink/proxy/');
    html = html.replace(/http:\/\/vidlink\.pro\//g, '/api/vidlink/proxy/');

    // Inject interceptor script as the VERY FIRST thing in <head>
    if (html.includes('<head>')) {
      html = html.replace('<head>', '<head>' + INTERCEPTOR_SCRIPT);
    } else if (html.includes('<HEAD>')) {
      html = html.replace('<HEAD>', '<HEAD>' + INTERCEPTOR_SCRIPT);
    } else {
      html = INTERCEPTOR_SCRIPT + html;
    }

    console.log(`[VidLink-Proxy] ✅ Proxied page (${html.length} bytes), all resources routed through same-origin proxy`);

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
