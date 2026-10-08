"use client";

// Harbor Web — Movies view
import { SectionRails } from "./section-rails";
import { PageHeader } from "../chrome/page-header";

const SPECS = [
  { key: "pop", title: "Popular Movies", type: "movie", catalog: "trailer" },
  { key: "top", title: "Top Rated", type: "movie", catalog: "top" },
  { key: "action", title: "Action", type: "movie", catalog: "top", genre: "Action" },
  { key: "comedy", title: "Comedy", type: "movie", catalog: "top", genre: "Comedy" },
  { key: "scifi", title: "Sci-Fi & Fantasy", type: "movie", catalog: "top", genre: "Sci-Fi" },
  { key: "horror", title: "Horror", type: "movie", catalog: "top", genre: "Horror" },
  { key: "drama", title: "Drama", type: "movie", catalog: "top", genre: "Drama" },
  { key: "animation", title: "Animation", type: "movie", catalog: "top", genre: "Animation" },
  { key: "doc", title: "Documentary", type: "movie", catalog: "top", genre: "Documentary" },
];

export function MoviesView() {
  return (
    <>
      <div className="px-4 md:px-8">
        <PageHeader view="movies" />
      </div>
      <SectionRails specs={SPECS} hero={{ type: "movie", catalogs: ["trailer", "top"] }} />
    </>
  );
}
