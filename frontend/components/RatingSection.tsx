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
} from "react-icons/md";
import { toast } from "react-toastify";
import {
  createOrUpdateRating,
  getUserRating,
  getArticleRatingStats,
  deleteRating,
  Rating,
  RatingStats,
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
          <h3 className="rating-title">
            {/* @ts-ignore */}
            <MdThumbsUpDown size={24} />
            Rate This Article
          </h3>
          {stats && stats.totalRatings === 0 && (
            <span className="be-first-text">Be the first to rate!</span>
          )}
        </div>
        {stats && stats.totalRatings > 0 && (
          <div className="rating-stats">
            <div className="stat-group">
              <div className="stat-item main-stat">
                <span className="stat-label">Average Rating</span>
                <span className="stat-value">
                  {(stats.meterRatings || 0) >= (stats.starRatings || 0) ? (
                    <div className="meter-stat-display">
                      <span
                        className="big-rating"
                        style={{ color: getMeterColor(stats.averageRating) }}
                      >
                        {stats.averageRating.toFixed(0)}
                      </span>
                      <span className="meter-label">
                        {getMeterLabel(stats.averageRating)}
                      </span>
                    </div>
                  ) : (
                    <div className="star-stat-display">
                      <div className="average-stars">
                        {renderAverageStars(stats.averageRating)}
                      </div>
                      <span className="average-number">
                        {stats.averageRating.toFixed(1)} / 5
                      </span>
                    </div>
                  )}
                </span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-label">Total Ratings</span>
                <span className="stat-value big-number">
                  {stats.totalRatings}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

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
    </motion.div>
  );
};

export default RatingSection;
