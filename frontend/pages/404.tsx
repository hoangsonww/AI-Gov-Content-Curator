import Head from "next/head";
import Link from "next/link";

export default function Custom404() {
  return (
    <>
      <Head>
        <title>404: Page Not Found | AI Article Content Curator</title>
        <meta
          name="description"
          content="The page you are looking for does not exist."
        />
        <meta name="theme-color" content="#000000" />
        <link rel="icon" href="/favicon.ico" />
        {/* Load Inter Font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        {/* Load Font Awesome for icons */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.3.0/css/all.min.css"
          referrerPolicy="no-referrer"
        />
      </Head>
      <div className="container">
        <div className="icon-wrapper">
          <i className="fas fa-exclamation-triangle"></i>
        </div>
        <h1 className="title">404 - Page Not Found</h1>
        <p className="message">
          Oops! We couldn’t find the page you’re looking for.
        </p>
        <Link href="/" legacyBehavior>
          <a className="home-link">
            <span>Return Home</span>
            <i className="fas fa-arrow-right"></i>
          </a>
        </Link>
      </div>
      <style jsx>{`
        .container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 2rem;
          background: linear-gradient(135deg, #000000, #2f2f2f);
          background-size: 300% 300%;
          animation: gradientShift 8s ease infinite;
          color: #f5f5f5;
          font-family: "Inter", sans-serif;
          border-radius: 8px;
        }
        .icon-wrapper {
          font-size: 5rem;
          margin-bottom: 1rem;
          animation: bounce 1s infinite;
        }
        .title {
          font-size: 3rem;
          margin-bottom: 1rem;
          animation: fadeDown 1s ease;
        }
        .message {
          font-size: 1.25rem;
          margin-bottom: 2rem;
          animation: fadeIn 1s ease;
        }
        .home-link {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background-color: #4af7bf;
          color: #121212;
          padding: 0.75rem 1.5rem;
          border-radius: 5px;
          font-weight: 600;
          text-decoration: none;
          transition:
            background-color 0.3s ease,
            transform 0.3s ease;
        }
        .home-link:hover {
          background-color: #3ce3ae;
          transform: translateY(-3px);
        }
        .home-link i {
          transition: transform 0.3s ease;
        }
        .home-link:hover i {
          transform: translateX(4px);
        }
        @keyframes gradientShift {
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
        @keyframes fadeDown {
          0% {
            opacity: 0;
            transform: translateY(-20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes bounce {
          0%,
          20%,
          50%,
          80%,
          100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-20px);
          }
          60% {
            transform: translateY(-10px);
          }
        }
      `}</style>
    </>
  );
}
