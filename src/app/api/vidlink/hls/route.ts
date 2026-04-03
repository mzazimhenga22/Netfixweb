import { NextRequest, NextResponse } from 'next/server';
import * as https from 'https';

// Helper to bypass undici URL normalization bugs and send the EXACT path
function exactFetch(urlStr: string, headers: Record<string, string>): Promise<{ status: number, headers: any, body: Buffer }> {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search, // Preserves exact encoding!
        method: 'GET',
        headers: headers
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 500,
            headers: res.headers,
            body: Buffer.concat(chunks)
          });
        });
      });
      req.on('error', reject);
      req.end();
    } catch(e) {
      reject(e);
    }
  });
}

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

    let referer = 'https://vidlink.pro/';
    let origin = 'https://vidlink.pro';

    // IMPORTANT: Check headers param FIRST — it contains the correct
    // Referer/Origin that the CDN expects (e.g. videostr.net).
    // The host param is the CDN proxy host, NOT the Referer.
    if (headersParam) {
      try {
        const h = JSON.parse(headersParam);
        if (h.referer || h.Referer) referer = h.referer || h.Referer;
        if (h.origin || h.Origin) origin = h.origin || h.Origin;
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

    console.log('[HLS] FINAL URL:', upstreamUrl);
    console.log('[HLS] HEADERS:', fetchHeaders);

    const res = await exactFetch(upstreamUrl, fetchHeaders);

    if (res.status >= 400) {
      console.error(`[HLS-Proxy] ❌ ${res.status} for ${upstreamUrl}`);
      return new NextResponse(`Upstream error: ${res.status}`, { status: res.status });
    }

    const ct = res.headers['content-type'] || '';
    const isPlaylist = upstreamUrl.includes('.m3u8') || ct.includes('mpegurl');

    if (isPlaylist) {
      const text = res.body.toString('utf-8');
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
    if (ct) responseHeaders['Content-Type'] = ct as string;
    const cl = res.headers['content-length'];
    if (cl) responseHeaders['Content-Length'] = cl as string;

    // Convert Node.js Buffer to standard Uint8Array to satisfy Next.js BodyInit type
    return new NextResponse(new Uint8Array(res.body), { headers: responseHeaders });

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
