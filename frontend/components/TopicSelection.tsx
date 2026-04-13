import React from 'react';
import { CheckCircle } from 'lucide-react'; // Example icon library

interface TopicSelectionProps {
  topics: string[];
  selectedTopics: string[];
  onToggle: (topic: string) => void;
  onNext: () => void;
  onSkip: () => void;
}

const TopicSelection: React.FC<TopicSelectionProps> = ({ topics, selectedTopics, onToggle, onNext, onSkip }) => {
  const canProceed = selectedTopics.length >= 3;

  return (
    <div className="onboarding-full-height">
      <div className="onboarding-center">
        <h2 className="onboarding-title">Select 3+ Topics</h2>
        <p className="onboarding-subtitle">Customize your feed by choosing interests</p>
      </div>

      {/* Scrollable Grid Container */}
      <div className="onboarding-scrollable">
        <div className="onboarding-grid-3">
          {topics.map((topic) => {
            const isSelected = selectedTopics.includes(topic);
            return (
              <button
                key={topic}
                onClick={() => onToggle(topic)}
                className={`onboarding-item ${isSelected ? 'onboarding-item-selected' : 'onboarding-item-unselected'}`}
              >
                {/* Visual Check Indicator */}
                {isSelected && (
                  <div className="onboarding-item-check">
                    <CheckCircle size={16} fill="currentColor" className="onboarding-text-white" />
                  </div>
                )}

                {/* Placeholder for Icon (as seen in wireframe) */}
                <div className={`onboarding-item-icon ${isSelected ? 'onboarding-item-icon-selected' : 'onboarding-item-icon-unselected'}`}>
                  {topic[0].toUpperCase()}
                </div>

                <span className={`onboarding-item-text ${isSelected ? 'onboarding-item-text-selected' : 'onboarding-item-text-unselected'}`}>
                  {topic}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="onboarding-footer onboarding-space-y-3">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`onboarding-btn-primary ${!canProceed ? 'onboarding-btn-primary:disabled' : ''}`}
        >
          {canProceed ? 'Continue' : 'Select 3 more'}
        </button>

        <button
          onClick={onSkip}
          className="onboarding-btn-text"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
};

export default TopicSelection;
