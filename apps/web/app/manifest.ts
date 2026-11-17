import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Konfam",
    short_name: "Konfam",
    description: "A talking Lightning till: speaks only when real money lands.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5f0",
    theme_color: "#f7931a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
