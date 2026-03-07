import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/super-admin/", "/_next/"],
      },
    ],
    sitemap: "https://conferenceday.app/sitemap.xml",
  };
}
