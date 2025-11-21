import Document, {
  Html,
  Head,
  Main,
  NextScript,
  DocumentContext,
} from "next/document";

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    const siteUrl = "https://synthoraai.vercel.app/";
    const title = "SynthoraAI – AI-Powered News Article Content Curator";
    const description =
      "Discover and manage government-related news articles with ease, powered by AI. Curated summaries, advanced filtering by topic, and seamless reading.";
    const imageUrl = `${siteUrl}/android-chrome-192x192.png`;
    const author = "Son Nguyen";
    const publisherName = "Son Nguyen";

    return (
      <Html lang="en">
        <Head>
          {/* Basic */}
          <meta charSet="UTF-8" />
          <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="theme-color" content="#ffffff" />

          {/* Primary Meta Tags */}
          <title>{title}</title>
          <meta name="description" content={description} />
          <meta
            name="keywords"
            content="AI, article curator, news aggregator, government news, content curation, topic filtering, synthoraai, synthora ai, synthora, synthoraai.com, synthora.ai, ai article curator, ai content curator, news curation, article summaries, government articles"
          />
          <meta
            name="robots"
            content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
          />
          <meta name="rating" content="General" />
          <meta name="distribution" content="Global" />
          <meta name="revisit-after" content="7 days" />
          <meta name="author" content={author} />
          <meta name="publisher" content={publisherName} />
          <meta name="designer" content={author} />
          <meta name="language" content="en-US" />
          <meta name="coverage" content="Worldwide" />

          {/* Dublin Core Meta Tags */}
          <meta name="DC.title" content={title} />
          <meta name="DC.creator" content={author} />
          <meta
            name="DC.subject"
            content="Government news, AI curation, content filtering"
          />
          <meta name="DC.description" content={description} />
          <meta name="DC.publisher" content={publisherName} />
          <meta name="DC.contributor" content="Son Nguyen" />
          <meta name="DC.date" content={new Date().toISOString()} />
          <meta name="DC.type" content="Text" />
          <meta name="DC.format" content="text/html" />
          <meta name="DC.identifier" content={siteUrl} />
          <meta name="DC.source" content={siteUrl} />
          <meta name="DC.language" content="en-US" />
          <meta name="DC.relation" content={`${siteUrl}/sitemap.xml`} />
          <meta name="DC.coverage" content="Worldwide" />
          <meta name="DC.rights" content="© 2025 Son Nguyen" />

          {/* Favicons & Touch Icons */}
          <link rel="icon" href="/favicon.ico" />
          <link
            rel="apple-touch-icon"
            sizes="180x180"
            href="/apple-touch-icon.png"
          />
          <link rel="manifest" href="/manifest.json" />

          {/* Preconnect */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
            rel="stylesheet"
          />

          {/* Multilingual alternates */}
          <link rel="alternate" href={siteUrl} hrefLang="en-US" />
          {/* <link rel="alternate" href="https://es.synthoraai.vercel.app" hrefLang="es-ES" /> */}

          {/* Open Graph */}
          <meta property="og:title" content={title} />
          <meta property="og:description" content={description} />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={siteUrl} />
          <meta property="og:image" content={imageUrl} />
          <meta property="og:image:width" content="192" />
          <meta property="og:image:height" content="192" />
          <meta property="og:image:alt" content="SynthoraAI Logo" />
          <meta
            property="og:site_name"
            content="SynthoraAI - AI Content Curator"
          />
          <meta property="og:locale" content="en_US" />

          {/* Twitter Card */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:site" content="@hoangsonwww" />
          <meta name="twitter:creator" content="@hoangsonwww" />
          <meta name="twitter:title" content={title} />
          <meta name="twitter:description" content={description} />
          <meta name="twitter:image" content={imageUrl} />
          <meta name="twitter:image:alt" content="SynthoraAI Logo" />

          {/* Canonical */}
          <link rel="canonical" href={siteUrl} />

          {/* Google Site Verification */}
          <meta
            name="google-site-verification"
            content="BJMztlbEd_3AQ4AlDSI0NqJMb-PmqRff5Qt7X9wEWjI"
          />

          {/* Structured Data – JSON-LD */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@graph": [
                  {
                    "@type": "Organization",
                    "@id": `${siteUrl}/#organization`,
                    name: "SynthoraAI, Inc.",
                    url: siteUrl,
                    logo: {
                      "@type": "ImageObject",
                      url: `${siteUrl}/favicon.ico`,
                    },
                  },
                  {
                    "@type": "WebSite",
                    "@id": `${siteUrl}/#website`,
                    url: siteUrl,
                    name: "Synthora AI - AI Article Curator",
                    description: description,
                    publisher: { "@id": `${siteUrl}/#organization` },
                    potentialAction: [
                      {
                        "@type": "SearchAction",
                        target: `${siteUrl}/?q={search_term_string}`,
                        "query-input": "required name=search_term_string",
                      },
                      {
                        "@type": "SearchAction",
                        target: `${siteUrl}/?q={search_term_string}&topic={topic}`,
                        "query-input": [
                          "required name=search_term_string",
                          "required name=topic",
                        ],
                      },
                    ],
                  },
                  {
                    "@type": "WebPage",
                    "@id": `${siteUrl}/#homepage`,
                    url: siteUrl,
                    name: "Home – SynthoraAI | AI Article Curator",
                    isPartOf: { "@id": `${siteUrl}/#website` },
                    inLanguage: "en-US",
                    breadcrumb: {
                      "@type": "BreadcrumbList",
                      itemListElement: [
                        {
                          "@type": "ListItem",
                          position: 1,
                          name: "Home",
                          item: siteUrl,
                        },
                      ],
                    },
                    potentialAction: {
                      "@type": "ReadAction",
                      target: [siteUrl],
                    },
                  },
                  {
                    "@type": "SiteNavigationElement",
                    name: "Main Navigation",
                    url: [
                      `${siteUrl}/`,
                      `${siteUrl}/newsletter`,
                      `${siteUrl}/auth/login`,
                      `${siteUrl}/auth/register`,
                      `${siteUrl}/auth/reset-password`,
                      `${siteUrl}/favorites/favorites`,
                      `${siteUrl}/ai_chat`
                    ],
                  },
                ],
              }),
            }}
          />

          {/* Google Analytics */}
          <script
            async
            src="https://www.googletagmanager.com/gtag/js?id=G-8K8KF8XSPD"
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', 'G-8K8KF8XSPD', { page_path: window.location.pathname });
              `,
            }}
          />

          {/* Theme initialization */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    const stored = localStorage.getItem('theme');
                    const useDark = stored === 'dark'
                      || (stored === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
                    const theme = useDark ? 'dark' : 'light';
                    document.documentElement.setAttribute('data-theme', theme);
                    const meta = document.querySelector('meta[name="theme-color"]');
                    if (meta) meta.content = useDark ? '#121212' : '#ffffff';
                  } catch {}
                })();
              `,
            }}
          />

          <style>{`
            html { background-color: var(--bg-color); }
            [data-theme="dark"] html { background-color: #121212; }
          `}</style>
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
