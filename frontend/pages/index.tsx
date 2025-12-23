import { GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
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
  MdPublic,
  MdCampaign,
  MdAnalytics,
  MdGavel,
  MdInsights,
  MdTimeline,
  MdAutoAwesome,
  MdPsychology,
  MdSummarize,
  MdDocumentScanner,
  MdBalance,
  MdShield,
  MdVerified,
} from "react-icons/md";
import {
  SiAmazonwebservices,
  SiTerraform,
  SiKubernetes,
  SiDocker,
  SiPrometheus,
  SiGrafana,
  SiGithubactions,
  SiAmazoncloudwatch,
} from "react-icons/si";
import { AiFillGithub } from "react-icons/ai";

const rotatingWords = [
  "Aggregate",
  "Summarize",
  "Curate",
  "Monitor",
  "Analyze",
  "Track",
  "Discover",
  "Verify",
  "Prioritize",
];

const heroBadges = {
  ai: [
    "LLM summaries",
    "RAG Q&A",
    "Vector search",
    "Entity extraction",
    "Bias analysis",
  ],
  deploy: [
    "AWS",
    "Terraform",
    "Kubernetes",
    "Blue/green deploys",
    "CI/CD",
  ],
};

const heroMetrics = [
  { value: "2K+", label: "curated briefs" },
  { value: "200+", label: "trusted sources" },
  { value: "10s", label: "refresh cycle" },
];

const heroSignals = [
  { label: "Energy + climate", value: "18% lift in coverage" },
  { label: "Procurement", value: "7 agencies updated" },
  { label: "Cybersecurity", value: "new directives detected" },
];

const heroMiniCards = [
  { title: "Daily Briefing", desc: "6:00 AM UTC digest" },
  { title: "Bias Scan", desc: "compare framing by source" },
  { title: "RAG Q&A", desc: "ask across the archive" },
];

const tickerItems = [
  "Rulemaking updates",
  "Budget allocations",
  "Agency directives",
  "Legislative hearings",
  "Procurement alerts",
  "Press coverage",
];

const highlights = [
  {
    icon: MdGavel,
    title: "Policy-grade curation",
    desc: "Built for government teams who need accuracy, provenance, and speed.",
  },
  {
    icon: MdInsights,
    title: "Signal over noise",
    desc: "Ranked briefs, bias signals, and topic clusters keep attention on what matters.",
  },
  {
    icon: MdTimeline,
    title: "Always current",
    desc: "Automated crawlers and refresh cycles keep briefs up to date all day.",
  },
];

const useCases = [
  {
    icon: MdGavel,
    title: "Legislative offices",
    desc: "Track bills, committee activity, and voting windows with curated context.",
    tags: ["Bills", "Hearings", "Floor votes"],
  },
  {
    icon: MdPublic,
    title: "Agency communications",
    desc: "Coordinate messaging with real-time releases and policy guidance.",
    tags: ["Press releases", "Guidance", "Stakeholder memos"],
  },
  {
    icon: MdCampaign,
    title: "Policy research",
    desc: "Compare framing, sentiment, and bias across sources in minutes.",
    tags: ["Bias analysis", "Source compare", "Trend signals"],
  },
  {
    icon: MdAnalytics,
    title: "Executive briefings",
    desc: "Deliver leadership-ready summaries with key actions and risks.",
    tags: ["Morning brief", "Priority alerts", "Risk radar"],
  },
];

const capabilities = [
  {
    icon: MdSearch,
    title: "Advanced search",
    desc: "Filter by agency, topic, source, geography, or time window.",
  },
  {
    icon: MdSummarize,
    title: "AI summaries",
    desc: "LLM-generated summaries that surface key actions and impacts.",
  },
  {
    icon: MdTopic,
    title: "Topic tags",
    desc: "Dynamic topic taxonomy tailored to public-sector domains.",
  },
  {
    icon: MdViewList,
    title: "Related articles",
    desc: "Connect coverage across outlets and official releases.",
  },
  {
    icon: MdBalance,
    title: "Bias analysis",
    desc: "Compare framing and sentiment across sources.",
  },
  {
    icon: MdStar,
    title: "Ratings & feedback",
    desc: "Score briefs to train relevance and prioritize future feeds.",
  },
  {
    icon: MdQuestionAnswer,
    title: "Article Q&A",
    desc: "Ask AI questions directly on any article detail page.",
  },
  {
    icon: MdNotifications,
    title: "Daily updates",
    desc: "Stay ahead with scheduled digests and alerting.",
  },
  {
    icon: MdMail,
    title: "Newsletter automation",
    desc: "Send curated summaries to stakeholders in seconds.",
  },
  {
    icon: MdFavorite,
    title: "Favorites",
    desc: "Save, organize, and revisit critical briefings.",
  },
  {
    icon: MdArticle,
    title: "Top articles",
    desc: "Surface the most relevant briefs of the day.",
  },
  {
    icon: MdLock,
    title: "Secure accounts",
    desc: "Role-aware access with secure authentication.",
  },
];

const aiCapabilities = [
  {
    icon: MdAutoAwesome,
    title: "LLM summarization",
    desc: "Concise briefs with highlights, impacts, and next steps.",
  },
  {
    icon: MdPsychology,
    title: "Retrieval Q&A",
    desc: "RAG answers grounded in your curated sources.",
  },
  {
    icon: MdDocumentScanner,
    title: "Entity extraction",
    desc: "Capture agencies, programs, bills, and officials.",
  },
  {
    icon: MdInsights,
    title: "Trend detection",
    desc: "Track emerging signals across agencies and regions.",
  },
  {
    icon: MdTopic,
    title: "Topic modeling",
    desc: "Cluster coverage into clear policy themes.",
  },
  {
    icon: MdBalance,
    title: "Bias + sentiment",
    desc: "Compare tone and framing across outlets.",
  },
];

const workflowSteps = [
  {
    icon: MdDocumentScanner,
    title: "Ingest",
    desc: "Scheduled crawlers gather releases, reports, and news.",
  },
  {
    icon: MdSummarize,
    title: "Summarize + tag",
    desc: "LLM summaries, topics, and metadata generated instantly.",
  },
  {
    icon: MdInsights,
    title: "Analyze + rank",
    desc: "Relevance scoring, bias checks, and trend signals.",
  },
  {
    icon: MdMail,
    title: "Distribute",
    desc: "Briefings, alerts, and newsletters delivered on schedule.",
  },
];

const stackCards = [
  {
    icon: SiAmazonwebservices,
    title: "AWS",
    desc: "ECS/EKS, S3, Route53, and global infrastructure.",
  },
  {
    icon: SiTerraform,
    title: "Terraform IaC",
    desc: "Repeatable deployments across environments.",
  },
  {
    icon: SiKubernetes,
    title: "Kubernetes",
    desc: "Canary and progressive rollouts at scale.",
  },
  {
    icon: SiDocker,
    title: "Docker",
    desc: "Containerized services for consistent delivery.",
  },
  {
    icon: SiAmazoncloudwatch,
    title: "CloudWatch",
    desc: "Logs, alarms, and operational visibility.",
  },
  {
    icon: SiPrometheus,
    title: "Prometheus",
    desc: "Metrics and alerting for critical services.",
  },
  {
    icon: SiGrafana,
    title: "Grafana",
    desc: "Dashboards that keep teams aligned.",
  },
  {
    icon: SiGithubactions,
    title: "CI/CD",
    desc: "Automated pipelines with approvals and checks.",
  },
];

const trustCards = [
  {
    icon: MdShield,
    title: "Encrypted by default",
    desc: "TLS in transit and AES-256 at rest protect every briefing.",
  },
  {
    icon: MdLock,
    title: "Least-privilege access",
    desc: "Role-aware authentication and secure secrets handling.",
  },
  {
    icon: MdVerified,
    title: "Audit-ready governance",
    desc: "Operational controls designed for compliance workflows.",
  },
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
      <span className="stat-number reveal">{count.toLocaleString()}+</span>
      <span className="stat-label reveal">{label}</span>
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
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const target = entry.target as HTMLElement;
          requestAnimationFrame(() => target.classList.add("visible"));
          io.unobserve(target);
        });
      },
      { threshold: 0.2 },
    );

    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <Head>
        <title>SynthoraAI - Government Content Intelligence</title>
        <meta
          name="description"
          content="AI-powered government news curation with summaries, Q&A, bias analysis, and AWS + Terraform-ready deployment."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="landing-page">
        <section className="hero">
          <div className="hero-ambient" aria-hidden="true">
            <span className="hero-orb orb-1" />
            <span className="hero-orb orb-2" />
            <span className="hero-orb orb-3" />
            <span className="hero-ring ring-1" />
            <span className="hero-ring ring-2" />
            <span className="hero-arc" />
            <span className="hero-drift" />
            <span className="hero-scan" />
          </div>
          <div className="landing-container hero-layout">
            <div className="hero-copy reveal">
              <span className="eyebrow">Government AI intelligence platform</span>
              <h1 className="hero-title reveal">
                SynthoraAI
              </h1>
              <p className="hero-subtitle reveal">
                Aggregate agency releases, legislative updates, and trusted news
                into a single source of truth. Summaries, Q&A, and bias signals
                help teams act fast without losing rigor.
              </p>
              <p className="hero-tagline reveal">
                <span className="rotating-word">
                  {rotatingWords[wordIndex]}
                </span>{" "}
                policy coverage in real time.
              </p>
              <div className="hero-actions reveal">
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
              <div className="hero-badges reveal">
                <div className="hero-badge-group reveal">
                  <span className="badge-label">AI engine</span>
                  <div className="badge-row">
                    {heroBadges.ai.map((badge) => (
                      <span key={badge} className="badge reveal">
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="hero-badge-group reveal">
                  <span className="badge-label">Deployment</span>
                  <div className="badge-row">
                    {heroBadges.deploy.map((badge) => (
                      <span key={badge} className="badge alt reveal">
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="hero-metrics reveal">
                {heroMetrics.map((metric) => (
                  <div key={metric.label} className="hero-metric reveal">
                    <span className="metric-value">{metric.value}</span>
                    <span className="metric-label">{metric.label}</span>
                  </div>
                ))}
              </div>
              <div className="hero-ticker reveal">
                <div className="ticker-track">
                  {tickerItems.concat(tickerItems).map((item, index) => (
                    <span key={`${item}-${index}`} className="ticker-item reveal">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="hero-visual reveal">
              <div className="hero-dashboard reveal">
                <div className="dashboard-header reveal">
                  <span className="status-dot" />
                  <span className="dashboard-title">Live policy signal</span>
                  <span className="pill">Updated 10s</span>
                </div>
                <div className="dashboard-metric reveal">
                  <span className="metric-value reveal">2,014</span>
                  <span className="metric-label reveal">
                    briefs processed today
                  </span>
                </div>
                <div className="dashboard-list">
                  {heroSignals.map((signal) => (
                    <div key={signal.label} className="dashboard-item reveal">
                      <span className="reveal">{signal.label}</span>
                      <strong className="reveal">{signal.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hero-mini-grid">
                {heroMiniCards.map((card) => (
                  <div key={card.title} className="hero-mini-card reveal">
                    <h4 className="reveal">{card.title}</h4>
                    <p className="reveal">{card.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button
            className="scroll-down reveal"
            type="button"
            onClick={scrollToFeatures}
          >
            {/* @ts-ignore */}
            <MdKeyboardArrowDown size={24} />
            <span className="scroll-text">Learn More</span>
          </button>
        </section>

        <section className="highlights">
          <div className="landing-container">
            <div className="section-head reveal">
              <span className="eyebrow">Purpose built</span>
              <h2>Briefings that stand up to scrutiny</h2>
              <p className="section-subtitle">
                SynthoraAI turns high-volume government news into concise,
                actionable intelligence for policy teams.
              </p>
            </div>
            <div className="highlight-grid">
              {highlights.map((item, index) => (
                <div
                  key={item.title}
                  className="highlight-card reveal"
                  style={{
                    "--delay": `${index * 120}ms`,
                  } as CSSProperties}
                >
                  {/* @ts-ignore */}
                  <item.icon size={32} />
                  <h3 className="reveal">{item.title}</h3>
                  <p className="reveal">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="use-cases">
          <div className="landing-container">
            <div className="section-head reveal">
              <span className="eyebrow">Who it serves</span>
              <h2>Built for every policy workflow</h2>
              <p className="section-subtitle">
                Tailored briefings for legislative, agency, and executive teams.
              </p>
            </div>
            <div className="use-case-grid">
              {useCases.map((useCase, index) => (
                <div
                  key={useCase.title}
                  className="use-case-card reveal"
                  style={{
                    "--delay": `${index * 120}ms`,
                  } as CSSProperties}
                >
                  <div className="use-case-header">
                    {/* @ts-ignore */}
                    <useCase.icon size={28} />
                    <h3 className="reveal">{useCase.title}</h3>
                  </div>
                  <p className="reveal">{useCase.desc}</p>
                  <div className="use-case-tags">
                    {useCase.tags.map((tag) => (
                      <span key={tag} className="tag reveal">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="capabilities">
          <div className="landing-container">
            <div className="section-head reveal">
              <span className="eyebrow">Core capabilities</span>
              <h2>Everything your team needs to stay ahead</h2>
              <p className="section-subtitle">
                From discovery to delivery, every workflow is designed for
                government professionals.
              </p>
            </div>
            <div className="capability-grid">
              {capabilities.map((capability, index) => (
                <div
                  key={capability.title}
                  className="capability-card reveal"
                  style={{
                    "--delay": `${index * 80}ms`,
                  } as CSSProperties}
                >
                  {/* @ts-ignore */}
                  <capability.icon size={28} />
                  <h3 className="reveal">{capability.title}</h3>
                  <p className="reveal">{capability.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="ai-suite">
          <div className="landing-container">
            <div className="section-head reveal">
              <span className="eyebrow">AI intelligence</span>
              <h2>Built on modern AI and retrieval systems</h2>
              <p className="section-subtitle">
                Advanced NLP, RAG workflows, and ranking models surface the most
                relevant insights fast.
              </p>
            </div>
            <div className="ai-grid">
              {aiCapabilities.map((capability, index) => (
                <div
                  key={capability.title}
                  className="ai-card reveal"
                  style={{
                    "--delay": `${index * 100}ms`,
                  } as CSSProperties}
                >
                  {/* @ts-ignore */}
                  <capability.icon size={28} />
                  <h3 className="reveal">{capability.title}</h3>
                  <p className="reveal">{capability.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="workflow">
          <div className="landing-container">
            <div className="section-head reveal">
              <span className="eyebrow">How it works</span>
              <h2>From ingestion to briefing in minutes</h2>
              <p className="section-subtitle">
                Automated pipelines ensure every story is captured, analyzed,
                and delivered with context.
              </p>
            </div>
            <div className="workflow-grid">
              {workflowSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="workflow-card reveal"
                  style={{
                    "--delay": `${index * 120}ms`,
                  } as CSSProperties}
                >
                  <div className="workflow-index reveal">0{index + 1}</div>
                  {/* @ts-ignore */}
                  <step.icon size={30} />
                  <h3 className="reveal">{step.title}</h3>
                  <p className="reveal">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="stack">
          <div className="landing-container">
            <div className="section-head reveal">
              <span className="eyebrow">Deployment ready</span>
              <h2>Built for AWS, Terraform, and enterprise operations</h2>
              <p className="section-subtitle">
                Production-grade infrastructure with observability, CI/CD, and
                progressive delivery baked in.
              </p>
            </div>
            <div className="stack-grid">
              {stackCards.map((stack, index) => (
                <div
                  key={stack.title}
                  className="stack-card reveal"
                  style={{
                    "--delay": `${index * 80}ms`,
                  } as CSSProperties}
                >
                  {/* @ts-ignore */}
                  <stack.icon size={28} />
                  <div>
                    <h3 className="reveal">{stack.title}</h3>
                    <p className="reveal">{stack.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="trust-block">
              <h3 className="reveal">Security and governance</h3>
              <div className="trust-grid">
                {trustCards.map((trust, index) => (
                  <div
                    key={trust.title}
                    className="trust-card reveal"
                    style={{
                      "--delay": `${index * 120}ms`,
                    } as CSSProperties}
                  >
                    {/* @ts-ignore */}
                    <trust.icon size={26} />
                    <h4 className="reveal">{trust.title}</h4>
                    <p className="reveal">{trust.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="stats">
          <div className="landing-container">
            <div className="section-head reveal">
              <span className="eyebrow">Impact</span>
              <h2>Numbers that back every briefing</h2>
              <p className="section-subtitle">
                Trusted by policy teams for speed, coverage, and accuracy.
              </p>
            </div>
            <div className="stats-grid">
              <CountUp end={2000} label="Articles Curated" delay={200} />
              <CountUp end={200} label="Sources Integrated" delay={600} />
              <CountUp end={1200} label="Daily Subscribers" delay={1000} />
            </div>
          </div>
        </section>

        <section className="testimonials">
          <div className="landing-container">
            <div className="section-head reveal">
              <span className="eyebrow">Testimonials</span>
              <h2>Trusted by policy leaders</h2>
              <p className="section-subtitle">
                Real feedback from teams who rely on SynthoraAI every day.
              </p>
            </div>
            <div className="testimonial-grid">
              <div className="testimonial-card reveal">
                <p className="reveal">
                  “SynthoraAI - AI Article Curator is indispensable for my
                  legislative research. The AI summaries let me grasp policy
                  briefs in seconds - crucial when I’m preparing for committee
                  hearings.”
                </p>
                <h4 className="reveal"> - Senator Emily Carter</h4>
              </div>
              <div className="testimonial-card reveal">
                <p className="reveal">
                  “As a city councilor, I need to stay on top of local and
                  national developments. The topic filters and daily digests keep
                  me informed and ready for any council session.”
                </p>
                <h4 className="reveal"> - Councilor David Kim</h4>
              </div>
              <div className="testimonial-card reveal">
                <p className="reveal">
                  “The ability to favorite and revisit key articles has
                  streamlined how my team briefs me. A must-have tool for any
                  legislative office.”
                </p>
                <h4 className="reveal"> - Representative Michael Nguyen</h4>
              </div>
              <div className="testimonial-card reveal">
                <p className="reveal">
                  “I rely on the Article Q&A feature to get quick clarifications
                  on complex government reports. It’s like having an assistant who
                  never sleeps.”
                </p>
                <h4 className="reveal"> - Policy Advisor Laura Martínez</h4>
              </div>
              <div className="testimonial-card reveal">
                <p className="reveal">
                  “The ‘Top Articles’ showcase gives me a quick snapshot of what
                  my colleagues are discussing. It’s helped me prioritize my daily
                  reading efficiently.”
                </p>
                <h4 className="reveal"> - Congressman David Chen</h4>
              </div>
              <div className="testimonial-card reveal">
                <p className="reveal">
                  “As Legislative Director, I depend on SynthoraAI - AI Article
                  Curator to monitor emerging bills. Its real-time alerts have
                  saved our office countless hours in legislative prep.”
                </p>
                <h4 className="reveal"> - Legislative Director Maria Sánchez</h4>
              </div>
              <div className="testimonial-card reveal">
                <p className="reveal">
                  “I manage communications for a governor’s office, and the
                  newsletter feature keeps our press team on the same page. We’ve
                  never been more aligned.”
                </p>
                <h4 className="reveal"> - Public Affairs Officer Robert Lee</h4>
              </div>
              <div className="testimonial-card reveal">
                <p className="reveal">
                  “As Senate Majority Leader, I need fast access to reliable
                  summaries. SynthoraAI - AI Article Curator’s AI ensures I’m
                  always prepped for cross–committee discussions.”
                </p>
                <h4 className="reveal"> - Senator Anna Thompson</h4>
              </div>
            </div>
          </div>
        </section>

        <section className="faq">
          <div className="landing-container">
            <div className="section-head reveal">
              <span className="eyebrow">FAQ</span>
              <h2>Questions, answered</h2>
              <p className="section-subtitle">
                Everything you need to know about SynthoraAI.
              </p>
            </div>
            <div className="faq-list">
              <details className="reveal">
                <summary className="reveal">
                  What is SynthoraAI - AI Article Curator?
                </summary>
                <p className="reveal">
                  SynthoraAI - AI Article Curator is an AI-powered tool that
                  gathers, summarizes, and organizes government-related news so
                  you can stay informed in seconds.
                </p>
              </details>
              <details className="reveal">
                <summary className="reveal">How do I get started?</summary>
                <p className="reveal">
                  Just click “Get Started” above, register for a free account,
                  and start exploring the latest articles right away.
                </p>
              </details>
              <details className="reveal">
                <summary className="reveal">Is it free to use?</summary>
                <p className="reveal">
                  Yes - core features (search, summaries, favorites) are
                  completely free. Premium newsletter scheduling is available for
                  registered users.
                </p>
              </details>
              <details className="reveal">
                <summary className="reveal">Do I need an account?</summary>
                <p className="reveal">
                  No - anyone can browse and read. To save favorites, subscribe
                  to the newsletter, or customize your experience, just sign up
                  in seconds.
                </p>
              </details>
              <details className="reveal">
                <summary className="reveal">How often is content updated?</summary>
                <p className="reveal">
                  New content appears every 10 seconds via static page
                  regeneration, and our crawler fetches fresh articles daily at
                  6:00 AM UTC.
                </p>
              </details>
              <details className="reveal">
                <summary className="reveal">Can I filter by topic?</summary>
                <p className="reveal">
                  Absolutely - use the topic dropdown to narrow results to the
                  subjects you care about most.
                </p>
              </details>
              <details className="reveal">
                <summary className="reveal">How do I save articles for later?</summary>
                <p className="reveal">
                  Register and log in, then click the “★” on any summary to add
                  it to your favorites list.
                </p>
              </details>
              <details className="reveal">
                <summary className="reveal">
                  How do I subscribe to the newsletter?
                </summary>
                <p className="reveal">
                  Enter your email in the newsletter section, hit “Subscribe,”
                  and you’ll receive daily digests straight to your inbox.
                </p>
              </details>
              <details className="reveal">
                <summary className="reveal">Can I switch to dark mode?</summary>
                <p className="reveal">
                  Yes - use the theme switcher in the navbar to toggle between
                  light, dark, or system settings.
                </p>
              </details>
              <details className="reveal">
                <summary className="reveal">Is my data secure?</summary>
                <p className="reveal">
                  We use industry-standard encryption (TLS, AES-256) to protect
                  your information both in transit and at rest.
                </p>
              </details>
              <details className="reveal">
                <summary className="reveal">
                  Who can benefit from SynthoraAI - AI Article Curator?
                </summary>
                <p className="reveal">
                  Government staff, legislators, policy advisors, and anyone
                  needing quick, reliable summaries of official news and
                  releases.
                </p>
              </details>
            </div>
          </div>
        </section>

        <section className="partners">
          <div className="landing-container">
            <div className="section-head reveal">
              <span className="eyebrow">Coverage</span>
              <h2>Sources and partner publications</h2>
              <p className="section-subtitle">
                Coverage across federal, state, and trusted media sources.
              </p>
            </div>
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
                <div key={org} className="partner-logo reveal">
                  {org}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="contact">
          <div className="landing-container">
            <div className="section-head reveal">
              <span className="eyebrow">Contact</span>
              <h2>Get in touch</h2>
              <p className="section-subtitle">
                Questions, feedback, or partnership inquiries? We are here to
                help.
              </p>
            </div>
            <div className="contact-grid">
              <div className="contact-card reveal">
                {/* @ts-ignore */}
                <MdPerson size={28} />
                <h3 className="reveal">Contact the Creator</h3>
                <p className="reveal">
                  Drop me a line directly on{" "}
                  <a href="https://www.linkedin.com/in/hoangsonw/">LinkedIn</a>
                </p>
              </div>
              <div className="contact-card reveal">
                {/* @ts-ignore */}
                <MdEmail size={28} />
                <h3 className="reveal">Email Support</h3>
                <p className="reveal">
                  Reach out at{" "}
                  <a href="mailto:hoangson091104@gmail.com">
                    hoangson091104@gmail.com
                  </a>
                </p>
              </div>
              <div className="contact-card reveal">
                {/* @ts-ignore */}
                <MdHelp size={28} />
                <h3 className="reveal">Read the Docs</h3>
                <p className="reveal">
                  Explore our API and developer guides on{" "}
                  <a href="https://ai-content-curator-backend.vercel.app/">
                    Swagger Docs
                  </a>
                </p>
              </div>
              <div className="contact-card reveal">
                {/* @ts-ignore */}
                <AiFillGithub size={28} />
                <h3 className="reveal">Report an Issue</h3>
                <p className="reveal">
                  File bugs or feature requests on{" "}
                  <a href="https://github.com/hoangsonww/AI-Gov-Content-Curator/issues">
                    GitHub Issues
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="final-cta reveal">
          <div className="landing-container">
            <h2 className="reveal">Ready to stay informed?</h2>
            <p className="section-subtitle reveal">
              Join thousands using SynthoraAI - AI Article Curator daily.
            </p>
            <div className="final-buttons reveal">
              <Link href="/auth/register" className="btn primary">
                Sign Up Now
              </Link>
              <Link href="/home" className="btn outline">
                Explore Articles
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => ({
  props: {},
});
