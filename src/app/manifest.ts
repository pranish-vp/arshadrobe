import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arshadrobe — Your AI Wardrobe",
    short_name: "Arshadrobe",
    description:
      "Your closet, styled by AI. Catalog your wardrobe, get outfit ideas, and see yourself wearing them.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf6f1",
    theme_color: "#faf6f1",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
