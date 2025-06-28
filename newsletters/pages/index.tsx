import Head from "next/head";

/**
 * Very simple landing screen for the Newsletter cron project.
 */
export default function Home() {
  return (
    <>
      <Head>
        <title>SynthoraAI | AI Article Curator – Newsletter Service</title>
        <meta
          name="description"
          content="This subproject only hosts a scheduled cron job that emails our daily newsletter. Head to the backend or frontend for the full experience."
        />
        <meta name="theme-color" content="#ffffff" />
        <link rel="icon" href="/favicon.ico" />

        {/* Roboto font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
          rel="stylesheet"
        />

        {/* Font Awesome */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.3.0/css/all.min.css"
          referrerPolicy="no-referrer"
        />
      </Head>

      <div className="page-wrapper">
        <header>
          <i className="fas fa-envelope-open-text logo-icon"></i>
          <div className="title">
            SynthoraAI - AI Article Curator – Newsletter Service
          </div>
        </header>

        <main className="main-content">
          <p className="description">
            You’ve reached the <strong>newsletter service</strong>, whose only
            purpose is to run a scheduled cron job that emails daily
            AI-summarised article digests to our subscribers.
          </p>

          <p className="description">
            There’s no interactive UI here. For details, please visit our{" "}
            <a
              href="https://ai-content-curator-backend.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
            >
              backend
            </a>{" "}
            or{" "}
            <a
              href="https://ai-gov-content-curator.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
            >
              frontend
            </a>{" "}
            websites.
          </p>

          <div className="cta-buttons">
            <button
              className="btn pulse"
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
              className="btn pulse"
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
              href="https://ai-gov-content-curator.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fas fa-globe"></i>
            </a>
            <a href="mailto:hoangson091104@gmail.com">
              <i className="fas fa-envelope"></i>
            </a>
          </div>
        </main>

        <footer>
          <p>&copy; 2025 AI Article Curator. All rights reserved.</p>
        </footer>
      </div>

      {/* @ts-ignore */}
      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        html,
        body {
          height: 100vh;
          font-family: "Roboto", sans-serif;
          background-color: #f5f7fa;
          color: #333;
        }

        /* wrapper & font */
        .page-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: "Roboto", sans-serif;
          color: #333;
          text-align: center;
          background-color: #ffffff;
          background-size: 400% 400%;
          animation: bgShift 15s ease infinite;
          padding: 0 1rem;
        }

        /* header */
        header {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 2rem;
        }
        .logo-icon {
          font-size: 4rem;
          color: #0d6efd;
          animation: float 4s ease-in-out infinite;
        }
        .title {
          font-size: 2rem;
          font-weight: 700;
          margin-top: 0.5rem;
          animation: fadeIn 2s ease both;
        }

        /* descriptions */
        .description {
          max-width: 600px;
          margin: 0.75rem auto;
          line-height: 1.6;
          animation: fadeIn 2s ease both;
        }

        /* buttons */
        .cta-buttons {
          margin: 2rem 0;
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          justify-content: center;
        }
        .btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #0d6efd;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          cursor: pointer;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
          transition:
            transform 0.2s,
            box-shadow 0.2s;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.15);
        }
        .pulse {
          animation: pulse 3s ease-in-out infinite;
        }

        /* icon links */
        .icon-links {
          margin-top: 1.5rem;
          display: flex;
          gap: 1.5rem;
          justify-content: center;
        }
        .icon-links i {
          font-size: 1.6rem;
          color: #333;
          transition:
            transform 0.2s,
            color 0.3s;
        }
        .icon-links i:hover {
          transform: scale(1.2);
          color: #0d6efd;
        }

        /* footer */
        footer {
          margin-top: 3rem;
          font-size: 0.875rem;
          color: #666;
          animation: fadeIn 2s ease both;
        }

        /* Keyframes */
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes bgShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </>
  );
}
