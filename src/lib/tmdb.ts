const API_KEY = '1ba41bda48d0f1c90954f4811637b6d6';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original';
const THUMB_BASE_URL = 'https://image.tmdb.org/t/p/w500';

import { Content, ContentType, Episode } from './types';

export async function fetchFromTMDB(endpoint: string, params: Record<string, string> = {}) {
  const queryParams = new URLSearchParams({
    api_key: API_KEY,
    language: 'en-US',
    ...params,
  });
  const response = await fetch(`${BASE_URL}${endpoint}?${queryParams}`);
  if (!response.ok) throw new Error('TMDB API request failed');
  return response.json();
}

let genreMap: Record<number, string> = {};

export async function getGenres() {
  if (Object.keys(genreMap).length > 0) return genreMap;
  
  const [movieGenres, tvGenres] = await Promise.all([
    fetchFromTMDB('/genre/movie/list'),
    fetchFromTMDB('/genre/tv/list')
  ]);
  
  const allGenres = [...movieGenres.genres, ...tvGenres.genres];
  allGenres.forEach((g: any) => {
    genreMap[g.id] = g.name;
  });
  
  return genreMap;
}

export async function mapTMDBToContent(item: any, type: ContentType, isOriginal = false): Promise<Content> {
  const genres = await getGenres();
  const itemGenres = (item.genre_ids || []).map((id: number) => genres[id] || 'General');
  
  const releaseDate = item.release_date || item.first_air_date;
  const year = new Date(releaseDate || Date.now()).getFullYear();
  
  // Logic for Recently Added / New labels
  const isRecentlyAdded = releaseDate && (new Date().getTime() - new Date(releaseDate).getTime()) < (14 * 24 * 60 * 60 * 1000);
  const isNewSeason = type === 'tv-show' && isRecentlyAdded; // Simplified logic
  const isNewEpisode = type === 'tv-show' && isRecentlyAdded;

  return {
    id: `${item.id}`,
    title: item.title || item.name || 'Untitled',
    description: item.overview || 'No description available.',
    thumbnail: item.poster_path ? `${THUMB_BASE_URL}${item.poster_path}` : 'https://picsum.photos/seed/placeholder/600/900',
    heroImage: item.backdrop_path ? `${IMAGE_BASE_URL}${item.backdrop_path}` : 'https://picsum.photos/seed/placeholder/1920/1080',
    genres: itemGenres,
    year,
    rating: item.vote_average ? `${item.vote_average.toFixed(1)}` : 'NR',
    duration: type === 'movie' ? 'Movie' : 'TV Show',
    type,
    isRecentlyAdded: !!isRecentlyAdded,
    isNewSeason: !!isNewSeason,
    isNewEpisode: !!isNewEpisode,
    isTrending: false,
    isOriginal: isOriginal || item.networks?.some((n: any) => n.id === 213) || false
  };
}

export async function getTrending(type: 'movie' | 'tv' | 'all' = 'all', kidsOnly = false) {
  if (kidsOnly) {
    // Trending doesn't support with_genres, so we use discover sorted by popularity
    const [movies, tv] = await Promise.all([
      fetchFromTMDB('/discover/movie', { with_genres: '10751,16', sort_by: 'popularity.desc' }),
      fetchFromTMDB('/discover/tv', { with_genres: '10762', sort_by: 'popularity.desc' })
    ]);
    const combined = [...movies.results, ...tv.results].sort((a, b) => b.popularity - a.popularity);
    return Promise.all(combined.slice(0, 20).map((item: any) => mapTMDBToContent(item, item.first_air_date ? 'tv-show' : 'movie')));
  }

  const data = await fetchFromTMDB(`/trending/${type}/week`);
  return Promise.all(data.results.map((item: any) => mapTMDBToContent(item, item.media_type === 'tv' ? 'tv-show' : 'movie')));
}

export async function getOnlyOnNetflix(kidsOnly = false) {
  // Using TMDB Discover with Netflix Network ID (213)
  const params: Record<string, string> = { with_networks: '213' };
  
  const [movies, tv] = await Promise.all([
    fetchFromTMDB('/discover/movie', { 
      ...params, 
      sort_by: 'primary_release_date.desc',
      ...(kidsOnly ? { with_genres: '10751,16' } : {})
    }),
    fetchFromTMDB('/discover/tv', { 
      ...params, 
      sort_by: 'first_air_date.desc',
      ...(kidsOnly ? { with_genres: '10762' } : {})
    })
  ]);
  
  const combined = [...movies.results.slice(0, 15), ...tv.results.slice(0, 15)];
  return Promise.all(combined.map((item: any) => mapTMDBToContent(item, item.first_air_date ? 'tv-show' : 'movie', true)));
}

export async function getNewReleases(kidsOnly = false) {
  const [movies, tv] = await Promise.all([
    fetchFromTMDB('/movie/now_playing', { ...(kidsOnly ? { with_genres: '10751,16' } : {}) }),
    fetchFromTMDB('/tv/on_the_air', { ...(kidsOnly ? { with_genres: '10762' } : {}) })
  ]);
  
  const combined = [...movies.results.slice(0, 15), ...tv.results.slice(0, 15)].sort(() => Math.random() - 0.5);
  return Promise.all(combined.map((item: any) => mapTMDBToContent(item, item.first_air_date ? 'tv-show' : 'movie')));
}

export async function getLeavingSoon() {
  // Mock leaving soon row using older popular titles
  const data = await fetchFromTMDB('/discover/movie', { sort_by: 'popularity.asc', 'primary_release_date.lte': '2015-01-01' });
  const results = await Promise.all(data.results.slice(0, 20).map((item: any) => mapTMDBToContent(item, 'movie')));
  return results.map(item => ({ ...item, isLeavingSoon: true }));
}

export async function getPopular(type: ContentType, kidsOnly = false) {
  const endpoint = type === 'movie' ? '/movie/popular' : '/tv/popular';
  const params: Record<string, string> = {};
  if (kidsOnly) {
    params.with_genres = type === 'movie' ? '10751,16' : '10762';
  }
  const data = await fetchFromTMDB(endpoint, params);
  return Promise.all(data.results.map((item: any) => mapTMDBToContent(item, type)));
}

export async function searchContent(query: string, kidsOnly = false) {
  const data = await fetchFromTMDB('/search/multi', { query });
  let validResults = data.results.filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv');
  
  if (kidsOnly) {
     // Search multi doesn't support with_genres in query, so we filter manually or use discover
     // For high fidelity, we'll filter the results against the kids genres
     const KIDS_GENRES = [10762, 10751, 16];
     validResults = validResults.filter((item: any) => 
       (item.genre_ids || []).some((id: number) => KIDS_GENRES.includes(id))
     );
  }

  return Promise.all(validResults.map((item: any) => mapTMDBToContent(item, item.media_type === 'tv' ? 'tv-show' : 'movie')));
}


export async function getSimilar(id: string, type: ContentType) {
  const endpoint = type === 'movie' ? `/movie/${id}/similar` : `/tv/${id}/similar`;
  try {
    const data = await fetchFromTMDB(endpoint);
    return Promise.all(data.results.slice(0, 9).map((item: any) => mapTMDBToContent(item, type)));
  } catch (e) {
    return [];
  }
}

export async function getMaturityRating(id: string, type: ContentType): Promise<string> {
  try {
    const endpoint = type === 'movie' ? `/movie/${id}/release_dates` : `/tv/${id}/content_ratings`;
    const data = await fetchFromTMDB(endpoint);
    
    if (type === 'movie') {
      const usRelease = data.results?.find((r: any) => r.iso_3166_1 === 'US');
      if (usRelease && usRelease.release_dates.length > 0) {
        return usRelease.release_dates[0].certification || 'PG-13';
      }
    } else {
      const usRating = data.results?.find((r: any) => r.iso_3166_1 === 'US');
      if (usRating) return usRating.rating || 'TV-MA';
    }
  } catch (e) {
    console.warn('[TMDB] Failed to fetch maturity rating:', e);
  }
  return type === 'movie' ? 'PG-13' : 'TV-MA'; // Fallbacks
}

export async function getContentDetails(id: string, type: ContentType): Promise<Content> {
  const endpoint = type === 'movie' ? `/movie/${id}` : `/tv/${id}`;
  const [item, mRating] = await Promise.all([
    fetchFromTMDB(endpoint),
    getMaturityRating(id, type)
  ]);
  
  const duration = type === 'movie' 
    ? `${Math.floor(item.runtime / 60)}h ${item.runtime % 60}m`
    : `${item.number_of_seasons} Season${item.number_of_seasons > 1 ? 's' : ''}`;

  return {
    id: `${item.id}`,
    title: item.title || item.name || 'Untitled',
    description: item.overview || 'No description available.',
    thumbnail: item.poster_path ? `${THUMB_BASE_URL}${item.poster_path}` : 'https://picsum.photos/seed/placeholder/600/900',
    heroImage: item.backdrop_path ? `${IMAGE_BASE_URL}${item.backdrop_path}` : 'https://picsum.photos/seed/placeholder/1920/1080',
    genres: (item.genres || []).map((g: any) => g.name),
    year: new Date(item.release_date || item.first_air_date || Date.now()).getFullYear(),
    rating: item.vote_average ? `${item.vote_average.toFixed(1)}` : 'NR',
    duration,
    type,
    isTrending: true,
    isOriginal: item.networks?.some((n: any) => n.id === 213) || item.production_companies?.some((c: any) => c.id === 213) || false,
    seasonsCount: item.number_of_seasons,
    maturityRating: mRating
  };
}

export async function getEpisodes(seriesId: string, seasonNumber: string): Promise<Episode[]> {
  try {
    const data = await fetchFromTMDB(`/tv/${seriesId}/season/${seasonNumber}`);
    return data.episodes.map((ep: any) => ({
      id: ep.id,
      episodeNumber: ep.episode_number,
      name: ep.name,
      overview: ep.overview,
      stillPath: ep.still_path ? `${THUMB_BASE_URL}${ep.still_path}` : null,
      runtime: ep.runtime
    }));
  } catch (e) {
    return [];
  }
}
export async function getLanguages() {
  // A curated list of popular languages on Netflix for high-fidelity UI
  return [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'ko', name: 'Korean' },
    { code: 'ja', name: 'Japanese' },
    { code: 'hi', name: 'Hindi' },
    { code: 'zh', name: 'Chinese' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'de', name: 'German' },
    { code: 'ar', name: 'Arabic' },
    { code: 'tr', name: 'Turkish' },
    { code: 'it', name: 'Italian' },
    { code: 'ru', name: 'Russian' },
  ];
}

export async function discoverByLanguage(languageCode: string, sortBy = 'popularity.desc', kidsOnly = false) {
  const params: Record<string, string> = { 
    with_original_language: languageCode,
    sort_by: sortBy
  };

  if (kidsOnly) {
    // TMDB uses genres for kids content
    params.with_genres = '10751,16,10762';
  }

  const [movies, tv] = await Promise.all([
    fetchFromTMDB('/discover/movie', params),
    fetchFromTMDB('/discover/tv', params)
  ]);

  const combined = [...movies.results.slice(0, 20), ...tv.results.slice(0, 20)]
    .sort((a, b) => b.popularity - a.popularity);

  // If sorting by date, we re-sort after merging movies and tv
  if (sortBy.includes('release_date')) {
    combined.sort((a, b) => {
      const dateA = new Date(a.release_date || a.first_air_date || 0).getTime();
      const dateB = new Date(b.release_date || b.first_air_date || 0).getTime();
      return dateB - dateA;
    });
  }

  return Promise.all(combined.map((item: any) => mapTMDBToContent(item, item.first_air_date ? 'tv-show' : 'movie')));
}
