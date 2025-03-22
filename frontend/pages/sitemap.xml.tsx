import { GetServerSideProps } from "next";
import { getArticles, getTotalArticles } from "../services/api";
import { Article } from "../pages";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://ai-article-curator.vercel.app";
const PAGE_LIMIT = 50000; // Maximum URLs per sitemap page

export const getServerSideProps: GetServerSideProps = async ({
  query,
  res,
}) => {
  // Check if a "page" parameter exists – if yes, output that paginated sitemap.
  const pageParam = query.page;
  if (pageParam) {
    const page = parseInt(pageParam as string, 10) || 1;
    const articles: Article[] = await getArticles(page, PAGE_LIMIT);
    const articlesXml = articles
      .map(
        (article) => `<url>
  <loc>${SITE_URL}/articles/${article._id}</loc>
  <lastmod>${new Date(article.fetchedAt).toISOString()}</lastmod>
  <changefreq>daily</changefreq>
  <priority>0.8</priority>
</url>`,
      )
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${articlesXml}
</urlset>`;

    res.setHeader("Content-Type", "application/xml");
    res.write(xml);
    res.end();
    return { props: {} };
  } else {
    // No page parameter – generate a sitemap index.
    const totalArticles = await getTotalArticles();
    const total = totalArticles || 0;
    const totalPages = Math.ceil(total / PAGE_LIMIT);

    // List your static routes.
    const staticUrls = [
      `${SITE_URL}/`,
      `${SITE_URL}/auth/login`,
      `${SITE_URL}/auth/register`,
      `${SITE_URL}/auth/reset-password`,
      `${SITE_URL}/favorites/favorites`,
    ];

    const staticXml = staticUrls
      .map(
        (url) => `<sitemap>
  <loc>${url}</loc>
  <changefreq>daily</changefreq>
  <priority>1</priority>
</sitemap>`,
      )
      .join("");

    const paginatedXml = Array.from({ length: totalPages }, (_, i) => {
      const page = i + 1;
      return `<sitemap>
  <loc>${SITE_URL}/sitemap.xml?page=${page}</loc>
  <changefreq>daily</changefreq>
  <priority>0.7</priority>
</sitemap>`;
    }).join("");

    const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticXml}
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
