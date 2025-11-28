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
    </div>
  );
}
