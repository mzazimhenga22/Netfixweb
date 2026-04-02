import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

/**
 * HLS Proxy — streaming proxy for m3u8 playlists and .ts segments.
 *
 * URL shape (built by parseVidLinkResponse in vidlink.ts):
 *   /api/vidlink/hls?url=<clean-cdn-url>&host=<cdn-host>&headers=<json>
 *
 * `url`     — clean CDN URL with NO extra query params (they were stripped)
 * `host`    — optional CDN host hint (e.g. https://skyember44.online)
 * `headers` — optional JSON with referer/origin the CDN requires
 *
 * The CDN URL is sent upstream WITHOUT modification so signed tokens stay intact.
 */

const PROXY_BASE = '/api/vidlink/hls';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const targetUrl = sp.get('url');
  if (!targetUrl) {
    return new NextResponse('Missing url', { status: 400 });
  }

  // headers/host are top-level params on THIS route, not inside the CDN URL
  const headersParam = sp.get('headers');
  const hostParam = sp.get('host');

  try {
    let cdnUrl: string;
    try {
      cdnUrl = new URL(targetUrl).toString();
    } catch {
      return new NextResponse('Invalid URL', { status: 400 });
    }

    // Resolve Referer / Origin from our route params
    let referer = 'https://vidlink.pro/';
    let origin = 'https://vidlink.pro';

    if (headersParam) {
      try {
        const h = JSON.parse(headersParam);
        if (h.referer || h.Referer) referer = h.referer || h.Referer;
        if (h.origin || h.Origin) origin = h.origin || h.Origin;
      } catch {}
    }

    // host param as a fallback when headers param doesn't carry origin
    if (hostParam && referer === 'https://vidlink.pro/') {
      try {
        const hostOrigin = new URL(hostParam).origin;
        referer = hostOrigin + '/';
        origin = hostOrigin;
      } catch {}
    }

    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': referer,
      'Origin': origin,
    };

    console.log(`[HLS-Proxy] → ${cdnUrl.substring(0, 120)}`);
    console.log(`[HLS-Proxy] Referer: ${referer}`);

    const res = await fetch(cdnUrl, {
      headers: fetchHeaders,
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error(`[HLS-Proxy] ❌ ${res.status} upstream: ${cdnUrl.substring(0, 120)}`);
      return new NextResponse(`Upstream ${res.status}`, { status: res.status });
    }

    const ct = res.headers.get('content-type') || '';
    const isPlaylist = cdnUrl.includes('.m3u8') || ct.includes('mpegurl');

    if (isPlaylist) {
      const text = await res.text();
      const rewritten = rewritePlaylist(text, cdnUrl, headersParam, hostParam);
      return new NextResponse(rewritten, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        },
      });
    }

    // .ts segments — stream through (zero-copy)
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
 * Rewrite segment/sub-playlist URLs inside m3u8 playlists to go through
 * our proxy. Passes headers/host as top-level params — NOT injected into
 * the CDN URLs (which would corrupt signed tokens).
 */
function rewritePlaylist(
  text: string,
  baseUrl: string,
  headersParam: string | null,
  hostParam: string | null
): string {
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

    let params = `url=${encodeURIComponent(abs)}`;
    if (hostParam) params += `&host=${encodeURIComponent(hostParam)}`;
    if (headersParam) params += `&headers=${encodeURIComponent(headersParam)}`;

    return `${PROXY_BASE}?${params}`;
  }

  return text
    .split('\n')
    .map(line => {
      const t = line.trim();
      if (!t) return line;

      if (t.startsWith('#') && t.includes('URI="')) {
        return t.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${proxyUrl(uri)}"`);
      }
      if (t.startsWith('#')) return line;

      return proxyUrl(t);
    })
    .join('\n');
}
