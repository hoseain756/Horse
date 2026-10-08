"use client";

// Harbor Web — Shows view
import { SectionRails } from "./section-rails";
import { PageHeader } from "../chrome/page-header";

const SPECS = [
  { key: "pop", title: "Trending Series", type: "series", catalog: "trailer" },
  { key: "top", title: "Top Rated Series", type: "series", catalog: "top" },
  { key: "drama", title: "Drama Series", type: "series", catalog: "top", genre: "Drama" },
  { key: "comedy", title: "Comedy Series", type: "series", catalog: "top", genre: "Comedy" },
  { key: "crime", title: "Crime & Mystery", type: "series", catalog: "top", genre: "Crime" },
  { key: "scifi", title: "Sci-Fi & Fantasy", type: "series", catalog: "top", genre: "Sci-Fi" },
  { key: "reality", title: "Reality", type: "series", catalog: "top", genre: "Reality" },
  { key: "doc", title: "Documentary", type: "series", catalog: "top", genre: "Documentary" },
];

export function ShowsView() {
  return (
    <>
      <div className="px-4 md:px-8">
        <PageHeader view="shows" />
      </div>
      <SectionRails specs={SPECS} hero={{ type: "series", catalogs: ["trailer", "top"] }} />
    </>
  );
}
