import React, { useState, useEffect, useRef } from "react";
import { getTopics } from "../services/api";

interface TopicDropdownProps {
  selectedTopic: string;
  onChange: (topic: string) => void;
}

const TopicDropdown: React.FC<TopicDropdownProps> = ({
  selectedTopic,
  onChange,
}) => {
  const [allTopics, setAllTopics] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce API call
  useEffect(() => {
    const handler = setTimeout(() => {
      getTopics(search, 1, 50)
        .then((result) => setAllTopics(result.data))
        .catch((err) => console.error("Error fetching topics:", err));
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

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

  const filteredTopics = allTopics.filter((t) =>
    t.toLowerCase().includes(search.toLowerCase()),
  );

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
        {selectedTopic || "All Topics"}
        <span className="dropdown-arrow">{showDropdown ? "▲" : "▼"}</span>
      </div>
      {showDropdown && (
        <div className={`dropdown-menu ${showDropdown ? "open" : ""}`}>
          <input
            type="text"
            className="dropdown-search"
            placeholder="Search topics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="dropdown-list">
            {filteredTopics.map((topic) => (
              <li key={topic} onClick={() => handleSelect(topic)}>
                {topic}
              </li>
            ))}
            {filteredTopics.length === 0 && (
              <li className="no-match">No matching topics</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TopicDropdown;
