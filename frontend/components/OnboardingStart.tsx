interface OnboardingStartProps {
  onNext: () => void;
  onSkip: () => void;
}

const OnboardingStart = ({ onNext, onSkip }: OnboardingStartProps) => {
  return (
    <div className="onboarding-container">
      <h1 className="onboarding-title">Welcome to Your Personalized Feed</h1>
      <p className="onboarding-description">
        Finish a quick onboarding quiz to tailor recommendations to your interests.
        It takes about 60 seconds and you can skip anytime.
      </p>
      <button
        onClick={onNext}
        className="onboarding-btn-secondary"
      >
        Get Started
      </button>
      <button
        onClick={onSkip}
        className="onboarding-btn-text"
      >
        Skip for Now
      </button>
    </div>
  );
};

export default OnboardingStart;