import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Horse — Stremio Client",
    short_name: "Horse",
    description:
      "Open-source media center and client for the Stremio addon protocol. Bring your own addons: catalogs, streams, subtitles.",
    start_url: "/",
    display: "standalone",
    background_color: "#181a20",
    theme_color: "#181a20",
    orientation: "any",
    categories: ["entertainment", "video"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
