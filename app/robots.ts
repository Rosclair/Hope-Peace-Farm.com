import type { MetadataRoute } from "next";
import { configSite } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  // Tant que le site n’est pas en production, aucun robot n’est admis.
  if (!configSite().SITE_INDEXABLE) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/demande/confirmation"] } };
}
