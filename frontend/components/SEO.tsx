import Head from "next/head";

/**
 * Reusable per-page SEO component.
 *
 * `_document.tsx` ships sensible site-wide defaults (favicons, JSON-LD for
 * the organization, GA). Each page should additionally render <SEO /> so it
 * gets its OWN title, description, canonical URL, and Open Graph / Twitter
 * cards instead of inheriting the homepage's. Per-page <Head> entries
 * deduplicate and override the document-level ones.
 */

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://synthoraai.vercel.app"
).replace(/\/+$/, "");

const SITE_NAME = "SynthoraAI";

const DEFAULT_DESCRIPTION =
  "Discover and manage government-related news articles with ease, powered " +
  "by AI. Curated summaries, advanced filtering by topic, and seamless reading.";

const DEFAULT_OG_IMAGE = `${SITE_URL}/android-chrome-512x512.png`;

export interface SEOProps {
  /** Page title (the " | SynthoraAI" suffix is appended automatically). */
  title: string;
  /** Meta description. Falls back to the site default. */
  description?: string;
  /** Path beginning with "/" — used to build the canonical URL. */
  path?: string;
  /** Absolute Open Graph image URL. */
  ogImage?: string;
  /** Open Graph type. Use "article" for article pages. */
  ogType?: "website" | "article";
  /** When true, emit `noindex` (e.g. auth/account pages). */
  noindex?: boolean;
  /** Optional comma-separated keywords. */
  keywords?: string;
  /** Optional JSON-LD structured data (object or array of objects). */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "",
  ogImage = DEFAULT_OG_IMAGE,
  ogType = "website",
  noindex = false,
  keywords,
  jsonLd,
}: SEOProps) {
  const canonical = `${SITE_URL}${path}`;
  const fullTitle = title.includes(SITE_NAME)
    ? title
    : `${title} | ${SITE_NAME}`;
  const robots = noindex
    ? "noindex, follow"
    : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

  return (
    <Head>
      <title key="title">{fullTitle}</title>
      <meta key="description" name="description" content={description} />
      {keywords && <meta key="keywords" name="keywords" content={keywords} />}
      <meta key="robots" name="robots" content={robots} />
      <link key="canonical" rel="canonical" href={canonical} />

      {/* Open Graph */}
      <meta key="og:title" property="og:title" content={fullTitle} />
      <meta
        key="og:description"
        property="og:description"
        content={description}
      />
      <meta key="og:type" property="og:type" content={ogType} />
      <meta key="og:url" property="og:url" content={canonical} />
      <meta key="og:image" property="og:image" content={ogImage} />
      <meta
        key="og:site_name"
        property="og:site_name"
        content={`${SITE_NAME} - AI Content Curator`}
      />
      <meta key="og:locale" property="og:locale" content="en_US" />

      {/* Twitter Card */}
      <meta
        key="twitter:card"
        name="twitter:card"
        content="summary_large_image"
      />
      <meta key="twitter:title" name="twitter:title" content={fullTitle} />
      <meta
        key="twitter:description"
        name="twitter:description"
        content={description}
      />
      <meta key="twitter:image" name="twitter:image" content={ogImage} />
      <meta key="twitter:site" name="twitter:site" content="@hoangsonwww" />
      <meta
        key="twitter:creator"
        name="twitter:creator"
        content="@hoangsonwww"
      />

      {/* Structured data */}
      {jsonLd && (
        <script
          key="jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    </Head>
  );
}
