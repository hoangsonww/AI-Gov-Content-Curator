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
          {/* DEFAULT TITLE (site-wide). You can override in pages if needed. */}
          <title>Article Curator</title>

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
          <link rel="icon" href="/favicon.ico" />

          {/* Open Graph (Facebook, LinkedIn) */}
          <meta property="og:title" content="Article Curator" />
          <meta
            property="og:description"
            content="Discover and manage government-related articles with ease, powered by AI."
          />
          <meta property="og:url" content="https://your-domain.com" />
          <meta property="og:type" content="website" />
          <meta
            property="og:image"
            content="https://your-domain.com/og-image.jpg"
          />

          {/* Twitter Card */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Article Curator" />
          <meta
            name="twitter:description"
            content="Discover and manage government-related articles with ease, powered by AI."
          />
          <meta
            name="twitter:image"
            content="https://your-domain.com/twitter-image.jpg"
          />

          {/* Canonical link (if you have a primary domain) */}
          <link rel="canonical" href="https://your-domain.com" />
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
