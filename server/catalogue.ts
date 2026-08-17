export type CatalogueEpisode = {
  contentGroup: string;
  title: string;
  episodeNumber: number;
  durationSeconds: number;
  languages: string[];
  thumbnailUrl: string;
};

export type CatalogueShow = {
  id: number;
  title: string;
  slug: string;
  section: string;
  categories: string[];
  synopsis: string;
  posterUrl: string;
  bannerUrl: string;
  seasons: Array<{ number: number; episodes: CatalogueEpisode[] }>;
  trailers: CatalogueEpisode[];
};

export type Catalogue = { version: string; generatedAt: string; sections: Array<{ id: string; shows: CatalogueShow[] }> };

type SourceEpisode = { contentGroup: string; title: string; episodeNumber: number; durationSeconds: number | null; language: string; seasonNumber: number; thumbnailUrl: string };

export function collapseLanguageVariants(episodes: SourceEpisode[]): Array<{ seasonNumber: number; episode: CatalogueEpisode }> {
  const groups = new Map<string, SourceEpisode[]>();
  for (const episode of episodes) groups.set(episode.contentGroup, [...(groups.get(episode.contentGroup) ?? []), episode]);
  return [...groups.values()]
    .map(variants => {
      const representative = [...variants].sort((a, b) => a.language.localeCompare(b.language))[0];
      return {
        seasonNumber: representative.seasonNumber,
        episode: {
          contentGroup: representative.contentGroup,
          title: representative.title,
          episodeNumber: representative.episodeNumber,
          durationSeconds: representative.durationSeconds ?? 0,
          languages: [...new Set(variants.map(item => item.language))].sort(),
          thumbnailUrl: representative.thumbnailUrl,
        },
      };
    })
    .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episode.episodeNumber - b.episode.episodeNumber || a.episode.title.localeCompare(b.episode.title));
}

export function buildCatalogue(input: Array<Omit<CatalogueShow, "seasons" | "trailers"> & { episodes: SourceEpisode[] }>, version: string): Catalogue {
  const sections = new Map<string, CatalogueShow[]>();
  for (const show of input) {
    const collapsed = collapseLanguageVariants(show.episodes);
    const seasons = new Map<number, CatalogueEpisode[]>();
    const trailers: CatalogueEpisode[] = [];
    for (const item of collapsed) {
      if (item.seasonNumber === 0) trailers.push(item.episode);
      else seasons.set(item.seasonNumber, [...(seasons.get(item.seasonNumber) ?? []), item.episode]);
    }
    const catalogueShow: CatalogueShow = { ...show, seasons: Array.from(seasons.entries()).map(([number, episodes]) => ({ number, episodes })).sort((a, b) => a.number - b.number), trailers };
    sections.set(show.section, [...(sections.get(show.section) ?? []), catalogueShow]);
  }
  return {
    version,
    generatedAt: new Date().toISOString(),
    sections: Array.from(sections.entries()).map(([id, shows]) => ({ id, shows: shows.sort((a: CatalogueShow, b: CatalogueShow) => a.title.localeCompare(b.title)) })).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function filterCatalogue(catalogue: Catalogue, filters: { q?: string; category?: string; language?: string; section?: string }): Catalogue {
  const query = filters.q?.trim().toLowerCase();
  const includesQuery = (show: CatalogueShow) => !query || [show.title, ...show.categories, ...show.seasons.flatMap(season => season.episodes.map(episode => episode.title))].some(value => value.toLowerCase().includes(query));
  return {
    ...catalogue,
    sections: catalogue.sections
      .filter(section => !filters.section || section.id === filters.section)
      .map(section => ({
        ...section,
        shows: section.shows.filter(show => includesQuery(show) && (!filters.category || show.categories.includes(filters.category)) && (!filters.language || [...show.seasons.flatMap(season => season.episodes), ...show.trailers].some(episode => episode.languages.includes(filters.language!)))),
      }))
      .filter(section => section.shows.length),
  };
}
