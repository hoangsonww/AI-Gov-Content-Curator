import Head from "next/head";

/**
 * Very simple Homepage if user navigates to the crawler -- it should just redirect to the backend or frontend.
 * Served just in case someone tries to access the crawler's deployed URL directly.
 * Since crawler is a cron job, it doesn't need a frontend.
 */
export default function Home() {
  return (
    <>
      <Head>
        <title>SynthoraAI | AI Content Curator - Crawler</title>
        <meta
          name="description"
          content="Crawler for cron job only. Visit our backend or frontend for more info."
        />
        <meta name="theme-color" content="#000000" />
        <link rel="icon" href="/favicon.ico" />

        {/* Roboto Font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
          rel="stylesheet"
        />

        {/* Font Awesome (No Integrity) */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.3.0/css/all.min.css"
          referrerPolicy="no-referrer"
        />
      </Head>

      {/* PAGE CONTENT */}
      <div className="page-wrapper">
        <header>
          <i className="fas fa-robot logo-icon"></i>
          <div className="title">
            SynthoraAI - AI Content Curator - Crawler Service
          </div>
        </header>

        <div className="main-content">
          <p className="description">
            This subproject is a <strong>crawler</strong> for scheduled cron
            jobs. It runs periodically to fetch, summarize, and store the latest
            articles from official government websites and news sources, for the
            convenience of public officials.
          </p>

          <p className="description">
            For more information, please visit our dedicated{" "}
            <a
              href="https://ai-content-curator-backend.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
            >
              Backend
            </a>{" "}
            or our{" "}
            <a
              href="https://ai-gov-content-curator.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
            >
              Frontend
            </a>
            .
          </p>

          <div className="cta-buttons">
            <button
              className="btn"
              onClick={() =>
                window.open(
                  "https://ai-content-curator-backend.vercel.app",
                  "_blank",
                )
              }
            >
              <span>Go to Backend</span>
              <i className="fas fa-arrow-right"></i>
            </button>
            <button
              className="btn"
              onClick={() =>
                window.open(
                  "https://ai-gov-content-curator.vercel.app",
                  "_blank",
                )
              }
            >
              <span>Go to Frontend</span>
              <i className="fas fa-arrow-right"></i>
            </button>
          </div>

          <div className="icon-links">
            <a
              href="https://github.com/hoangsonww/AI-Gov-Content-Curator"
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fab fa-github"></i>
            </a>
            <a
              href="https://synthoraai.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fas fa-globe"></i>
            </a>
            <a href="mailto:hoangson091104@gmail.com">
              <i className="fas fa-envelope"></i>
            </a>
            <a
              href="https://github.com/hoangsonww/AI-Gov-Content-Curator/tree/master/crawler#readme"
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fas fa-info-circle"></i>
            </a>
          </div>
        </div>

        <footer>
          <p>&copy; 2025 SynthoraAI. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
}
