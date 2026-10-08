"use client";

// Harbor Web — Discover view (genre rails across movies & series)
import { SectionRails } from "./section-rails";
import { PageHeader } from "../chrome/page-header";

const SPECS = [
  { key: "trend-m", title: "Trending Movies", type: "movie", catalog: "trailer" },
  { key: "trend-s", title: "Trending Series", type: "series", catalog: "trailer" },
  { key: "top-m", title: "Top Rated Movies", type: "movie", catalog: "top" },
  { key: "top-s", title: "Top Rated Series", type: "series", catalog: "top" },
  { key: "family", title: "Family Picks", type: "movie", catalog: "top", genre: "Family" },
  { key: "adventure", title: "Adventures", type: "movie", catalog: "top", genre: "Adventure" },
  { key: "mystery", title: "Mystery Series", type: "series", catalog: "top", genre: "Mystery" },
  { key: "romance", title: "Romance", type: "movie", catalog: "top", genre: "Romance" },
  { key: "history", title: "History & War", type: "series", catalog: "top", genre: "History" },
  { key: "music", title: "Music & Musicals", type: "movie", catalog: "top", genre: "Music" },
];

export function DiscoverView() {
  return (
    <>
      <div className="px-4 md:px-8">
        <PageHeader view="discover" />
      </div>
      <SectionRails specs={SPECS} hero={{ type: "movie", catalogs: ["trailer"] }} />
    </>
  );
}
