import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Beryl Shelter",
    short_name: "Beryl Shelter",
    description: "Beryl Shelter Nigeria Limited customer application",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#70521b",
    icons: [
      { src: "/brand/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/android-chrome-512x512.png", sizes: "512x512", type: "image/png" }
    ]
  };
}
