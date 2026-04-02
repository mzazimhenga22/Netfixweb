import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

/**
 * HLS Proxy — FAST streaming proxy for m3u8 playlists and .ts segments.
 * Bypasses CORS from CDN providers (storm.vodvidl.site, etc.)
 * 
 * Performance optimizations:
 * - .ts segments are STREAMED through (not buffered in memory)
 * - m3u8 playlists are tiny text files, parsed + rewritten instantly
 * - Aggressive caching on segments (they never change)
 * - Minimal header overhead
 */

const PROXY_BASE = '/api/vidlink/hls?url=';

export async function GET(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get('url');
  if (!targetUrl) {
    return new NextResponse('Missing url', { status: 400 });
  }

  try {
    // Extract embedded headers from URL query params
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return new NextResponse('Invalid URL', { status: 400 });
    }

    const headersParam = parsedUrl.searchParams.get('headers');
    let referer = 'https://vidlink.pro/';
    let origin = 'https://vidlink.pro';

    if (headersParam) {
      try {
        const h = JSON.parse(headersParam);
        if (h.referer || h.Referer) referer = h.referer || h.Referer;
        if (h.origin || h.Origin) origin = h.origin || h.Origin;
      } catch {}
    }

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': referer,
        'Origin': origin,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const ct = res.headers.get('content-type') || '';
    const isPlaylist = targetUrl.includes('.m3u8') || ct.includes('mpegurl');

    if (isPlaylist) {
      // Playlists are tiny — read, rewrite URLs, return
      const text = await res.text();
      const rewritten = rewritePlaylist(text, targetUrl, headersParam, parsedUrl.searchParams.get('host'));

      return new NextResponse(rewritten, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        },
      });
    }

    // For .ts segments: STREAM through for zero-copy speed
    // Don't buffer the entire segment in memory
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
