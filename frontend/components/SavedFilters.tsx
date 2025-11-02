import React, { useState, useEffect, useRef } from "react";
import { MdBookmark, MdAdd, MdEdit, MdDelete, MdClose } from "react-icons/md";
import {
  getFilterPresets,
  createFilterPreset,
  updateFilterPreset,
  deleteFilterPreset,
  FilterPreset,
} from "../services/api";

interface SavedFiltersProps {
  currentFilters: {
    source?: string;
    topic?: string;
    dateRange?: {
      from?: string;
      to?: string;
    };
  };
  onApplyPreset: (filters: FilterPreset["filters"]) => void;
  token: string | null;
}

export default function SavedFilters({
  currentFilters,
  onApplyPreset,
  token,
}: SavedFiltersProps) {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [editingPreset, setEditingPreset] = useState<FilterPreset | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (token) {
      loadPresets();
    }
  }, [token]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const loadPresets = async () => {
    if (!token) return;
    try {
      const data = await getFilterPresets(token);
      setPresets(data);
    } catch (error) {
      console.error("Failed to load presets:", error);
    }
  };

  const handleSavePreset = async () => {
    if (!token) return;
    if (!newPresetName.trim()) {
      setError("Please enter a name for the preset");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await createFilterPreset(token, newPresetName.trim(), currentFilters);
      await loadPresets();
      setShowSaveModal(false);
      setNewPresetName("");
    } catch (error: any) {
      setError(error.message || "Failed to save preset");
    } finally {
      setLoading(false);
    }
  };

  const handleRenamePreset = async () => {
    if (!token || !editingPreset) return;
    if (!editName.trim()) {
      setError("Please enter a name for the preset");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await updateFilterPreset(token, editingPreset._id, editName.trim());
      await loadPresets();
      setEditingPreset(null);
      setEditName("");
    } catch (error: any) {
      setError(error.message || "Failed to rename preset");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePreset = async (id: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this preset?")) return;

    try {
      await deleteFilterPreset(token, id);
      await loadPresets();
    } catch (error: any) {
      setError(error.message || "Failed to delete preset");
    }
  };

  const handleApplyPreset = (preset: FilterPreset) => {
    onApplyPreset(preset.filters);
    setShowDropdown(false);
  };

  if (!token) {
    return null; // Only show to authenticated users
  }

  const hasActiveFilters =
    currentFilters.source || currentFilters.topic || currentFilters.dateRange;

  return (
    <div className="saved-filters-container" ref={dropdownRef}>
      <button
        className="saved-filters-button"
        onClick={() => setShowDropdown(!showDropdown)}
        title="Saved Filters"
      >
        <MdBookmark size={20} />
        Saved Filters
        {presets.length > 0 && (
          <span className="preset-count">{presets.length}</span>
        )}
      </button>

      {showDropdown && (
        <div className="saved-filters-dropdown">
          <div className="dropdown-header">
            <h4>Saved Filters</h4>
            <button
              className="close-button"
              onClick={() => setShowDropdown(false)}
            >
              <MdClose size={20} />
            </button>
          </div>

          {presets.length === 0 ? (
            <div className="no-presets">
              <p>No saved filters yet</p>
              <p className="hint">
                Apply filters and save them for quick access
              </p>
            </div>
          ) : (
            <div className="presets-list">
              {presets.map((preset) => (
                <div key={preset._id} className="preset-item">
                  <button
                    className="preset-name"
                    onClick={() => handleApplyPreset(preset)}
                  >
                    {preset.name}
                    <div className="preset-filters">
                      {preset.filters.source && (
                        <span className="filter-tag">
                          Source: {preset.filters.source}
                        </span>
                      )}
                      {preset.filters.topic && (
                        <span className="filter-tag">
                          Topic: {preset.filters.topic}
                        </span>
                      )}
                    </div>
                  </button>
                  <div className="preset-actions">
                    <button
                      className="icon-button"
                      onClick={() => {
                        setEditingPreset(preset);
                        setEditName(preset.name);
                        setShowManageModal(true);
                      }}
                      title="Rename"
                    >
                      <MdEdit size={16} />
                    </button>
                    <button
                      className="icon-button delete"
                      onClick={() => handleDeletePreset(preset._id)}
                      title="Delete"
                    >
                      <MdDelete size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="dropdown-footer">
            <button
              className="save-current-button"
              onClick={() => setShowSaveModal(true)}
              disabled={!hasActiveFilters}
              title={
                hasActiveFilters
                  ? "Save current filters"
                  : "Apply filters first"
              }
            >
              <MdAdd size={18} />
              Save Current Filters
            </button>
          </div>
        </div>
      )}

      {/* Save New Preset Modal */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Save Filter Preset</h3>
            {error && <div className="error-message">{error}</div>}
            <input
              type="text"
              placeholder="Enter preset name..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="preset-name-input"
              autoFocus
            />
            <div className="current-filters-preview">
              <strong>Current filters:</strong>
              {currentFilters.source && (
                <div>Source: {currentFilters.source}</div>
              )}
              {currentFilters.topic && <div>Topic: {currentFilters.topic}</div>}
              {currentFilters.dateRange?.from && (
                <div>From: {currentFilters.dateRange.from}</div>
              )}
              {currentFilters.dateRange?.to && (
                <div>To: {currentFilters.dateRange.to}</div>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => {
                  setShowSaveModal(false);
                  setNewPresetName("");
                  setError("");
                }}
              >
                Cancel
              </button>
              <button
                className="save-button"
                onClick={handleSavePreset}
                disabled={loading}
              >
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Preset Modal */}
      {showManageModal && editingPreset && (
        <div
          className="modal-overlay"
          onClick={() => setShowManageModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Rename Preset</h3>
            {error && <div className="error-message">{error}</div>}
            <input
              type="text"
              placeholder="Enter new name..."
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="preset-name-input"
              autoFocus
            />
            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => {
                  setShowManageModal(false);
                  setEditingPreset(null);
                  setEditName("");
                  setError("");
                }}
              >
                Cancel
              </button>
              <button
                className="save-button"
                onClick={handleRenamePreset}
                disabled={loading}
              >
                {loading ? "Saving..." : "Rename"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .saved-filters-container {
          position: relative;
          display: inline-block;
        }

        .saved-filters-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--text-color);
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
          position: relative;
        }

        .saved-filters-button:hover {
          background: var(--hover-bg);
          border-color: var(--primary-color);
        }

        .preset-count {
          background: var(--primary-color);
          color: white;
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .saved-filters-dropdown {
          position: absolute;
          top: calc(100% + 0.5rem);
          right: 0;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          min-width: 320px;
          max-width: 400px;
          z-index: 1000;
          overflow: hidden;
        }

        .dropdown-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border-bottom: 1px solid var(--border-color);
        }

        .dropdown-header h4 {
          margin: 0;
          font-size: 1rem;
          color: var(--text-color);
        }

        .close-button {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }

        .close-button:hover {
          color: var(--text-color);
        }

        .no-presets {
          padding: 2rem 1rem;
          text-align: center;
          color: var(--text-secondary);
        }

        .no-presets p {
          margin: 0.5rem 0;
        }

        .hint {
          font-size: 0.85rem;
        }

        .presets-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .preset-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border-color);
          transition: background 0.2s;
        }

        .preset-item:hover {
          background: var(--hover-bg);
        }

        .preset-name {
          flex: 1;
          background: none;
          border: none;
          color: var(--text-color);
          text-align: left;
          cursor: pointer;
          padding: 0;
          font-size: 0.9rem;
        }

        .preset-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
          margin-top: 0.5rem;
        }

        .filter-tag {
          background: var(--tag-bg);
          color: var(--tag-color);
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
        }

        .preset-actions {
          display: flex;
          gap: 0.25rem;
          margin-left: 0.5rem;
        }

        .icon-button {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }

        .icon-button:hover {
          color: var(--primary-color);
        }

        .icon-button.delete:hover {
          color: var(--error-color);
        }

        .dropdown-footer {
          padding: 1rem;
          border-top: 1px solid var(--border-color);
        }

        .save-current-button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: var(--primary-color);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: opacity 0.2s;
        }

        .save-current-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .save-current-button:not(:disabled):hover {
          opacity: 0.9;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }

        .modal-content {
          background: var(--card-bg);
          border-radius: 12px;
          padding: 1.5rem;
          min-width: 400px;
          max-width: 90vw;
        }

        .modal-content h3 {
          margin: 0 0 1rem;
          color: var(--text-color);
        }

        .error-message {
          background: var(--error-bg);
          color: var(--error-color);
          padding: 0.75rem;
          border-radius: 6px;
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }

        .preset-name-input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--input-bg);
          color: var(--text-color);
          font-size: 1rem;
          margin-bottom: 1rem;
        }

        .preset-name-input:focus {
          outline: none;
          border-color: var(--primary-color);
        }

        .current-filters-preview {
          background: var(--hover-bg);
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .current-filters-preview strong {
          display: block;
          margin-bottom: 0.5rem;
          color: var(--text-color);
        }

        .current-filters-preview div {
          margin: 0.25rem 0;
        }

        .modal-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }

        .cancel-button,
        .save-button {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: opacity 0.2s;
        }

        .cancel-button {
          background: var(--secondary-bg);
          color: var(--text-color);
        }

        .cancel-button:hover {
          opacity: 0.8;
        }

        .save-button {
          background: var(--primary-color);
          color: white;
        }

        .save-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .save-button:not(:disabled):hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}
