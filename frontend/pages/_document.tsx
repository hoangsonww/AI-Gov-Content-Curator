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
    return (
      <Html lang="en">
        <Head>
          {/* DEFAULT TITLE (site-wide). */}
          <title>
            Article Curator - AI-Powered News Article Content Curator
          </title>

          {/* Preconnect for Google Fonts */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />

          {/* Inter font (existing) */}
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
            rel="stylesheet"
          />

          {/* Primary meta tags */}
          <meta
            name="description"
            content="An AI-powered article curator for government staff."
          />

          {/* Additional SEO meta tags */}
          <meta
            name="keywords"
            content="article curator, AI articles, government articles, content curation, news aggregator, AI-powered"
          />
          <meta name="robots" content="index, follow" />
          <meta name="author" content="Son Nguyen" />
          <meta name="language" content="English" />

          {/* Theme color */}
          <meta name="theme-color" content="#ffffff" />

          {/* Apple Touch Icon */}
          <link
            rel="apple-touch-icon"
            sizes="180x180"
            href="/apple-touch-icon.png"
          />

          {/* Manifest */}
          <link rel="manifest" href="/manifest.json" />

          {/* Icons */}
          <link rel="icon" href="/favicon.ico" />

          {/* Open Graph (Facebook, LinkedIn) */}
          <meta property="og:title" content="Article Curator" />
          <meta
            property="og:description"
            content="Discover and manage government-related articles with ease, powered by AI."
          />
          <meta
            property="og:url"
            content="https://ai-article-curator.vercel.app/"
          />
          <meta property="og:type" content="website" />
          <meta
            property="og:image"
            content="https://ai-article-curator.vercel.app/android-chrome-192x192.png"
          />
          <meta property="og:site_name" content="AI-Powered Article Curator" />
          <meta property="og:locale" content="en_US" />

          {/* Twitter Card */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Article Curator" />
          <meta
            name="twitter:description"
            content="Discover and manage government-related articles with ease, powered by AI."
          />
          <meta
            name="twitter:image"
            content="https://ai-article-curator.vercel.app/android-chrome-192x192.png"
          />

          {/* Canonical URL */}
          <link rel="canonical" href="https://ai-article-curator.vercel.app/" />

          {/* Structured Data - JSON-LD */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "Article Curator",
                url: "https://ai-article-curator.vercel.app/",
                potentialAction: {
                  "@type": "SearchAction",
                  target:
                    "https://ai-article-curator.vercel.app/?q={search_term_string}",
                  "query-input": "required name=search_term_string",
                },
              }),
            }}
          />
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
