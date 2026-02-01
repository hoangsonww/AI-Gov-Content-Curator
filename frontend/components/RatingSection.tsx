import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MdStar,
  MdStarBorder,
  MdStarHalf,
  MdThumbsUpDown,
  MdCheck,
  MdClose,
  MdEdit,
  MdHelpOutline,
} from "react-icons/md";
import { toast } from "react-toastify";
import InfoModal from "./InfoModal";
import {
  createOrUpdateRating,
  getUserRating,
  getArticleRatingStats,
  deleteRating,
  Rating,
  RatingStats,
  getArticleRatingsList,
  RatingWithUser,
} from "../services/ratings";
import { trackInteraction } from "../services/reranker";

interface RatingSectionProps {
  articleId: string;
}

const RatingSection: React.FC<RatingSectionProps> = ({ articleId }) => {
  const [ratingType, setRatingType] = useState<"meter" | "stars">("meter");
  const [meterValue, setMeterValue] = useState<number>(0);
  const [starValue, setStarValue] = useState<number>(0);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [userRating, setUserRating] = useState<Rating | null>(null);
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showComment, setShowComment] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showRatingHelp, setShowRatingHelp] = useState(false);
  const [showRatingsModal, setShowRatingsModal] = useState(false);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsError, setRatingsError] = useState<string | null>(null);
  const [ratingsList, setRatingsList] = useState<RatingWithUser[]>([]);
  const [ratingsLoadedFor, setRatingsLoadedFor] = useState<string | null>(null);

  // Fetch user rating and stats on mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [userRatingData, statsData] = await Promise.all([
          getUserRating(articleId),
          getArticleRatingStats(articleId),
        ]);

        if (userRatingData) {
          setUserRating(userRatingData);
          setRatingType(userRatingData.ratingType);
          if (userRatingData.ratingType === "meter") {
            setMeterValue(userRatingData.value);
          } else {
            setStarValue(userRatingData.value);
          }
          if (userRatingData.comment) {
            setComment(userRatingData.comment);
          }
        }

        setStats(statsData);
      } catch (error) {
        console.error("Error fetching rating data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [articleId]);

  useEffect(() => {
    setShowRatingsModal(false);
    setRatingsList([]);
    setRatingsLoadedFor(null);
  }, [articleId]);

  const handleSubmitRating = useCallback(async () => {
    if (isSubmitting) return;

    const value = ratingType === "meter" ? meterValue : starValue;
    if (ratingType === "stars" && value === 0) {
      toast.error("Please select a star rating");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createOrUpdateRating(
        articleId,
        value,
        ratingType,
        comment || undefined,
      );

      if (result.success) {
        toast.success(
          userRating
            ? "Rating updated successfully!"
            : "Rating submitted successfully!",
        );
        setUserRating(result.data || null);
        setIsEditing(false);
        setShowComment(false);

        // Track rating interaction
        trackInteraction(articleId, "rate", { rating: value });

        // Refresh stats
        const newStats = await getArticleRatingStats(articleId);
        setStats(newStats);
      } else {
        toast.error(result.message || "Failed to submit rating");
      }
    } catch (error) {
      toast.error("An error occurred while submitting your rating");
    } finally {
      setIsSubmitting(false);
    }
  }, [articleId, meterValue, starValue, ratingType, comment, userRating]);

  const handleDeleteRating = useCallback(async () => {
    if (!userRating?._id) return;

    if (!confirm("Are you sure you want to delete your rating?")) return;

    setIsSubmitting(true);
    try {
      const result = await deleteRating(userRating._id);
      if (result.success) {
        toast.success("Rating deleted successfully!");
        setUserRating(null);
        setMeterValue(0);
        setStarValue(0);
        setComment("");
        setIsEditing(false);

        // Refresh stats
        const newStats = await getArticleRatingStats(articleId);
        setStats(newStats);
      } else {
        toast.error(result.message || "Failed to delete rating");
      }
    } catch (error) {
      toast.error("An error occurred while deleting your rating");
    } finally {
      setIsSubmitting(false);
    }
  }, [userRating, articleId]);

  const getMeterLabel = (value: number): string => {
    if (value <= -60) return "Very Negative";
    if (value <= -20) return "Negative";
    if (value <= 20) return "Neutral";
    if (value <= 60) return "Positive";
    return "Very Positive";
  };

  const getMeterColor = (value: number): string => {
    if (value <= -60) return "#dc2626"; // red-600
    if (value <= -20) return "#f97316"; // orange-500
    if (value <= 20) return "var(--loading-text)"; // neutral gray
    if (value <= 60) return "#22c55e"; // green-500
    return "#10b981"; // emerald-500
  };

  const renderStars = (interactive: boolean = true) => {
    const stars = [];
    const value = interactive ? hoveredStar || starValue : starValue;

    for (let i = 1; i <= 5; i++) {
      stars.push(
        <motion.button
          key={i}
          type="button"
          className="star-button"
          onClick={() => interactive && setStarValue(i)}
          onMouseEnter={() => interactive && setHoveredStar(i)}
          onMouseLeave={() => interactive && setHoveredStar(0)}
          disabled={!interactive || (userRating !== null && !isEditing)}
          whileHover={interactive ? { scale: 1.1 } : {}}
          whileTap={interactive ? { scale: 0.95 } : {}}
        >
          {i <= value ? (
            // @ts-ignore
            <MdStar
              size={32}
              color="var(--accent-color)"
              style={{ color: "var(--accent-color)" }}
            />
          ) : (
            // @ts-ignore
            <MdStarBorder size={32} style={{ color: "var(--loading-text)" }} />
          )}
        </motion.button>,
      );
    }
    return stars;
  };

  const renderAverageStars = (average: number) => {
    const stars = [];
    const fullStars = Math.floor(average);
    const hasHalfStar = average % 1 >= 0.5;

    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        // @ts-ignore
        stars.push(
          // @ts-ignore
          <MdStar key={i} size={20} style={{ color: "var(--accent-color)" }} />,
        );
      } else if (i === fullStars + 1 && hasHalfStar) {
        // @ts-ignore
        stars.push(
          // @ts-ignore
          <MdStarHalf
            key={i}
            size={20}
            style={{ color: "var(--accent-color)" }}
          />,
        );
      } else {
        // @ts-ignore
        stars.push(
          // @ts-ignore
          <MdStarBorder
            key={i}
            size={20}
            style={{ color: "var(--loading-text)" }}
          />,
        );
      }
    }
    return stars;
  };

  const meterAverage =
    stats?.averageMeterRating !== null &&
    typeof stats?.averageMeterRating !== "undefined"
      ? stats.averageMeterRating
      : stats && stats.meterRatings > 0 && stats.starRatings === 0
        ? stats.averageRating
        : null;

  const starAverage =
    stats?.averageStarRating !== null &&
    typeof stats?.averageStarRating !== "undefined"
      ? stats.averageStarRating
      : stats && stats.starRatings > 0 && stats.meterRatings === 0
        ? stats.averageRating
        : null;

  const meterHasRatings = (stats?.meterRatings || 0) > 0;
  const starHasRatings = (stats?.starRatings || 0) > 0;

  const formatRatingValue = (rating: RatingWithUser): string => {
    if (rating.ratingType === "stars") {
      return `${rating.value} / 5`;
    }
    return `${rating.value > 0 ? "+" : ""}${rating.value}`;
  };

  const formatRatingDate = (date?: string): string => {
    if (!date) return "—";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const loadRatings = useCallback(async () => {
    setRatingsLoading(true);
    setRatingsError(null);
    try {
      const allRatings: RatingWithUser[] = [];
      let page = 1;
      const limit = 50;
      let pages = 1;

      while (page <= pages) {
        const response = await getArticleRatingsList(articleId, page, limit);
        if (!response) {
          throw new Error("Failed to load ratings");
        }
        allRatings.push(...response.ratings);
        pages = response.pagination.pages || 1;
        page += 1;
      }

      setRatingsList(allRatings);
      setRatingsLoadedFor(articleId);
    } catch (error) {
      console.error("Error loading ratings list:", error);
      setRatingsError("Unable to load ratings. Please try again.");
    } finally {
      setRatingsLoading(false);
    }
  }, [articleId]);

  const openRatingsModal = () => {
    setShowRatingsModal(true);
    if (ratingsLoadedFor !== articleId) {
      setRatingsList([]);
      loadRatings();
    }
  };

  if (isLoading) {
    return (
      <div className="rating-section loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <motion.div
      className="rating-section"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="rating-header">
        <div className="rating-title-container">
          <div className="rating-title-row">
            <h3 className="rating-title">
              {/* @ts-ignore */}
              <MdThumbsUpDown size={24} />
              <span>Rate This Article</span>
            </h3>
            <button
              type="button"
              className="info-icon-btn"
              onClick={() => setShowRatingHelp(true)}
              aria-label="Rating help"
            >
              {/* @ts-ignore */}
              <MdHelpOutline size={18} />
            </button>
          </div>
          {stats && stats.totalRatings === 0 && (
            <span className="be-first-text">Be the first to rate!</span>
          )}
        </div>
      </div>

      {stats && stats.totalRatings > 0 && (
        <div className="rating-stats rating-stats-below">
          <div className="stat-group stat-group-dual">
            <div className="stat-item stat-card">
              <span className="stat-label">Sentiment Meter</span>
              {meterAverage !== null ? (
                <div className="meter-stat-display">
                  <span
                    className="big-rating"
                    style={{ color: getMeterColor(meterAverage) }}
                  >
                    {meterAverage.toFixed(0)}
                  </span>
                  <span className="meter-label">
                    {getMeterLabel(meterAverage)}
                  </span>
                </div>
              ) : (
                <span className="stat-empty">
                  {meterHasRatings
                    ? "Average unavailable"
                    : "No sentiment ratings yet"}
                </span>
              )}
              <span className="stat-sub">{stats.meterRatings} ratings</span>
            </div>

            <div className="stat-item stat-card">
              <span className="stat-label">Star Rating</span>
              {starAverage !== null ? (
                <div className="star-stat-display">
                  <div className="average-stars">
                    {renderAverageStars(starAverage)}
                  </div>
                  <span className="average-number">
                    {starAverage.toFixed(1)} / 5.0
                  </span>
                </div>
              ) : (
                <span className="stat-empty">
                  {starHasRatings
                    ? "Average unavailable"
                    : "No star ratings yet"}
                </span>
              )}
              <span className="stat-sub">{stats.starRatings} ratings</span>
            </div>

            <div
              className="stat-item stat-card stat-total clickable"
              role="button"
              tabIndex={0}
              onClick={openRatingsModal}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openRatingsModal();
                }
              }}
            >
              <span className="stat-label">Total Ratings</span>
              <span className="stat-value big-number">
                {stats.totalRatings}
              </span>
            </div>
          </div>
        </div>
      )}

      {userRating && !isEditing ? (
        <motion.div
          className="user-rating-display"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="rating-display-header">
            <h4>Your Rating</h4>
            <div className="rating-actions">
              <button
                className="edit-btn"
                onClick={() => setIsEditing(true)}
                title="Edit Rating"
              >
                {/* @ts-ignore */}
                <MdEdit size={20} />
              </button>
              <button
                className="delete-btn"
                onClick={handleDeleteRating}
                title="Delete Rating"
              >
                {/* @ts-ignore */}
                <MdClose size={20} />
              </button>
            </div>
          </div>
          <div className="rating-display-content">
            {userRating.ratingType === "meter" ? (
              <div className="meter-display">
                <div
                  className="meter-value-display"
                  style={{ color: getMeterColor(userRating.value) }}
                >
                  {userRating.value}
                  <span className="meter-label">
                    {" "}
                    ({getMeterLabel(userRating.value)})
                  </span>
                </div>
              </div>
            ) : (
              <div className="stars-display">
                {renderAverageStars(userRating.value)}
              </div>
            )}
            {userRating.comment && (
              <p className="rating-comment">"{userRating.comment}"</p>
            )}
          </div>
        </motion.div>
      ) : (
        <div className="rating-input-container">
          {!userRating && (
            <div className="rating-type-selector">
              <button
                className={`type-btn ${ratingType === "meter" ? "active" : ""}`}
                onClick={() => setRatingType("meter")}
              >
                Sentiment Meter
              </button>
              <button
                className={`type-btn ${ratingType === "stars" ? "active" : ""}`}
                onClick={() => setRatingType("stars")}
              >
                Star Rating
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {ratingType === "meter" ? (
              <motion.div
                key="meter"
                className="meter-container"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="meter-labels">
                  <span>Very Negative</span>
                  <span>Neutral</span>
                  <span>Very Positive</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={meterValue}
                  onChange={(e) => setMeterValue(Number(e.target.value))}
                  className="meter-slider"
                />
                <div className="meter-value">
                  <span style={{ color: getMeterColor(meterValue) }}>
                    {meterValue}
                  </span>
                  <span className="meter-label">
                    ({getMeterLabel(meterValue)})
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="stars"
                className="stars-container"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="stars-input">{renderStars()}</div>
                {starValue > 0 && (
                  <div className="star-label">
                    {starValue === 1 && "Poor"}
                    {starValue === 2 && "Fair"}
                    {starValue === 3 && "Good"}
                    {starValue === 4 && "Very Good"}
                    {starValue === 5 && "Excellent"}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="comment-section">
            {!showComment && !userRating && (
              <button
                className="add-comment-btn"
                onClick={() => setShowComment(true)}
              >
                Add a comment (optional)
              </button>
            )}
            {(showComment || userRating) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <textarea
                  className="comment-input"
                  placeholder="Share your thoughts about this article..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
                <div className="comment-char-count">
                  {comment.length}/500 characters
                </div>
              </motion.div>
            )}
            {showComment && !userRating && (
              <div className="comment-actions">
                <button
                  type="button"
                  className="comment-cancel-btn"
                  onClick={() => setShowComment(false)}
                >
                  Cancel Comment
                </button>
              </div>
            )}
          </div>

          <div className="rating-submit-container">
            <motion.button
              className="submit-btn"
              onClick={handleSubmitRating}
              disabled={
                isSubmitting || (ratingType === "stars" && starValue === 0)
              }
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSubmitting ? (
                <span className="submitting">
                  <div className="small-spinner"></div>
                  Submitting...
                </span>
              ) : (
                <>
                  {/* @ts-ignore */}
                  <MdCheck size={20} />
                  {userRating ? "Update Rating" : "Submit Rating"}
                </>
              )}
            </motion.button>
            {isEditing && (
              <button
                className="cancel-btn"
                onClick={() => {
                  setIsEditing(false);
                  if (userRating) {
                    setRatingType(userRating.ratingType);
                    if (userRating.ratingType === "meter") {
                      setMeterValue(userRating.value);
                    } else {
                      setStarValue(userRating.value);
                    }
                    setComment(userRating.comment || "");
                  }
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {showRatingHelp && (
        <InfoModal
          title="How ratings work"
          onClose={() => setShowRatingHelp(false)}
        >
          <p>
            Choose a rating style that fits your feedback. You can rate with
            stars, or use the sentiment meter. Both are saved independently and
            help readers understand different kinds of feedback.
          </p>
          <ul className="info-modal-list">
            <li>
              <strong>Star Rating:</strong> Quick 1–5 score for overall quality.
            </li>
            <li>
              <strong>Sentiment Meter:</strong> Fine‑grained scale from very
              negative to very positive.
            </li>
            <li>
              <strong>Tip:</strong> If you want nuance, use the meter. If you
              want a simple score, use stars.
            </li>
            <li>
              <strong>Optional comment:</strong> Add a short note to explain
              your rating (up to 500 characters).
            </li>
          </ul>
          <p>
            You can edit or delete your rating later. Changes update the
            averages shown above.
          </p>
        </InfoModal>
      )}

      {showRatingsModal && (
        <InfoModal
          title={`All Ratings (${stats?.totalRatings ?? 0})`}
          onClose={() => setShowRatingsModal(false)}
          className="ratings-modal"
          bodyClassName="ratings-modal-body"
        >
          {ratingsLoading ? (
            <div className="ratings-loading">
              <div className="spinner"></div>
            </div>
          ) : ratingsError ? (
            <div className="ratings-error">{ratingsError}</div>
          ) : ratingsList.length === 0 ? (
            <p>No ratings yet.</p>
          ) : (
            <div className="ratings-table-wrap">
              <table className="ratings-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Rating</th>
                    <th>Comment</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {ratingsList.map((rating, index) => (
                    <tr key={rating._id || `${rating.articleId}-${index}`}>
                      <td>{index + 1}</td>
                      <td>
                        {rating.ratingType === "stars"
                          ? "Star Rating"
                          : "Sentiment Meter"}
                      </td>
                      <td>{formatRatingValue(rating)}</td>
                      <td className="ratings-comment">
                        {rating.comment?.trim() || "—"}
                      </td>
                      <td>{formatRatingDate(rating.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </InfoModal>
      )}
    </motion.div>
  );
};

export default RatingSection;
