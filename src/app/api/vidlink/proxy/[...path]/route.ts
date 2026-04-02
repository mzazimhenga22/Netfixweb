import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 25; // Netlify serverless timeout (seconds)

/**
 * Catch-all proxy for VidLink assets (scripts, WASM, CSS, API calls).
 * 
 * VidLink's JS dynamically loads resources using window.location.origin,
 * which in our iframe context points to our server. This route forwards
 * those requests to vidlink.pro transparently.
 * 
 * Optimizations:
 * - Static assets (WASM, JS bundles) are cached for 24 hours
 * - Analytics/tracking endpoints are blocked immediately
 * - API responses are streamed through without caching
 */

// Block list: endpoints that are unnecessary and slow things down
const BLOCKED_PATHS = [
  'cdn-cgi/rum',      // Cloudflare Real User Monitoring (analytics)
  'cdn-cgi/trace',    // Cloudflare trace
  'cdn-cgi/beacon',   // Cloudflare beacon
];

// Long-cacheable static assets
const CACHEABLE_EXTENSIONS = ['.wasm', '.js', '.css', '.woff', '.woff2', '.ttf', '.png', '.jpg', '.svg', '.ico'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = path.join('/');

  // Block unnecessary requests immediately
  if (BLOCKED_PATHS.some(blocked => targetPath.includes(blocked))) {
    return new NextResponse(null, { status: 204 }); // No Content, instant
  }

  const targetUrl = `https://vidlink.pro/${targetPath}`;
  const isCacheable = CACHEABLE_EXTENSIONS.some(ext => targetPath.endsWith(ext));

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://vidlink.pro/',
        'Origin': 'https://vidlink.pro',
      },
      // Cache static assets on the server side too
      cache: isCacheable ? 'force-cache' : 'no-store',
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        // Cache static assets aggressively (24h), API responses never
        'Cache-Control': isCacheable 
          ? 'public, max-age=86400, stale-while-revalidate=3600' 
          : 'no-store',
      },
    });
  } catch (error: any) {
    console.error(`[VidLink-AssetProxy] ❌ ${targetUrl}: ${error.message}`);
    return new NextResponse(null, { status: 502 });
  }
}

// Handle POST requests (some VidLink endpoints use POST)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = path.join('/');

  // Block analytics POSTs immediately
  if (BLOCKED_PATHS.some(blocked => targetPath.includes(blocked))) {
    return new NextResponse(null, { status: 204 });
  }

  const targetUrl = `https://vidlink.pro/${targetPath}`;

  try {
    const body = await req.arrayBuffer();
    
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': req.headers.get('content-type') || 'application/json',
        'Referer': 'https://vidlink.pro/',
        'Origin': 'https://vidlink.pro',
      },
      body: body,
      cache: 'no-store',
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const responseBody = await res.arrayBuffer();

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error(`[VidLink-AssetProxy] ❌ POST ${targetUrl}: ${error.message}`);
    return new NextResponse(null, { status: 502 });
  }
}
