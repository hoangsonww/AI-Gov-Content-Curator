import React from 'react';
import { useRouter } from 'next/navigation';
import { Edit2, Trash2, ArrowLeft } from 'lucide-react';

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
  
  const frequencyLabels: Record<AlertFrequency, string> = {
    hourly: 'Hourly',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
  };

  const showFeed = () => {
    router.push('/home');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2">Your Preferences</h2>
        <p className="text-gray-600">Review and manage your personalized feed settings</p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-2 space-y-6 mb-6">
        
        {/* Topics Section */}
        <div className="bg-blue-50 rounded-2xl border-2 border-blue-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-blue-900">Interested Topics</h3>
            <span className="bg-blue-200 text-blue-900 text-sm font-bold px-3 py-1 rounded-full">
              {selectedTopics.length} selected
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedTopics.map((topic) => (
              <div
                key={topic}
                className="bg-white border-2 border-blue-300 rounded-full px-4 py-2 flex items-center justify-between gap-3"
              >
                <span className="font-semibold text-blue-700">{topic}</span>
                <button
                  onClick={() => onDeleteTopic(topic)}
                  className="text-red-500 hover:text-red-700 transition"
                  title="Delete topic"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={onModifyTopics}
            className="w-full flex items-center justify-center gap-2 py-2 text-blue-600 hover:bg-blue-100 rounded-lg transition font-semibold"
          >
            <Edit2 size={16} />
            Modify Topics
          </button>
        </div>

        {/* Sources Section */}
        <div className="bg-green-50 rounded-2xl border-2 border-green-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-green-900">Preferred Sources</h3>
            <span className="bg-green-200 text-green-900 text-sm font-bold px-3 py-1 rounded-full">
              {selectedSources.length} selected
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedSources.map((source) => (
              <div
                key={source}
                className="bg-white border-2 border-green-300 rounded-full px-4 py-2 flex items-center justify-between gap-3"
              >
                <span className="font-semibold text-green-700">{source}</span>
                <button
                  onClick={() => onDeleteSource(source)}
                  className="text-red-500 hover:text-red-700 transition"
                  title="Delete source"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={onModifySources}
            className="w-full flex items-center justify-center gap-2 py-2 text-green-600 hover:bg-green-100 rounded-lg transition font-semibold"
          >
            <Edit2 size={16} />
            Modify Sources
          </button>
        </div>

        {/* Alert Preferences Section */}
        <div className="bg-purple-50 rounded-2xl border-2 border-purple-200 p-6">
          <h3 className="text-lg font-bold text-purple-900 mb-4">Alert Preferences</h3>
          
          <div className="space-y-3 mb-4">
            <div className="bg-white border-2 border-purple-300 rounded-lg p-4">
              <p className="text-sm text-gray-600">Update Frequency</p>
              <p className="text-xl font-bold text-purple-700">{frequencyLabels[selectedFrequency]}</p>
            </div>

            <div className="bg-white border-2 border-purple-300 rounded-lg p-4">
              <p className="text-sm text-gray-600">Instant Notifications</p>
              <p className={`text-xl font-bold ${notifyOnNewStories ? 'text-green-600' : 'text-gray-500'}`}>
                {notifyOnNewStories ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>

          <button
            onClick={onModifyAlerts}
            className="w-full flex items-center justify-center gap-2 py-2 text-purple-600 hover:bg-purple-100 rounded-lg transition font-semibold"
          >
            <Edit2 size={16} />
            Modify Alerts
          </button>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-auto pt-4 space-y-3 border-t border-gray-100">
        <button
          className="w-full py-4 rounded-xl bg-black text-white font-bold hover:bg-gray-800 transition-colors"
          onClick={showFeed}
        >
          Start Browsing Feed
        </button>

        <button
          onClick={onModifyTopics}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft size={16} />
          Back to quiz
        </button>
      </div>
    </div>
  );
};

export default PersonalizedFeed;