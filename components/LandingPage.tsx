import React from 'react';

interface LandingPageProps {
  onStart: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div 
      onClick={onStart}
      className="fixed inset-0 bg-yellow-400 flex items-center justify-center cursor-pointer hover:bg-yellow-300 transition-colors duration-300"
    >
      <h1 className="text-6xl md:text-8xl font-bold text-white tracking-wide drop-shadow-md select-none animate-pulse">
        BIM BUDDY.
      </h1>
      <p className="absolute bottom-10 text-white/80 text-lg font-semibold animate-bounce">
        Click anywhere to start
      </p>
    </div>
  );
};

export default LandingPage;