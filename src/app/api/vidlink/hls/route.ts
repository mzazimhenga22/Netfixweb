import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

/**
 * HLS Proxy — FAST streaming proxy for m3u8 playlists and .ts segments.
 * Bypasses CORS from CDN providers (storm.vodvidl.site, etc.)
 *
 * Key fix: The `host` param embedded in the m3u8 URL specifies the CDN
 * origin. We must use it as the Origin/Referer when fetching, otherwise
 * the CDN returns 403. Also strips query params before fetching the raw
 * CDN URL so we don't send our internal params upstream.
 */

const PROXY_BASE = '/api/vidlink/hls?url=';

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

    // Extract our embedded params before fetching upstream
    const headersParam = parsedUrl.searchParams.get('headers');
    const hostParam = parsedUrl.searchParams.get('host');

    // Build clean upstream URL (strip our injected query params)
    const cleanUrl = new URL(targetUrl);
    cleanUrl.searchParams.delete('headers');
    cleanUrl.searchParams.delete('host');
    const upstreamUrl = cleanUrl.toString();

    // Determine Referer/Origin from embedded headers AND host param.
    // The CDN (e.g. skyember44.online) checks these to allow/deny access.
    let referer = 'https://vidlink.pro/';
    let origin = 'https://vidlink.pro';

    if (headersParam) {
      try {
        const h = JSON.parse(headersParam);
        if (h.referer || h.Referer) referer = h.referer || h.Referer;
        if (h.origin || h.Origin) origin = h.origin || h.Origin;
      } catch {}
    }

    // The `host` param (e.g. https://skyember44.online) tells us the CDN
    // origin — use it to set a realistic Referer/Origin if provided
    if (hostParam) {
      try {
        const hostOrigin = new URL(hostParam).origin;
        // Only override if the headers didn't set it explicitly
        if (referer === 'https://vidlink.pro/') referer = hostOrigin + '/';
        if (origin === 'https://vidlink.pro') origin = hostOrigin;
      } catch {}
    }

    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': referer,
      'Origin': origin,
    };

    const res = await fetch(upstreamUrl, {
      headers: fetchHeaders,
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error(`[HLS-Proxy] ❌ ${res.status} for ${upstreamUrl}`);
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
          'Cache-Control': 'no-store',
        },
      });
    }

    // For .ts segments: stream through (zero-copy)
    const responseHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600, immutable',
    };
    if (ct) responseHeaders['Content-Type'] = ct;
    const cl = res.headers.get('content-length');
    if (cl) responseHeaders['Content-Length'] = cl;

    return new NextResponse(res.body, { headers: responseHeaders });

  } catch (error: any) {
    console.error(`[HLS-Proxy] ❌ ${error.message}`);
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
