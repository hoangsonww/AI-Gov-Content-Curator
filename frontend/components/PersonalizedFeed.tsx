import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit2, Trash2, ArrowLeft } from 'lucide-react';
import { setUserPreferences } from '../services/api';

type AlertFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly';

interface PersonalizedFeedProps {
  selectedTopics: string[];
  selectedSources: string[];
  selectedFrequency: AlertFrequency;
  notifyOnNewStories: boolean;
  onModifyTopics: () => void;
  onModifySources: () => void;
  onModifyAlerts: () => void;
  onDeleteTopic: (topic: string) => void;
  onDeleteSource: (source: string) => void;
}

const PersonalizedFeed: React.FC<PersonalizedFeedProps> = ({
  selectedTopics,
  selectedSources,
  selectedFrequency,
  notifyOnNewStories,
  onModifyTopics,
  onModifySources,
  onModifyAlerts,
  onDeleteTopic,
  onDeleteSource,
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const frequencyLabels: Record<AlertFrequency, string> = {
    hourly: 'Hourly',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
  };

  const handleStartBrowsingFeed = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('User is not authenticated');
      alert('Please log in to save your preferences');
      return;
    }

    setIsLoading(true);
    try {
      const success = await setUserPreferences(token, {
        topics: selectedTopics,
        sources: selectedSources,
        alertFrequency: selectedFrequency,
        notifyOnNewStories: notifyOnNewStories,
      });

      if (success) {
        console.log('Preferences saved successfully');
        // Navigate to home page after successful API call
        router.push('/home');
      } else {
        console.error('Failed to save preferences');
        alert('Failed to save preferences. Please try again.');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="onboarding-full-height">
      <div className="onboarding-center onboarding-mb-8">
        <h2 className="onboarding-title onboarding-mb-2">Your Preferences</h2>
        <p className="onboarding-description">Review and manage your personalized feed settings</p>
      </div>

      {/* Scrollable Content */}
      <div className="onboarding-scrollable onboarding-space-y-6">

        {/* Topics Section */}
        <div className="onboarding-section onboarding-section-topics">
          <div className="onboarding-section-header">
            <h3 className="onboarding-section-title onboarding-section-title-topics">Interested Topics</h3>
            <span className="onboarding-section-badge onboarding-section-badge-topics">
              {selectedTopics.length} selected
            </span>
          </div>

          <div className="onboarding-flex onboarding-flex-wrap onboarding-gap-2 onboarding-mb-4">
            {selectedTopics.map((topic) => (
              <div
                key={topic}
                className="onboarding-tag onboarding-tag-topics"
              >
                <span className="onboarding-tag-text onboarding-tag-text-topics">{topic}</span>
                <button
                  onClick={() => onDeleteTopic(topic)}
                  className="onboarding-tag-remove"
                  title="Delete topic"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={onModifyTopics}
            className="onboarding-section-modify onboarding-section-modify-topics"
          >
            <Edit2 size={16} />
            Modify Topics
          </button>
        </div>

        {/* Sources Section */}
        <div className="onboarding-section onboarding-section-sources">
          <div className="onboarding-section-header">
            <h3 className="onboarding-section-title onboarding-section-title-sources">Preferred Sources</h3>
            <span className="onboarding-section-badge onboarding-section-badge-sources">
              {selectedSources.length} selected
            </span>
          </div>

          <div className="onboarding-flex onboarding-flex-wrap onboarding-gap-2 onboarding-mb-4">
            {selectedSources.map((source) => (
              <div
                key={source}
                className="onboarding-tag onboarding-tag-sources"
              >
                <span className="onboarding-tag-text onboarding-tag-text-sources">{source}</span>
                <button
                  onClick={() => onDeleteSource(source)}
                  className="onboarding-tag-remove"
                  title="Delete source"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={onModifySources}
            className="onboarding-section-modify onboarding-section-modify-sources"
          >
            <Edit2 size={16} />
            Modify Sources
          </button>
        </div>

        {/* Alert Preferences Section */}
        <div className="onboarding-section onboarding-section-alerts">
          <h3 className="onboarding-section-title onboarding-section-title-alerts onboarding-mb-4">Alert Preferences</h3>

          <div className="onboarding-space-y-3 onboarding-mb-4">
            <div className="onboarding-alert-display">
              <p className="onboarding-alert-label-display">Update Frequency</p>
              <p className="onboarding-alert-value">{frequencyLabels[selectedFrequency]}</p>
            </div>

            <div className="onboarding-alert-display">
              <p className="onboarding-alert-label-display">Instant Notifications</p>
              <p className={`onboarding-alert-value ${notifyOnNewStories ? 'onboarding-alert-value-enabled' : 'onboarding-alert-value-disabled'}`}>
                {notifyOnNewStories ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>

          <button
            onClick={onModifyAlerts}
            className="onboarding-section-modify onboarding-section-modify-alerts"
          >
            <Edit2 size={16} />
            Modify Alerts
          </button>
        </div>
      </div>

      {/* Action Footer */}
      <div className="onboarding-footer onboarding-space-y-3">
        <button
          onClick={handleStartBrowsingFeed}
          disabled={isLoading}
          className="onboarding-btn-primary"
        >
          {isLoading ? 'Saving preferences...' : 'Start Browsing Feed'}
        </button>

        <button
          onClick={onModifyTopics}
          className="onboarding-btn-text"
        >
          <ArrowLeft size={16} />
          Back to quiz
        </button>
      </div>
    </div>
  );
};

export default PersonalizedFeed;