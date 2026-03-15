import React, { useEffect, useState } from "react";
import { BiasAnalysis, analyzeArticleBias } from "../services/api";
import { Article } from "../pages/home";
import { MdHelpOutline, MdInsights } from "react-icons/md";
import { toast } from "react-toastify";
import InfoModal from "./InfoModal";

interface BiasAnalysisProps {
  article: Article;
}

export default function BiasAnalysisSection({ article }: BiasAnalysisProps) {
  const [biasData, setBiasData] = useState<BiasAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRequested, setHasRequested] = useState(false);
  const [showBiasHelp, setShowBiasHelp] = useState(false);
  const contentToAnalyze = article.summary || article.content || "";
  const canAnalyze = Boolean(
    article._id && article.title && contentToAnalyze.length >= 100,
  );

  useEffect(() => {
    setBiasData(null);
    setError(null);
    setLoading(false);
    setHasRequested(false);
  }, [article._id, article.title, article.summary, article.content]);

  const handleGenerate = async () => {
    setHasRequested(true);
    setError(null);

    if (!article._id || !article.title) {
      const message = "Missing article metadata for analysis";
      setError(message);
      toast.error(message);
      return;
    }

    // Use summary if available, otherwise use content
    if (!contentToAnalyze || contentToAnalyze.length < 100) {
      const message = "Article content too short for analysis";
      setError(message);
      toast.error(message);
      return;
    }

    setLoading(true);
    setBiasData(null);

    try {
      const analysis = await analyzeArticleBias(
        article._id,
        article.title,
        contentToAnalyze,
      );

      if (analysis) {
        setBiasData(analysis);
        toast.success("Political bias analysis generated.");
      } else {
        const message = "Unable to analyze article bias";
        setError(message);
        toast.error(message);
      }
    } catch (err) {
      console.error("Error fetching bias analysis:", err);
      const message = "Failed to load bias analysis";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const getPoliticalColorClass = (position: string): string => {
    switch (position) {
      case "far-left":
        return "bias-far-left";
      case "left":
        return "bias-left";
      case "center-left":
        return "bias-center-left";
      case "center":
        return "bias-center";
      case "center-right":
        return "bias-center-right";
      case "right":
        return "bias-right";
      case "far-right":
        return "bias-far-right";
      default:
        return "bias-center";
    }
  };

  const getPositionLabel = (position: string): string => {
    switch (position) {
      case "far-left":
        return "Far Left";
      case "left":
        return "Left";
      case "center-left":
        return "Center-Left";
      case "center":
        return "Center";
      case "center-right":
        return "Center-Right";
      case "right":
        return "Right";
      case "far-right":
        return "Far Right";
      default:
        return position;
    }
  };

  const positionDetails: Record<
    string,
    { label: string; description: string }
  > = {
    "far-left": {
      label: "Far Left",
      description:
        "Strongly progressive framing, emphasizing systemic change, equity, and expansive government action.",
    },
    left: {
      label: "Left",
      description:
        "Progressive or liberal framing, favoring regulation, social programs, and collective solutions.",
    },
    "center-left": {
      label: "Center-Left",
      description:
        "Moderate progressive framing with a balance of reform and pragmatic policy tradeoffs.",
    },
    center: {
      label: "Center",
      description:
        "Centrist framing that presents multiple viewpoints with minimal ideological language.",
    },
    "center-right": {
      label: "Center-Right",
      description:
        "Moderate conservative framing, emphasizing market solutions and fiscal restraint.",
    },
    right: {
      label: "Right",
      description:
        "Conservative framing, prioritizing limited government, tradition, and individual responsibility.",
    },
    "far-right": {
      label: "Far Right",
      description:
        "Strongly conservative framing with emphasis on national identity, security, and institutional skepticism.",
    },
  };

  const spectrumPositions = [
    "far-left",
    "left",
    "center-left",
    "center",
    "center-right",
    "right",
    "far-right",
  ];

  const renderPoliticalSpectrum = () => {
    if (!biasData) return null;

    return (
      <div className="political-spectrum">
        <div className="spectrum-bar">
          {spectrumPositions.map((pos) => {
            const details = positionDetails[pos] || {
              label: getPositionLabel(pos),
              description: "",
            };
            const tooltipId = `spectrum-tooltip-${pos}`;
            return (
              <div
                key={pos}
                className={`spectrum-segment ${
                  biasData.politicalLeaning.position === pos ? "active" : ""
                }`}
                data-position={pos}
                tabIndex={0}
                aria-describedby={tooltipId}
              >
                <div className="segment-label">{details.label}</div>
                <div className="segment-tooltip" id={tooltipId} role="tooltip">
                  {details.description}
                </div>
              </div>
            );
          })}
        </div>
        <div
          className="spectrum-indicator"
          style={{
            left: `${((biasData.politicalLeaning.score + 100) / 200) * 100}%`,
          }}
        >
          <div className="indicator-wrapper">
            <div className="indicator-value">
              {biasData.politicalLeaning.score > 0 ? "+" : ""}
              {biasData.politicalLeaning.score}
            </div>
            <div className="indicator-arrow"></div>
            <div className="indicator-line"></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bias-analysis-container">
      <div className="bias-title-row">
        <h2>
          {/* @ts-ignore */}
          <MdInsights size={24} />
          Political Bias Analysis
        </h2>
        <button
          type="button"
          className="info-icon-btn"
          onClick={() => setShowBiasHelp(true)}
          aria-label="Political spectrum help"
        >
          {/* @ts-ignore */}
          <MdHelpOutline size={18} />
        </button>
      </div>

      {!hasRequested && (
        <div className="bias-cta">
          <button
            type="button"
            className="bias-cta-button"
            onClick={handleGenerate}
            disabled={loading || !canAnalyze}
          >
            Generate Political Bias Analysis
          </button>
          {!canAnalyze && (
            <p className="bias-cta-hint">
              Article content is too short for analysis.
            </p>
          )}
        </div>
      )}

      {hasRequested && loading && (
        <div className="bias-loading">
          <div className="loading-spinner"></div>
          <p>Analyzing article bias...</p>
        </div>
      )}

      {hasRequested && error && !loading && (
        <div className="bias-error">
          <p>{error}</p>
          <button
            type="button"
            className="bias-cta-button"
            onClick={handleGenerate}
            disabled={!canAnalyze}
          >
            Try Again
          </button>
        </div>
      )}

      {hasRequested && biasData && !loading && !error && (
        <div className="bias-content">
          {renderPoliticalSpectrum()}

          <div className="bias-metrics">
            <div className="metric-row">
              <div className="metric-card">
                <h3>Political Leaning</h3>
                <div
                  className={`position-badge ${getPoliticalColorClass(biasData.politicalLeaning.position)}`}
                >
                  {getPositionLabel(biasData.politicalLeaning.position)}
                </div>
                <p className="score">
                  Score: {biasData.politicalLeaning.score > 0 ? "+" : ""}
                  {biasData.politicalLeaning.score}
                </p>
                <p className="explanation">
                  {biasData.politicalLeaning.explanation}
                </p>
              </div>

              <div className="metric-card">
                <h3>Analysis Confidence</h3>
                <div className="confidence-meter">
                  <div
                    className="confidence-fill"
                    style={{ width: `${biasData.confidence}%` }}
                  ></div>
                </div>
                <p className="confidence-value">{biasData.confidence}%</p>
              </div>

              <div className="metric-card">
                <h3>Neutrality Score</h3>
                <div className="neutrality-meter">
                  <div
                    className="neutrality-fill"
                    style={{
                      width: `${biasData.neutralityScore}%`,
                      backgroundColor:
                        biasData.neutralityScore > 70
                          ? "#27ae60"
                          : biasData.neutralityScore > 40
                            ? "#f39c12"
                            : "#e74c3c",
                    }}
                  ></div>
                </div>
                <p className="neutrality-value">
                  {biasData.neutralityScore}/100
                </p>
              </div>
            </div>

            <div className="bias-details">
              <div className="detail-section">
                <h3>Bias Status</h3>
                <div
                  className={`bias-badge ${biasData.isBiased ? "biased" : "unbiased"}`}
                >
                  {biasData.isBiased
                    ? "⚠️ Biased Content Detected"
                    : "✓ Relatively Unbiased"}
                </div>
              </div>

              {biasData.biasIndicators.length > 0 && (
                <div className="detail-section">
                  <h3>Bias Indicators</h3>
                  <ul className="bias-indicators">
                    {biasData.biasIndicators
                      .slice(0, 5)
                      .map((indicator, index) => (
                        <li key={index}>{indicator}</li>
                      ))}
                  </ul>
                </div>
              )}

              {biasData.recommendation && (
                <div className="detail-section">
                  <h3>Recommendation</h3>
                  <p className="recommendation">{biasData.recommendation}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showBiasHelp && (
        <InfoModal
          title="Political spectrum guide"
          onClose={() => setShowBiasHelp(false)}
        >
          <p>
            The spectrum highlights how the article frames issues, from
            progressive to conservative viewpoints.
          </p>
          <ul className="info-modal-list">
            {spectrumPositions.map((pos) => {
              const detail = positionDetails[pos];
              return (
                <li key={detail.label}>
                  <strong>{detail.label}:</strong> {detail.description}
                </li>
              );
            })}
          </ul>
        </InfoModal>
      )}
    </div>
  );
}
