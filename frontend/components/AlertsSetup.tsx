import React from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';

type AlertFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly';

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
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold">Alert Preferences</h2>
        <p className="text-sm text-gray-500">Choose how often you want to receive updates</p>
      </div>

      {/* Frequency Selection */}
      <div className="flex-1 overflow-y-auto px-2 mb-6 space-y-3">
        {frequencies.map((freq) => (
          <button
            key={freq.value}
            onClick={() => onFrequencyChange(freq.value)}
            className={`w-full flex items-center p-4 rounded-2xl border-2 transition-all duration-200 
              ${selectedFrequency === freq.value
                ? 'border-blue-600 bg-blue-50 shadow-sm'
                : 'border-gray-100 bg-white hover:border-gray-300'}`}
          >
            {/* Radio Circle */}
            <div
              className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center
                ${selectedFrequency === freq.value
                  ? 'border-blue-600 bg-blue-600'
                  : 'border-gray-300 bg-white'}`}
            >
              {selectedFrequency === freq.value && (
                <div className="w-2 h-2 bg-white rounded-full" />
              )}
            </div>

            {/* Label and Description */}
            <div className="flex-1 text-left">
              <p className={`font-semibold ${selectedFrequency === freq.value ? 'text-blue-700' : 'text-gray-700'}`}>
                {freq.label}
              </p>
              <p className="text-xs text-gray-500">{freq.description}</p>
            </div>

            {/* Check Icon */}
            {selectedFrequency === freq.value && (
              <CheckCircle2 size={20} className="text-blue-600 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Notification Toggle for New Stories */}
      <div className="mb-6 px-2">
        <div className="flex items-center p-4 rounded-2xl border-2 border-gray-100 bg-white hover:border-gray-300">
          <input
            type="checkbox"
            checked={notifyOnNewStories}
            onChange={(e) => onNotifyChange(e.target.checked)}
            className="w-5 h-5 text-blue-600 rounded cursor-pointer"
          />
          <div className="flex-1 ml-4">
            <p className="font-semibold text-gray-700">Instant notifications</p>
            <p className="text-xs text-gray-500">Get alerts on new stories for selected topics or sources</p>
          </div>
          <Bell size={20} className={notifyOnNewStories ? 'text-blue-600' : 'text-gray-400'} />
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-auto pt-4 space-y-3 border-t border-gray-100">
        <button
          onClick={onNext}
          className="w-full py-4 rounded-xl bg-black text-white font-bold hover:bg-gray-800 transition-colors"
        >
          Continue
        </button>

        <button
          onClick={onBack}
          className="w-full py-2 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          Go back
        </button>
      </div>
    </div>
  );
};

export default AlertsSetup;