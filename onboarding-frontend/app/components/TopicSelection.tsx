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
    <div className="flex flex-col h-full">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold">Select 3+ Topics</h2>
        <p className="text-sm text-gray-500">Customize your feed by choosing interests</p>
      </div>

      {/* Scrollable Grid Container */}
      <div className="flex-1 overflow-y-auto px-2 mb-6 custom-scrollbar">
        <div className="grid grid-cols-3 gap-4">
          {topics.map((topic) => {
            const isSelected = selectedTopics.includes(topic);
            return (
              <button
                key={topic}
                onClick={() => onToggle(topic)}
                className={`relative flex flex-col items-center p-4 rounded-2xl border-2 transition-all duration-200 
                  ${isSelected 
                    ? 'border-blue-600 bg-blue-50 shadow-sm' 
                    : 'border-gray-100 bg-white hover:border-gray-300'}`}
              >
                {/* Visual Check Indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 text-blue-600">
                    <CheckCircle size={16} fill="currentColor" className="text-white" />
                  </div>
                )}
                
                {/* Placeholder for Icon (as seen in wireframe) */}
                <div className={`w-12 h-12 rounded-full mb-2 flex items-center justify-center 
                  ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                  {topic[0].toUpperCase()}
                </div>
                
                <span className={`text-xs font-semibold text-center truncate w-full 
                  ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                  {topic}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-auto pt-4 space-y-3 border-t border-gray-100">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`w-full py-4 rounded-xl font-bold transition-colors
            ${canProceed 
              ? 'bg-black text-white hover:bg-gray-800' 
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
        >
          {canProceed ? 'Continue' : 'Select 3 more'}
        </button>
        
        <button 
          onClick={onSkip}
          className="w-full py-2 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
};

export default TopicSelection;
