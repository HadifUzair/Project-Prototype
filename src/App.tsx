import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import MainInterface from './components/MainInterface';
import { AppState } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.LANDING);

  return (
    <>
      {appState === AppState.LANDING && (
        <LandingPage onStart={() => setAppState(AppState.INTERFACE)} />
      )}
      {appState === AppState.INTERFACE && (
        <MainInterface />
      )}
    </>
  );
};

export default App;