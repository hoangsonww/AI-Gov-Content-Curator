'use client'

import React, { useState } from 'react';
import TopicSelection from '../../components/TopicSelection';
import SourceSelection from '../../components/SourceSelection';
import AlertsSetup from '../../components/AlertsSetup';
import PersonalizedFeed from '../../components/PersonalizedFeed';
import OnboardingStart from '../../components/OnboardingStart';

type AlertFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly';

const OnboardingQuiz = () => {
  const [step, setStep] = useState(1);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedFrequency, setSelectedFrequency] = useState<AlertFrequency>('daily');
  const [notifyOnNewStories, setNotifyOnNewStories] = useState(true);

  const [topics, setTopics] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);


  // Placeholder for fetching topics from API / back-end
  const fetchTopics = async () => {
    try {
      // TODO: Replace this placeholder with real API call, e.g. GET /api/topics
      const placeholderTopics = [
        "Technology",
        "Politics",
        "Health",
        "Business",
        "Science",
        "Sports",
        "Entertainment",
        "Environment",
        "Education",
        "World",
      ];
      // simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 300));
      setTopics(placeholderTopics);
    } catch (error) {
      console.error("Failed to fetch topics", error);
      // fallback: using a small set
      setTopics(["Technology", "News", "Science"]);
    }
  };

  // Placeholder for fetching topics from API / back-end
  const fetchSources = async () => {
    try {
      // TODO: Replace this placeholder with real API call, e.g. GET /api/topics
      const placeholderSources = [
        "BBC",
        "CNN",
        "The White House",
        "Fox News",
        "The Guardian",
        "AP News"
      ];
      // simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 300));
      setSources(placeholderSources);
    } catch (error) {
      console.error("Failed to fetch topics", error);
      // fallback: using a small set
      setSources(["BBC", "CNN", "WION"]);
    }
  };

  React.useEffect(() => {
    fetchTopics();
    fetchSources();
  }, []);

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev => 
      prev.includes(topic) 
        ? prev.filter(t => t !== topic) 
        : [...prev, topic]
    );
  };

  const toggleSource = (source: string) => {
    setSelectedSources(prev => 
      prev.includes(source) 
        ? prev.filter(s => s !== source) 
        : [...prev, source]
    );
  };

  const updateFrequency = (frequency: AlertFrequency) => {
    setSelectedFrequency(frequency);
  };

  const updateNotifyOnNewStories = (notify: boolean) => {
    setNotifyOnNewStories(notify);
  };

  const deleteTopic = (topic: string) => {
    setSelectedTopics(prev => prev.filter(t => t !== topic));
  };

  const deleteSource = (source: string) => {
    setSelectedSources(prev => prev.filter(s => s !== source));
  };

  const goToTopicsStep = () => {
    setStep(2); // Go to topic selection step
  };

  const goToSourcesStep = () => {
    setStep(3); // Go to sources selection step
  };

  const goToAlertsStep = () => {
    setStep(4); // Go to alerts setup step
  };

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);
  const skip = () => setStep(5); // Direct jump to feed

  return (
    <div className="w-full h-screen flex flex-col bg-white border border-gray-200">
      {/* Progress Bar (Visible on Screens 2-4) */}
      {step >= 2 && step <= 4 && (
        <div className="w-full bg-gray-100 h-2">
          <div className={`bg-blue-600 h-2 transition-all duration-300`} 
               style={{ width: `${(step - 1) * 33.3}%` }} />
        </div>
      )}

      {/* Screen Rendering */}
      <main className="flex-1 p-6">
        {step === 1 && <OnboardingStart onNext={nextStep} onSkip={skip} />}
        {step === 2 && <TopicSelection topics={topics} selectedTopics={selectedTopics} onToggle={toggleTopic} onNext={nextStep} onSkip={skip} />}
        {step === 3 && <SourceSelection sources={sources} selectedSources={selectedSources} onToggle={toggleSource} onNext={nextStep} onBack={prevStep} onSkip={skip} />}
        {step === 4 && <AlertsSetup selectedFrequency={selectedFrequency} notifyOnNewStories={notifyOnNewStories} onFrequencyChange={updateFrequency} onNotifyChange={updateNotifyOnNewStories} onNext={nextStep} onBack={prevStep} />}
        {step === 5 && <PersonalizedFeed selectedTopics={selectedTopics} selectedSources={selectedSources} selectedFrequency={selectedFrequency} notifyOnNewStories={notifyOnNewStories} onModifyTopics={goToTopicsStep} onModifySources={goToSourcesStep} onModifyAlerts={goToAlertsStep} onDeleteTopic={deleteTopic} onDeleteSource={deleteSource} />}
      </main>
    </div>
  );
};

export default OnboardingQuiz;