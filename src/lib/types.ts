
export type ContentType = 'movie' | 'tv-show';

export interface Content {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  heroImage: string;
  genres: string[];
  year: number;
  rating: string;
  duration: string;
  type: ContentType;
  isTrending?: boolean;
  isOriginal?: boolean;
  isRecentlyAdded?: boolean;
  isNewSeason?: boolean;
  isNewEpisode?: boolean;
  isLeavingSoon?: boolean;
  seasonsCount?: number;
  maturityRating?: string;
}

export interface Episode {
  id: number;
  episodeNumber: number;
  seasonNumber?: number;
  name: string;
  overview: string;
  stillPath: string | null;
  runtime: number | null;
}

export interface UserPreferences {
  watchlist: string[];
  history: string[];
}
