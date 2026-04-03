import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * HLS Proxy — FAST streaming proxy for m3u8 playlists and .ts segments.
 * Bypasses CORS from CDN providers (storm.vodvidl.site, etc.)
 *
 * Runs on the Edge Runtime to:
 * 1. Bypass Node.js `undici` URL normalization bugs (%2F is preserved natively).
 * 2. Prevent Identity TLS fingerprint mismatch (Edge proxies route cleanly).
 * 3. Provide true zero-copy streaming for video segments via ReadableStream.
 */

const PROXY_BASE = '/api/vidlink/hls?url=';
const ALLOWED_HOSTS = ['vidlink', 'videostr', 'vodvidl', 'thunderleaf', 'aurora'];

async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (e) {
    if (retries === 0) throw e;
    return fetchWithRetry(url, options, retries - 1);
  }
}

export async function GET(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get('url');
  if (!targetUrl) {
    return new NextResponse('Missing url', { status: 400 });
  }

  try {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return new NextResponse('Invalid URL', { status: 400 });
    }

    const headersParam = parsedUrl.searchParams.get('headers');
    const hostParam = parsedUrl.searchParams.get('host');

    // Do NOT decode the path here, CDN expects exactly file2%2F intact
    const rawUpstreamUrl = targetUrl.split('?')[0];
    const urlObj = new URL(rawUpstreamUrl);
    
    if (hostParam) {
      try {
        const customHost = new URL(decodeURIComponent(hostParam)).origin;
        urlObj.host = new URL(customHost).host;
      } catch {}
    }
    const upstreamUrl = urlObj.toString();

    // Security: Prevent open proxy abuse
    if (!ALLOWED_HOSTS.some(h => upstreamUrl.includes(h))) {
      return new NextResponse('Forbidden proxy target', { status: 403 });
    }

    let referer = 'https://vidlink.pro/';
    let origin = 'https://vidlink.pro';

    // IMPORTANT: Check headers param FIRST — it contains the correct
    // Referer/Origin that the CDN expects (e.g. videostr.net).
    if (headersParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(headersParam));
        const lowerHeaders = Object.fromEntries(
          Object.entries(parsed).map(([k, v]) => [k.toLowerCase(), v])
        );
        if (lowerHeaders.referer) referer = lowerHeaders.referer as string;
        if (lowerHeaders.origin) origin = lowerHeaders.origin as string;
      } catch {}
    }

    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': referer,
      'Origin': origin,
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
    };

    console.log('[HLS] Edge FINAL URL:', upstreamUrl);

    // Edge fetch natively uses Web Fetch, avoiding the %2F undici bug automatically.
    // Enhanced with retry limits and a 10s AbortController timeout
    const res = await fetchWithRetry(upstreamUrl, {
      headers: fetchHeaders,
      redirect: 'manual',
    });

    // Handle CDN level redirects transparently
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (location) {
        console.log(`[HLS-Proxy] Following CDN redirect to ${location}`);
        return GET(new NextRequest(`${req.nextUrl.origin}/api/vidlink/hls?url=${encodeURIComponent(location)}`));
      }
    }

    if (res.status >= 400) {
      console.error(`[HLS-Proxy] ❌ Edge ${res.status} for ${upstreamUrl}`);
      return new NextResponse(`Upstream error: ${res.status}`, { status: res.status });
    }

    const ct = res.headers.get('content-type') || '';
    const isPlaylist = upstreamUrl.includes('.m3u8') || ct.includes('mpegurl');

    if (isPlaylist) {
      const text = await res.text();
      const rewritten = rewritePlaylist(text, upstreamUrl, headersParam, hostParam);

      return new NextResponse(rewritten, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=5, stale-while-revalidate=30',
        },
      });
    }

    // For .ts segments: stream through directly (ReadableStream zero-copy passthrough)
    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Cache-Control', 'public, max-age=3600, immutable');
    if (ct) responseHeaders.set('Content-Type', ct);
    const cl = res.headers.get('content-length');
    if (cl) responseHeaders.set('Content-Length', cl);

    return new NextResponse(res.body, { headers: responseHeaders });

  } catch (error: any) {
    console.error(`[HLS-Proxy] ❌ Edge fetch error: ${error.message}`);
    return new NextResponse(null, { status: 502 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Rewrite URLs inside m3u8 playlists to go through our proxy.
 * m3u8 files are typically < 5KB, so this is instant.
 */
function rewritePlaylist(text: string, baseUrl: string, headersParam: string | null, hostParam: string | null): string {
  const base = new URL(baseUrl);
  const baseOrigin = base.origin;
  const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);

  function proxyUrl(segUrl: string): string {
    let abs: string;
    if (segUrl.startsWith('http://') || segUrl.startsWith('https://')) {
      abs = segUrl;
    } else if (segUrl.startsWith('/')) {
      abs = baseOrigin + segUrl;
    } else {
      abs = basePath + segUrl;
    }

    // Carry over embedded headers to segment URLs
    try {
      const u = new URL(abs);
      if (headersParam && !u.searchParams.has('headers')) u.searchParams.set('headers', headersParam);
      if (hostParam && !u.searchParams.has('host')) u.searchParams.set('host', hostParam);
      abs = u.toString();
    } catch {}

    return PROXY_BASE + encodeURIComponent(abs);
  }

  return text.split('\n').map(line => {
    const t = line.trim();
    if (!t) return line;

    // Rewrite URI= attributes in EXT-X tags
    if (t.startsWith('#') && t.includes('URI="')) {
      return t.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${proxyUrl(uri)}"`);
    }

    // Skip other comments/directives
    if (t.startsWith('#')) return line;

    // URL line — rewrite it
    return proxyUrl(t);
  }).join('\n');
}
