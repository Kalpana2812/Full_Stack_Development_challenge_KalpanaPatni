import { readFileSync, writeFileSync } from 'node:fs';

const source = JSON.parse(readFileSync(new URL('../import/seed_shows.json', import.meta.url), 'utf8'));
const showMap = new Map();
const groupLanguage = new Map();
const issues = [];

for (const row of source) {
  const show = showMap.get(row.slug) ?? { title: row.show_title, rows: 0, seasons: new Set(), categories: new Set() };
  show.rows += 1;
  show.seasons.add(row.season_number);
  for (const category of row.categories ?? []) show.categories.add(category);
  showMap.set(row.slug, show);

  if (!row.section) issues.push({ type: 'missing_section', episodeId: row.episode_id });
  if (!row.duration_seconds || row.duration_seconds <= 0) issues.push({ type: 'missing_duration', episodeId: row.episode_id });
  if (!Array.isArray(row.artwork_available) || !['poster', 'banner', 'thumbnail'].every(kind => row.artwork_available.includes(kind))) {
    issues.push({ type: 'missing_artwork', episodeId: row.episode_id, artwork: row.artwork_available ?? [] });
  }
  const key = `${row.content_group}::${row.language}`;
  const previous = groupLanguage.get(key);
  if (previous) issues.push({ type: 'duplicate_content_group_language', episodeId: row.episode_id, previousEpisodeId: previous });
  else groupLanguage.set(key, row.episode_id);
}

const summary = {
  rows: source.length,
  shows: [...showMap.entries()].map(([slug, show]) => ({ slug, ...show, seasons: [...show.seasons].sort((a, b) => a - b), categories: [...show.categories] })),
  issueCount: issues.length,
  issues,
};

writeFileSync(new URL('../docs/seed-analysis.json', import.meta.url), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ rows: summary.rows, shows: summary.shows.length, issueCount: summary.issueCount, issues: summary.issues }, null, 2));
