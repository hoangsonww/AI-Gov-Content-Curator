import React from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';

type AlertFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'never';

interface AlertsSetupProps {
  selectedFrequency: AlertFrequency;
  notifyOnNewStories: boolean;
  onFrequencyChange: (frequency: AlertFrequency) => void;
  onNotifyChange: (notify: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}

const AlertsSetup: React.FC<AlertsSetupProps> = ({
  selectedFrequency,
  notifyOnNewStories,
  onFrequencyChange,
  onNotifyChange,
  onNext,
  onBack
}) => {
  const frequencies: { value: AlertFrequency; label: string; description: string }[] = [
    { value: 'hourly', label: 'Hourly', description: 'Get updates every hour' },
    { value: 'daily', label: 'Daily', description: 'One digest per day' },
    { value: 'weekly', label: 'Weekly', description: 'One digest per week' },
    { value: 'monthly', label: 'Monthly', description: 'One digest per month' },
    { value: 'never', label: 'Never', description: 'No alerts' }
  ];

  return (
    <div className="onboarding-full-height">
      <div className="onboarding-center">
        <h2 className="onboarding-title">Alert Preferences</h2>
        <p className="onboarding-subtitle">Choose how often you want to receive updates</p>
      </div>

      {/* Frequency Selection */}
      <div className="onboarding-scrollable onboarding-space-y-3">
        {frequencies.map((freq) => (
          <button
            key={freq.value}
            onClick={() => onFrequencyChange(freq.value)}
            className={`onboarding-alert-item ${selectedFrequency === freq.value ? 'onboarding-alert-item-selected' : 'onboarding-alert-item-unselected'}`}
          >
            {/* Radio Circle */}
            <div
              className={`onboarding-radio ${selectedFrequency === freq.value ? 'onboarding-radio-selected' : 'onboarding-radio-unselected'}`}
            >
              {selectedFrequency === freq.value && (
                <div className="onboarding-radio-dot" />
              )}
            </div>

            {/* Label and Description */}
            <div className="onboarding-alert-content">
              <p className={`onboarding-alert-label ${selectedFrequency === freq.value ? 'onboarding-alert-label-selected' : 'onboarding-alert-label-unselected'}`}>
                {freq.label}
              </p>
              <p className="onboarding-alert-description">{freq.description}</p>
            </div>

            {/* Check Icon */}
            {selectedFrequency === freq.value && (
              <CheckCircle2 size={20} className="onboarding-text-blue-600 onboarding-flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Notification Toggle for New Stories */}
      <div className="onboarding-mb-6 onboarding-px-2">
        <div className="onboarding-notification-toggle">
          <input
            type="checkbox"
            checked={notifyOnNewStories}
            onChange={(e) => onNotifyChange(e.target.checked)}
            className="onboarding-checkbox"
          />
          <div className="onboarding-flex-1 onboarding-ml-4">
            <p className="onboarding-font-semibold onboarding-text-gray-700">Instant notifications</p>
            <p className="onboarding-text-xs onboarding-text-gray-500">Get alerts on new stories for selected topics or sources</p>
          </div>
          <Bell size={20} className={`onboarding-notification-icon ${notifyOnNewStories ? 'onboarding-notification-icon-active' : 'onboarding-notification-icon-inactive'}`} />
        </div>
      </div>

      {/* Action Footer */}
      <div className="onboarding-footer onboarding-space-y-3">
        <button
          onClick={onNext}
          className="onboarding-btn-primary"
        >
          Continue
        </button>

        <button
          onClick={onBack}
          className="onboarding-btn-text"
        >
          Go back
        </button>
      </div>
    </div>
  );
};

export default AlertsSetup;