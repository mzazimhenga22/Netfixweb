/**
 * VidLink Streaming Service (Web)
 * 
 * Provides direct HLS streaming links via VidLink.pro.
 * 
 * Flow:
 * 1. VidLinkResolver component loads a proxied VidLink page in a hidden iframe
 * 2. The proxy route injects an interceptor script that hooks fetch/XHR
 * 3. When VidLink's JS makes the /api/b/ call, the interceptor captures the response
 * 4. The response is sent to the parent window via postMessage
 * 5. parseVidLinkResponse() extracts the clean m3u8 URL + metadata
 */

export interface VidLinkSkipMarker {
  type: 'intro' | 'outro';
  start: number;
  end: number;
}

export interface VidLinkStream {
  url: string;           // Direct HLS .m3u8 URL
  headers: Record<string, string>;
  captions: VidLinkCaption[];
  markers?: VidLinkSkipMarker[];
  sourceId: string;
}

export interface VidLinkCaption {
  id: string;
  url: string;
  language: string;
  type: string;
}

/**
 * Build the VidLink embed URL for a given TMDB ID
 */
export function getVidLinkEmbedUrl(
  tmdbId: string,
  type: 'movie' | 'tv' = 'movie',
  season?: number,
  episode?: number
): string {
  if (type === 'tv' && season && episode) {
    return `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`;
  }
  return `https://vidlink.pro/movie/${tmdbId}`;
}

/**
 * Build the proxy resolver URL (used by the VidLinkResolver component)
 */
export function getVidLinkProxyUrl(
  tmdbId: string,
  type: 'movie' | 'tv' = 'movie',
  season?: number,
  episode?: number
): string {
  const params = new URLSearchParams({ tmdbId, type });
  if (type === 'tv' && season) params.set('season', String(season));
  if (type === 'tv' && episode) params.set('episode', String(episode));
  return `/api/vidlink/resolve?${params.toString()}`;
}

/**
 * Parse the raw VidLink API response into our clean stream format.
 *
 * Key insight: VidLink's playlist URL often looks like:
 *   https://storm.vodvidl.site/proxy/file2/TOKEN.m3u8?headers={...}&host=https://cdn.example.com
 *
 * The `headers` and `host` params are NOT CDN params — they are metadata
 * VidLink embeds so consumers know what headers to send. We must extract them
 * and pass them to our HLS proxy separately, so the clean CDN URL has NO
 * extra params that could corrupt the signed token.
 */
export function parseVidLinkResponse(data: any): VidLinkStream | null {
  try {
    if (!data?.stream?.playlist) return null;

    const stream = data.stream;
    let rawPlaylist: string = stream.playlist;

    // VidLink sometimes double-encodes slashes in path segments: %2F → /
    // Only decode path-level %2F (before the '?'), not query param values
    const qMark = rawPlaylist.indexOf('?');
    if (qMark !== -1) {
      rawPlaylist =
        rawPlaylist.slice(0, qMark).replace(/%2F/gi, '/') +
        rawPlaylist.slice(qMark);
    } else {
      rawPlaylist = rawPlaylist.replace(/%2F/gi, '/');
    }

    console.log(`[VidLink] Playlist URL: ${rawPlaylist.substring(0, 120)}...`);

    // --- Extract embedded `headers` and `host` from the playlist URL ---
    // These are VidLink's way of telling us what headers the CDN needs.
    // We must strip them from the URL before forwarding to the CDN.
    let cdnUrl = rawPlaylist;
    let embeddedHeaders: Record<string, string> = {};
    let hostParam: string | null = null;

    try {
      const parsed = new URL(rawPlaylist);

      // Extract and remove our special params
      const headersRaw = parsed.searchParams.get('headers');
      hostParam = parsed.searchParams.get('host');
      parsed.searchParams.delete('headers');
      parsed.searchParams.delete('host');
      cdnUrl = parsed.toString();

      if (headersRaw) {
        try { embeddedHeaders = JSON.parse(headersRaw); } catch {}
      }
    } catch {
      // rawPlaylist wasn't a valid URL — use as-is
      cdnUrl = rawPlaylist;
    }

    // Build the response headers that our proxy should forward to the CDN
    const responseHeaders: Record<string, string> = {};

    // 1. VidLink-level headers (from stream.headers in the API response)
    if (stream.headers && typeof stream.headers === 'object') {
      Object.assign(responseHeaders, stream.headers);
    }

    // 2. Embedded URL headers (override / supplement VidLink headers)
    Object.assign(responseHeaders, embeddedHeaders);

    // 3. If referer/origin still not set, fall back based on host param
    if (!responseHeaders['Referer'] && !responseHeaders['referer']) {
      if (hostParam) {
        try {
          const hostOrigin = new URL(hostParam).origin;
          responseHeaders['Referer'] = hostOrigin + '/';
          responseHeaders['Origin'] = hostOrigin;
        } catch {
          responseHeaders['Referer'] = 'https://vidlink.pro/';
          responseHeaders['Origin'] = 'https://vidlink.pro';
        }
      } else {
        responseHeaders['Referer'] = 'https://vidlink.pro/';
        responseHeaders['Origin'] = 'https://vidlink.pro';
      }
    }

    // 4. Standard browser User-Agent
    if (!responseHeaders['User-Agent']) {
      responseHeaders['User-Agent'] = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    }

    // --- Build the HLS proxy URL ---
    // We pass the CLEAN CDN URL (no headers/host params) plus the host hint.
    // Our server-side proxy will use these to reconstruct the right fetch headers.
    let proxyParams = `url=${encodeURIComponent(cdnUrl)}`;
    if (hostParam) proxyParams += `&host=${encodeURIComponent(hostParam)}`;

    // Encode the headers as a single JSON param so the proxy can forward them
    const headersForProxy: Record<string, string> = {};
    if (responseHeaders['Referer'] || responseHeaders['referer']) {
      headersForProxy['referer'] = responseHeaders['Referer'] || responseHeaders['referer'];
    }
    if (responseHeaders['Origin'] || responseHeaders['origin']) {
      headersForProxy['origin'] = responseHeaders['Origin'] || responseHeaders['origin'];
    }
    if (Object.keys(headersForProxy).length > 0) {
      proxyParams += `&headers=${encodeURIComponent(JSON.stringify(headersForProxy))}`;
    }

    const playlistUrl = `/api/vidlink/hls?${proxyParams}`;
    console.log(`[VidLink] ✅ Stream resolved!`);
    console.log(`[VidLink] 🎬 Proxy URL: ${playlistUrl.substring(0, 120)}...`);

    // Captions
    const captions: VidLinkCaption[] = (stream.captions || []).map((c: any) => ({
      id: c.id || c.url,
      url: c.url,
      language: c.language || 'Unknown',
      type: c.type || 'vtt',
    }));

    // Jump Markers (Intro / Outro)
    const markers: VidLinkSkipMarker[] = [];
    if (stream.intro) {
      markers.push({ type: 'intro', start: stream.intro.start || 0, end: stream.intro.end || 0 });
    }
    if (stream.outro) {
      markers.push({ type: 'outro', start: stream.outro.start || 0, end: stream.outro.end || 0 });
    }
    if (Array.isArray(stream.skips)) {
      stream.skips.forEach((s: any) => {
        markers.push({ type: s.type === 1 ? 'intro' : 'outro', start: s.start || 0, end: s.end || 0 });
      });
    }

    return {
      url: playlistUrl,
      headers: responseHeaders,
      captions,
      markers,
      sourceId: data.sourceId || 'vidlink',
    };
  } catch (e) {
    console.error('[VidLink] Failed to parse response:', e);
    return null;
  }
}
