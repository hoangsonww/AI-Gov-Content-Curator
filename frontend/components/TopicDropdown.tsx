import React, { useState, useEffect, useRef, useCallback } from "react";
import { getTopics } from "../services/api";

interface TopicDropdownProps {
  selectedTopic: string;
  onChange: (topic: string) => void;
}

// @ts-ignore
const TopicDropdown: React.FC<TopicDropdownProps> = ({
  selectedTopic,
  onChange,
}) => {
  const [allTopics, setAllTopics] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownListRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Fetch topics with pagination
  const fetchTopics = useCallback(
    async (pageNum: number, searchQuery: string, append = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        const result = await getTopics(searchQuery, pageNum, 20);
        setAllTopics((prev) =>
          append ? [...prev, ...result.data] : result.data,
        );
        setHasMore(result.data.length === 20);
        setInitialLoad(false);
      } catch (err) {
        console.error("Error fetching topics:", err);
        setInitialLoad(false);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [],
  );

  // Debounce search and reset pagination - only when dropdown is open
  useEffect(() => {
    if (!showDropdown) return;

    const handler = setTimeout(() => {
      setPage(1);
      setAllTopics([]);
      setHasMore(true);
      setInitialLoad(true);
      fetchTopics(1, search, false);
    }, 500);
    return () => clearTimeout(handler);
  }, [search, showDropdown, fetchTopics]);

  // Scroll handler for infinite loading
  const handleScroll = useCallback(() => {
    if (!dropdownListRef.current || !hasMore || loading) return;

    const { scrollTop, scrollHeight, clientHeight } = dropdownListRef.current;

    // Load more when user scrolls to 80% of the content
    if (scrollTop + clientHeight >= scrollHeight * 0.8) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchTopics(nextPage, search, true);
    }
  }, [hasMore, loading, page, search, fetchTopics]);

  // Attach scroll listener
  useEffect(() => {
    const listElement = dropdownListRef.current;
    if (!showDropdown || !listElement) return;

    listElement.addEventListener("scroll", handleScroll);
    return () => listElement.removeEventListener("scroll", handleScroll);
  }, [showDropdown, handleScroll]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset on dropdown close
  useEffect(() => {
    if (!showDropdown) {
      setSearch("");
      setPage(1);
      setAllTopics([]);
      setHasMore(true);
      setInitialLoad(true);
    }
  }, [showDropdown]);

  const handleSelect = (topic: string) => {
    onChange(topic);
    setShowDropdown(false);
  };

  return (
    <div className="topic-dropdown-container" ref={containerRef}>
      <div
        className="dropdown-header"
        onClick={() => setShowDropdown((prev) => !prev)}
      >
        <span className="dropdown-text">{selectedTopic || "All Topics"}</span>
        <span className="dropdown-arrow">{showDropdown ? "▲" : "▼"}</span>
      </div>
      {showDropdown && (
        <div
          className={`dropdown-menu ${showDropdown ? "open" : ""}`}
          ref={dropdownListRef}
        >
          <input
            type="text"
            className="dropdown-search"
            placeholder="Search topics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <ul className="dropdown-list">
            {allTopics.map((topic, index) => (
              <li key={`${topic}-${index}`} onClick={() => handleSelect(topic)}>
                {topic}
              </li>
            ))}
            {loading && (
              <li className="dropdown-loading">
                <div className="spinner"></div>
                <span>Loading topics...</span>
              </li>
            )}
            {!loading && !initialLoad && allTopics.length === 0 && (
              <li className="no-match">No matching topics</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TopicDropdown;
