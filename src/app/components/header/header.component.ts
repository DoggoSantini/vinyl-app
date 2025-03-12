import { Component, signal, Output, EventEmitter } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { map, switchMap, catchError } from 'rxjs/operators';
import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import { from, of, Observable } from 'rxjs';

export interface CardData {
  imageUrl: string;
  wikiText: string;
  query: string;
}

// Add these interfaces at the top of the file, after the existing imports
interface WikiCategory {
  title: string;
  ns: number;
  hidden?: boolean;
}

interface WikiPage {
  pageid: number;
  ns: number;
  title: string;
  extract?: string;
  categories?: WikiCategory[];
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  original?: {
    source: string;
    width: number;
    height: number;
  };
  pageimage?: string;
}

// First, let's add an interface for our Wiki response
interface WikiResult {
  text: string;
  imageUrl: string | null;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  original?: {
    source: string;
    width: number;
    height: number;
  };
}

interface SpotifyAlbum {
  name: string;
  artists: Array<{ name: string }>;
  release_date: string;
  total_tracks: number;
  popularity: number;
  external_urls: {
    spotify: string;
  };
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
}

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class HeaderComponent {
  @Output() newCard = new EventEmitter<CardData>();
  title = signal('vinyl-app');
  showInput = signal(false);
  query = signal('');
  private fallbackImageUrl = 'https://via.placeholder.com/400x300';

  constructor(private http: HttpClient) {}

  toggleInput() {
    this.showInput.set(!this.showInput());
  }

  searchImage() {
    const query = this.query();
    if (query) {
      return this.getWikiData(query)
        .pipe(
          map((result: WikiResult) => {
            // Try to get the best quality image available
            const imageUrl =
              result.original?.source ||
              result.thumbnail?.source ||
              result.imageUrl ||
              this.fallbackImageUrl;

            const cardData: CardData = {
              imageUrl,
              wikiText: result.text,
              query,
            };
            return cardData;
          })
        )
        .subscribe({
          next: (cardData) => {
            this.newCard.emit(cardData);
            this.query.set('');
            this.showInput.set(false);
          },
          error: (err) => console.error('Error:', err),
        });
    }
    return null;
  }

  searchImageFromUnsplash() {
    const query = this.query();
    if (query) {
      this.http
        .get(
          `https://api.unsplash.com/search/photos?query=${query}&client_id=${unsplash_access_key}`
        )
        .pipe(
          switchMap((response: any) => {
            const imageUrl = response.results[0]?.urls?.regular;
            if (imageUrl) {
              return this.getWikiData(query).pipe(
                map(({ text }) => ({
                  imageUrl,
                  wikiText: text, // Match CardData interface
                  query,
                }))
              );
            }
            throw new Error('No image found');
          })
        )
        .subscribe({
          next: (cardData) => {
            this.newCard.emit(cardData);
            this.query.set('');
            this.showInput.set(false);
          },
          error: (err) => console.error('Error:', err),
        });
    }
  }

  getSpotifyData(query: string) {
    const encodedQuery = encodeURIComponent(query);
    const url = 'https://api.spotify.com/v1/search';
    const token =
      //create new
      null;

    const searchParams = new URLSearchParams({
      q: encodedQuery,
      type: 'album',
      limit: '20',
    });

    return fetch(`${url}?${searchParams}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (!data.albums?.items?.length) {
          return null;
        }
        // Return just the first album
        return data.albums.items[0] as SpotifyAlbum;
      })
      .catch((error) => {
        console.error('Spotify API Error:', error);
        return null;
      });
  }

  // Update the getWikiData function with proper typing
  getWikiData(query: string) {
    const encodedQuery = encodeURIComponent(query);
    const url =
      `https://en.wikipedia.org/w/api.php?` +
      `action=query&` +
      `format=json&` +
      `generator=search&` + // Add search generator
      `gsrsearch=${encodedQuery}&` + // Add search query
      `gsrlimit=10&` + // Limit to 10 results
      `prop=extracts|pageimages|images|categories&` +
      `cllimit=max&` +
      `piprop=thumbnail|original&` + // Request both thumbnail and original
      `pithumbsize=500&` + // Set thumbnail size
      `iiprop=url&` +
      `pilimit=max&` + // Ensure we get at least one image
      `exintro=true&` + // Get only intro text
      `explaintext=true&` + // Get plain text
      `redirects=1&` + // Follow redirects
      `origin=*`;

    return this.http.get(url).pipe(
      map((response: any) => {
        if (!response.query || !response.query.pages) {
          return { text: 'No album found.', imageUrl: null };
        }

        const pages = response.query.pages;
        const pagesArray = Object.values(pages) as WikiPage[];

        const scoredPages = pagesArray.map((page: WikiPage) => {
          const title = page.title.toLowerCase();
          const extract = (page.extract || '').toLowerCase();
          const categories =
            page.categories?.map((cat: WikiCategory) =>
              cat.title.toLowerCase()
            ) || [];
          let score = 0;

          // Category-based scoring (highest priority)
          if (categories.some((cat) => cat.includes('albums_by')))
            score += 4000;
          if (categories.some((cat) => cat.includes('_albums'))) score += 3000;
          if (categories.some((cat) => cat.includes('_album_stubs')))
            score += 2000;
          if (categories.some((cat) => cat.includes('debut_albums')))
            score += 2000;
          if (categories.some((cat) => cat.includes('_eps'))) score += 1500;

          // Negative category matches
          if (categories.some((cat) => cat.includes('disambiguation_pages')))
            score -= 5000;
          if (categories.some((cat) => cat.includes('musical_groups')))
            score -= 3000;
          if (categories.some((cat) => cat.includes('musicians')))
            score -= 3000;

          // Title matching
          if (title.startsWith(query.toLowerCase())) score += 2000; // Exact title match at start
          if (title === query.toLowerCase()) score += 3000; // Perfect title match

          // Content indicators of an album
          if (extract.includes('studio album')) score += 1000;
          if (extract.includes('released')) score += 800;
          if (extract.includes('recorded')) score += 600;
          if (extract.includes('produced by')) score += 500;
          if (extract.includes('track')) score += 400;
          if (extract.includes('songs')) score += 400;
          if (extract.includes('singles')) score += 300;
          if (extract.includes('charts')) score += 200;
          if (extract.includes('label:')) score += 200;

          // Strong negative indicators
          if (extract.startsWith(query.toLowerCase() + ' is a band'))
            score -= 3000;
          if (extract.startsWith(query.toLowerCase() + ' is an artist'))
            score -= 3000;
          if (extract.startsWith(query.toLowerCase() + ' is a singer'))
            score -= 3000;
          if (title.includes('discography')) score -= 2000;
          if (title.includes('song)')) score -= 1000;
          if (title.includes('tour)')) score -= 1000;

          // Image bonus (album covers are important)
          if (page.thumbnail) score += 500;

          // Debug info
          const debugInfo = {
            title,
            score,
            categories: categories.filter(
              (cat) =>
                cat.includes('album') ||
                cat.includes('ep') ||
                cat.includes('music')
            ),
            matches: {
              titleMatch: title.startsWith(query.toLowerCase()),
              hasRelease: extract.includes('released'),
              hasTracks: extract.includes('track'),
              hasImage: !!page.thumbnail,
            },
          };

          return {
            ...page,
            relevanceScore: score,
            debugInfo,
          };
        });

        // Get the highest scoring page
        const albumPage = scoredPages.sort(
          (a, b) => b.relevanceScore - a.relevanceScore
        )[0];

        if (!albumPage?.extract || albumPage.relevanceScore <= 0) {
          return { text: 'No album found.', imageUrl: null };
        }

        const firstSentence = albumPage.extract.split('.')[0] + '.';
        const wikiCoverUrl =
          albumPage?.thumbnail?.source || albumPage?.original?.source || null;

        // Convert Promise to Observable using from
        return from(this.getSpotifyData(query)).pipe(
          map((spotifyAlbum) => {
            console.log('Spotify album:', spotifyAlbum);
            const artistsText = spotifyAlbum?.artists
              ? `By ${spotifyAlbum.artists.map((a) => a.name).join(', ')}. `
              : '';

            // Get the first Spotify album image if available
            const spotifyImage = spotifyAlbum?.images?.[0];
            const thumbnail = spotifyImage
              ? {
                  source: spotifyImage.url,
                  width: spotifyImage.width,
                  height: spotifyImage.height,
                }
              : albumPage?.thumbnail;

            return {
              text: artistsText + firstSentence,
              imageUrl: wikiCoverUrl, // Keep wiki image as fallback
              thumbnail: thumbnail,
              original: albumPage?.original,
            } as WikiResult;
          }),
          catchError(() => {
            // Fallback to just Wikipedia data if Spotify fails
            return of({
              text: firstSentence,
              imageUrl: wikiCoverUrl,
              thumbnail: albumPage?.thumbnail,
              original: albumPage?.original,
            } as WikiResult);
          })
        );
      }),
      switchMap((result) =>
        result instanceof Observable ? result : of(result)
      )
    );
  }
}
