import { GetServerSideProps } from "next";
import { getArticles, getTotalArticles } from "../services/api";
import { Article } from "./home";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://synthoraai.vercel.app/";
const PAGE_LIMIT = 50000; // Maximum URLs per sitemap page

const STATIC_URLS = [
  `${SITE_URL}/`,
  `${SITE_URL}/home`,
  `${SITE_URL}/auth/login`,
  `${SITE_URL}/auth/register`,
  `${SITE_URL}/auth/reset-password`,
  `${SITE_URL}/favorites/favorites`,
  `${SITE_URL}/newsletter`,
];

/**
 * Generate sitemap XML for articles and static pages, dynamically
 * as they are added to the database.
 * This handles both the sitemap index and paginated sitemaps.
 *
 * @param query - query parameters from the request
 * @param res - response object to send the XML
 */
export const getServerSideProps: GetServerSideProps = async ({
  query,
  res,
}) => {
  const pageParam = query.page;
  if (pageParam) {
    const page = parseInt(pageParam as string, 10) || 1;

    // On page 1, include static URLs with priority 0.8
    let urlEntries = "";
    if (page === 1) {
      urlEntries += STATIC_URLS.map(
        (url) => `<url>
            <loc>${url}</loc>
            <lastmod>${new Date().toISOString()}</lastmod>
            <changefreq>daily</changefreq>
            <priority>0.8</priority>
          </url>`,
      ).join("");
    }

    // Fetch articles for this page and output with priority 1.0
    const articles: Article[] = await getArticles(page, PAGE_LIMIT);
    urlEntries += articles
      .map(
        (article) => `<url>
          <loc>${SITE_URL}/articles/${article._id}</loc>
          <lastmod>${new Date(article.fetchedAt).toISOString()}</lastmod>
          <changefreq>daily</changefreq>
          <priority>1.0</priority>
        </url>`,
      )
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${urlEntries}
      </urlset>`;

    res.setHeader("Content-Type", "application/xml");
    res.write(xml);
    res.end();
    return { props: {} };
  } else {
    // Generate sitemap index pointing only at paginated sitemap pages
    const totalArticles = await getTotalArticles();
    const total = totalArticles || 0;
    const totalPages = Math.ceil(total / PAGE_LIMIT);

    const paginatedXml = Array.from({ length: totalPages }, (_, i) => {
      const page = i + 1;
      return `<sitemap>
        <loc>${SITE_URL}/sitemap.xml?page=${page}</loc>
      </sitemap>`;
    }).join("");

    const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${paginatedXml}
      </sitemapindex>`;

    res.setHeader("Content-Type", "application/xml");
    res.write(indexXml);
    res.end();
    return { props: {} };
  }
};

export default function Sitemap() {
  return null;
}
