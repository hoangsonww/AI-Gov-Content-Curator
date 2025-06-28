import { GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  MdSearch,
  MdArticle,
  MdTopic,
  MdFavorite,
  MdNotifications,
  MdQuestionAnswer,
  MdKeyboardArrowDown,
  MdStar,
  MdViewList,
  MdMail,
  MdLock,
  MdEmail,
  MdHelp,
  MdPerson,
} from "react-icons/md";
import { AiFillGithub } from "react-icons/ai";

const rotatingWords = [
  "Aggregate",
  "Summarize",
  "Curate",
  "Monitor",
  "Analyze",
  "Track",
  "Discover",
  "Filter",
  "Highlight",
];

function CountUp({
  end,
  label,
  duration = 2000,
  delay = 0,
}: {
  end: number;
  label: string;
  duration?: number;
  delay?: number;
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const start = 0;
    const range = end - start;
    const steps = Math.max(1, Math.ceil(duration / 16));
    const stepTime = duration / steps;
    let current = start;
    let stepCount = 0;
    const timer = setTimeout(function tick() {
      stepCount++;
      current = Math.min(end, Math.floor((range * stepCount) / steps + start));
      setCount(current);
      if (stepCount < steps) {
        setTimeout(tick, stepTime);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [end, duration, delay]);

  return (
    <div className="stat-card reveal">
      <span className="stat-number">{count.toLocaleString()}+</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export default function LandingPage() {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const iv = setInterval(
      () => setWordIndex((i) => (i + 1) % rotatingWords.length),
      2000,
    );
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.2 },
    );
    els.forEach((el) => io.observe(el));
    return () => els.forEach((el) => io.unobserve(el));
  }, []);

  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <Head>
        <title>SynthoraAI - AI-Powered News Curation</title>
        <meta
          name="description"
          content="Discover, search, and curate the latest news articles - summarized by AI for you."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main>
        {/* Hero Section */}
        <section className="hero">
          <div className="extra-ball-left" />
          <div className="extra-ball" />
          <div className="hero-content reveal">
            <h1>SynthoraAI</h1>
            <p>
              The AI-powered face of up-to-date news - aggregate, summarize, and
              stay informed in seconds.
            </p>
            <p className="hero-tagline">
              <span className="rotating-word">{rotatingWords[wordIndex]}</span>{" "}
              your news in real time.
            </p>
            <div className="hero-buttons">
              <Link href="/home" className="btn primary">
                Explore Articles
              </Link>
              <Link href="/auth/register" className="btn secondary">
                Get Started
              </Link>
              <Link href="/newsletter" className="btn tertiary">
                Newsletter
              </Link>
              <Link href="/auth/login" className="btn outline">
                Log In
              </Link>
            </div>
            <div className="scroll-down" onClick={scrollToFeatures}>
              <MdKeyboardArrowDown size={24} />
              <span className="scroll-text" style={{ fontSize: 16 }}>
                Learn More
              </span>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="features">
          <h2>Key Features</h2>
          <p className="section-subtitle">
            Discover powerful tools at your fingertips.
          </p>
          <div className="feature-grid reveal">
            {[
              {
                icon: MdSearch,
                title: "Advanced Search",
                desc: "Filter by keyword, topic, source - or all at once.",
              },
              {
                icon: MdArticle,
                title: "AI Summaries",
                desc: "Auto-generated, concise summaries for every article.",
              },
              {
                icon: MdTopic,
                title: "Topic Tags",
                desc: "Organize content with dynamic topic filters.",
              },
              {
                icon: MdFavorite,
                title: "Favorites",
                desc: "Save and revisit your go-to articles anytime.",
              },
              {
                icon: MdNotifications,
                title: "Daily Updates",
                desc: "Never miss a beat with curated daily digests.",
              },
              {
                icon: MdQuestionAnswer,
                title: "Article Q&A",
                desc: "Ask AI questions right on the article page.",
              },
              {
                icon: MdStar,
                title: "Top Articles",
                desc: "Browse our hand-picked top articles of the day.",
              },
              {
                icon: MdViewList,
                title: "All Articles",
                desc: "Access the complete archive of curated content.",
              },
              {
                icon: MdMail,
                title: "Newsletter",
                desc: "Receive daily summaries straight to your inbox.",
              },
              {
                icon: MdLock,
                title: "Authentication",
                desc: "Secure login & registration for personalized features.",
              },
            ].map((f, i) => (
              <div key={i} className="feature-card">
                <f.icon size={48} />
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats Section */}
        <section className="stats">
          <h2>Our Numbers</h2>
          <p className="section-subtitle">Numbers that speak for themselves.</p>
          <div className="stats-grid reveal">
            <CountUp end={2000} label="Articles Curated" delay={200} />
            <CountUp end={200} label="Sources Integrated" delay={600} />
            <CountUp end={1200} label="Daily Subscribers" delay={1000} />
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="testimonials">
          <h2>What Our Users Say</h2>
          <p className="section-subtitle">
            Real feedback from our community of policymakers.
          </p>
          <div className="testimonial-grid reveal">
            <div className="testimonial-card">
              <p>
                “SynthoraAI - AI Article Curator is indispensable for my
                legislative research. The AI summaries let me grasp policy
                briefs in seconds - crucial when I’m preparing for committee
                hearings.”
              </p>
              <h4> - Senator Emily Carter</h4>
            </div>
            <div className="testimonial-card">
              <p>
                “As a city councilor, I need to stay on top of local and
                national developments. The topic filters and daily digests keep
                me informed and ready for any council session.”
              </p>
              <h4> - Councilor David Kim</h4>
            </div>
            <div className="testimonial-card">
              <p>
                “The ability to favorite and revisit key articles has
                streamlined how my team briefs me. A must-have tool for any
                legislative office.”
              </p>
              <h4> - Representative Michael Nguyen</h4>
            </div>
            <div className="testimonial-card">
              <p>
                “I rely on the Article Q&A feature to get quick clarifications
                on complex government reports. It’s like having an assistant who
                never sleeps.”
              </p>
              <h4> - Policy Advisor Laura Martínez</h4>
            </div>
            <div className="testimonial-card">
              <p>
                “The ‘Top Articles’ showcase gives me a quick snapshot of what
                my colleagues are discussing. It’s helped me prioritize my daily
                reading efficiently.”
              </p>
              <h4> - Congressman David Chen</h4>
            </div>
            {/* Three more testimonials below */}
            <div className="testimonial-card">
              <p>
                “As Legislative Director, I depend on SynthoraAI - AI Article
                Curator to monitor emerging bills. Its real-time alerts have
                saved our office countless hours in legislative prep.”
              </p>
              <h4> - Legislative Director Maria Sánchez</h4>
            </div>
            <div className="testimonial-card">
              <p>
                “I manage communications for a governor’s office, and the
                newsletter feature keeps our press team on the same page. We’ve
                never been more aligned.”
              </p>
              <h4> - Public Affairs Officer Robert Lee</h4>
            </div>
            <div className="testimonial-card">
              <p>
                “As Senate Majority Leader, I need fast access to reliable
                summaries. SynthoraAI - AI Article Curator’s AI ensures I’m
                always prepped for cross–committee discussions.”
              </p>
              <h4> - Senator Anna Thompson</h4>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="faq">
          <h2>Frequently Asked Questions</h2>
          <p className="section-subtitle">Got questions? We’ve got answers.</p>
          <div className="faq-list reveal">
            <details>
              <summary>What is SynthoraAI - AI Article Curator?</summary>
              <p>
                SynthoraAI - AI Article Curator is an AI-powered tool that
                gathers, summarizes, and organizes government-related news so
                you can stay informed in seconds.
              </p>
            </details>
            <details>
              <summary>How do I get started?</summary>
              <p>
                Just click “Get Started” above, register for a free account, and
                start exploring the latest articles right away.
              </p>
            </details>
            <details>
              <summary>Is it free to use?</summary>
              <p>
                Yes - core features (search, summaries, favorites) are
                completely free. Premium newsletter scheduling is available for
                registered users.
              </p>
            </details>
            <details>
              <summary>Do I need an account?</summary>
              <p>
                No - anyone can browse and read. To save favorites, subscribe to
                the newsletter, or customize your experience, just sign up in
                seconds.
              </p>
            </details>
            <details>
              <summary>How often is content updated?</summary>
              <p>
                New content appears every 10 seconds via static page
                regeneration, and our crawler fetches fresh articles daily at
                6:00 AM UTC.
              </p>
            </details>
            <details>
              <summary>Can I filter by topic?</summary>
              <p>
                Absolutely - use the topic dropdown to narrow results to the
                subjects you care about most.
              </p>
            </details>
            <details>
              <summary>How do I save articles for later?</summary>
              <p>
                Register and log in, then click the “★” on any summary to add it
                to your favorites list.
              </p>
            </details>
            <details>
              <summary>How do I subscribe to the newsletter?</summary>
              <p>
                Enter your email in the newsletter section, hit “Subscribe,” and
                you’ll receive daily digests straight to your inbox.
              </p>
            </details>
            <details>
              <summary>Can I switch to dark mode?</summary>
              <p>
                Yes - use the theme switcher in the navbar to toggle between
                light, dark, or system settings.
              </p>
            </details>
            <details>
              <summary>Is my data secure?</summary>
              <p>
                We use industry-standard encryption (TLS, AES-256) to protect
                your information both in transit and at rest.
              </p>
            </details>
            <details>
              <summary>
                Who can benefit from SynthoraAI - AI Article Curator?
              </summary>
              <p>
                Government staff, legislators, policy advisors, and anyone
                needing quick, reliable summaries of official news and releases.
              </p>
            </details>
          </div>
        </section>

        {/* Partners Section */}
        <section className="partners">
          <div className="container">
            <h2>Our Partners</h2>
            <p className="section-subtitle">
              Where our articles are sourced from.
            </p>
            <div className="partner-grid">
              {[
                "White House Briefing Room",
                "Congress.gov",
                "BBC News",
                "The New York Times",
                "Dallas Morning News",
                "Houston Chronicle",
                "State.gov",
                "Washington Post",
                "Austin American-Statesman",
                "AP News",
                "USA.gov",
                "ABC News",
              ].map((org) => (
                <div key={org} className="partner-logo">
                  {org}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="contact">
          <h2>Get in Touch</h2>
          <p className="section-subtitle">
            Questions, feedback, or partnership inquiries? We’re here to help.
          </p>
          <div className="contact-grid reveal">
            <div className="contact-card">
              <MdPerson size={32} />
              <h3>Contact the Creator</h3>
              <p>
                Drop me a line directly on{" "}
                <a href="https://www.linkedin.com/in/hoangsonw/">LinkedIn</a>
              </p>
            </div>
            <div className="contact-card">
              <MdEmail size={32} />
              <h3>Email Support</h3>
              <p>
                Reach out at{" "}
                <a href="mailto:hoangson091104@gmail.com">
                  hoangson091104@gmail.com
                </a>
              </p>
            </div>
            <div className="contact-card">
              <MdHelp size={32} />
              <h3>Read the Docs</h3>
              <p>
                Explore our API and developer guides on{" "}
                <a href="https://ai-content-curator-backend.vercel.app/">
                  Swagger Docs
                </a>
              </p>
            </div>
            <div className="contact-card">
              <AiFillGithub size={32} />
              <h3>Report an Issue</h3>
              <p>
                File bugs or feature requests on{" "}
                <a href="https://github.com/hoangsonww/AI-Gov-Content-Curator/issues">
                  GitHub Issues
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="final-cta reveal">
          <h2>Ready to Stay Informed?</h2>
          <p className="section-subtitle">
            Join thousands using SynthoraAI - AI Article Curator daily.
          </p>
          <div className="final-buttons">
            <Link href="/auth/register" className="btn primary">
              Sign Up Now
            </Link>
            <Link href="/home" className="btn outline">
              Explore Articles
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => ({
  props: {},
});
