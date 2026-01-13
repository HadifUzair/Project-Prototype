import React, { useState, useCallback, useEffect } from "react";

interface MediaInfo {
  image: string | null;
  video: string | null;
  translation: string;
}

interface SignResult {
  word: string;
  media: MediaInfo | null;
  found: boolean;
  is_full_phrase?: boolean;
}

interface TranslationResult {
  exists: boolean;
  imageUrl?: string;
  videoUrl?: string;
  error?: string;
  currentWord?: string;
  isFullPhrase?: boolean;
}

const MainInterface: React.FC = () => {
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [multipleResults, setMultipleResults] = useState<SignResult[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  // Connection state
  const [backendStatus, setBackendStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [dictionaryCount, setDictionaryCount] = useState<number>(0);
  const [isFullPhraseMode, setIsFullPhraseMode] = useState(false);

  // Health Check
  const checkHealth = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/health");
      const data = await response.json();
      if (data.status === "healthy") {
        setBackendStatus("connected");
        setDictionaryCount(data.dictionary_size || 0);
      } else {
        throw new Error("Backend not healthy");
      }
    } catch (err) {
      setBackendStatus("disconnected");
      setDictionaryCount(0);
    }
  };

  // Run health check on mount
  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Translation function
  const handleTranslate = useCallback(async () => {
    if (!inputText.trim()) {
      setErrorMessage("Please enter some text");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setResult(null);
    setMultipleResults([]);
    setCurrentResultIndex(0);

    try {
      const response = await fetch("http://127.0.0.1:5000/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ text: inputText }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      console.log("API Response:", data); // Debug log

      if (data.results && data.results.length > 0) {
        const foundResults = data.results.filter((r: SignResult) => r.found);
        const isFullPhrase = data.is_full_phrase || false;
        setIsFullPhraseMode(isFullPhrase);

        if (foundResults.length > 0) {
          // If it's a full phrase, show just that
          if (isFullPhrase && foundResults[0].media) {
            const firstResult = foundResults[0];
            const mediaUrl = firstResult.media.image || firstResult.media.video;

            if (mediaUrl) {
              const cleanUrl = mediaUrl.replace(/^\/+/, "");
              const fullUrl = `http://127.0.0.1:5000/${cleanUrl}`;

              setResult({
                exists: true,
                imageUrl: firstResult.media.image ? fullUrl : undefined,
                videoUrl: firstResult.media.video ? fullUrl : undefined,
                currentWord: firstResult.word.toUpperCase(),
                isFullPhrase: true,
              });
            }
          }
          // If multiple words found
          else if (foundResults.length > 1) {
            setMultipleResults(foundResults);
            const firstResult = foundResults[0];
            if (firstResult.media) {
              const mediaUrl =
                firstResult.media.image || firstResult.media.video;
              if (mediaUrl) {
                const cleanUrl = mediaUrl.replace(/^\/+/, "");
                const fullUrl = `http://127.0.0.1:5000/${cleanUrl}`;

                setResult({
                  exists: true,
                  imageUrl: firstResult.media.image ? fullUrl : undefined,
                  videoUrl: firstResult.media.video ? fullUrl : undefined,
                  currentWord: firstResult.word.toUpperCase(),
                  isFullPhrase: false,
                });
              }
            }
          }
          // Single word found
          else if (foundResults.length === 1 && foundResults[0].media) {
            const firstResult = foundResults[0];
            const mediaUrl = firstResult.media.image || firstResult.media.video;

            if (mediaUrl) {
              const cleanUrl = mediaUrl.replace(/^\/+/, "");
              const fullUrl = `http://127.0.0.1:5000/${cleanUrl}`;

              setResult({
                exists: true,
                imageUrl: firstResult.media.image ? fullUrl : undefined,
                videoUrl: firstResult.media.video ? fullUrl : undefined,
                currentWord: firstResult.word.toUpperCase(),
                isFullPhrase: false,
              });
            }
          } else {
            setResult({ exists: false });
            setErrorMessage("No media found for the word(s)");
          }
        } else {
          setResult({ exists: false });
          setErrorMessage("No sign found for the input text");
        }
      } else {
        setResult({ exists: false });
        setErrorMessage("No translation results received");
      }
    } catch (error: any) {
      console.error("Translation error:", error);
      setErrorMessage(
        `Error: ${error.message || "Failed to connect to server"}`
      );
      setResult({ exists: false, error: error.message });
    } finally {
      setLoading(false);
    }
  }, [inputText]);

  // Navigation functions for multiple results
  const showNextResult = () => {
    if (currentResultIndex < multipleResults.length - 1) {
      const nextIndex = currentResultIndex + 1;
      const nextResult = multipleResults[nextIndex];

      if (nextResult.media) {
        const mediaUrl = nextResult.media.image || nextResult.media.video;
        if (mediaUrl) {
          const cleanUrl = mediaUrl.replace(/^\/+/, "");
          const fullUrl = `http://127.0.0.1:5000/${cleanUrl}`;

          setResult({
            exists: true,
            imageUrl: nextResult.media.image ? fullUrl : undefined,
            videoUrl: nextResult.media.video ? fullUrl : undefined,
            currentWord: nextResult.word.toUpperCase(),
            isFullPhrase: false,
          });
          setCurrentResultIndex(nextIndex);
        }
      }
    }
  };

  const showPreviousResult = () => {
    if (currentResultIndex > 0) {
      const prevIndex = currentResultIndex - 1;
      const prevResult = multipleResults[prevIndex];

      if (prevResult.media) {
        const mediaUrl = prevResult.media.image || prevResult.media.video;
        if (mediaUrl) {
          const cleanUrl = mediaUrl.replace(/^\/+/, "");
          const fullUrl = `http://127.0.0.1:5000/${cleanUrl}`;

          setResult({
            exists: true,
            imageUrl: prevResult.media.image ? fullUrl : undefined,
            videoUrl: prevResult.media.video ? fullUrl : undefined,
            currentWord: prevResult.word.toUpperCase(),
            isFullPhrase: false,
          });
          setCurrentResultIndex(prevIndex);
        }
      }
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleTranslate();
    }
  };

  // Clear input and results
  const handleClear = () => {
    setInputText("");
    setResult(null);
    setMultipleResults([]);
    setCurrentResultIndex(0);
    setErrorMessage("");
  };

  // Set example text
  const setExampleText = (text: string) => {
    setInputText(text);
  };

  return (
    <div className="min-h-screen bg-yellow-400 flex flex-col items-center py-8 px-4 font-sans">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter drop-shadow-md">
          BIM BUDDY
        </h1>

        {/* Connection Status Bar */}
        <div className="mt-4 flex items-center justify-center gap-4 bg-white/20 backdrop-blur-sm rounded-full px-6 py-2 border border-white/30 shadow-sm">
          <div className="flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${
                backendStatus === "connected"
                  ? "bg-green-400 animate-pulse"
                  : backendStatus === "connecting"
                  ? "bg-blue-400 animate-spin"
                  : "bg-red-500"
              }`}
            />
            <span className="text-white text-xs font-bold uppercase tracking-widest">
              {backendStatus === "connected" ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="h-4 w-px bg-white/30" />
          <div className="flex items-center gap-2">
            <span className="text-white/80 text-xs font-bold uppercase tracking-widest">
              Dictionary: {dictionaryCount} Signs
            </span>
          </div>
          {isFullPhraseMode && (
            <>
              <div className="h-4 w-px bg-white/30" />
              <div className="flex items-center gap-2">
                <span className="text-white/90 text-xs font-bold uppercase tracking-widest bg-green-500/30 px-2 py-1 rounded">
                  Full Phrase Mode
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Input */}
        <div className="bg-cyan-400 rounded-[2.5rem] p-8 shadow-2xl border-b-8 border-cyan-600 flex flex-col h-[500px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-white uppercase tracking-widest">
              Text Input
            </h2>
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-bold rounded-full transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="bg-white rounded-3xl flex-grow p-6 shadow-inner flex flex-col overflow-hidden">
            <textarea
              className="w-full h-full bg-transparent resize-none outline-none text-gray-800 text-3xl font-bold placeholder-gray-200 text-center flex items-center justify-center p-2"
              placeholder="Type Malay words...&#10;Try: 'Saya', 'Terima Kasih', 'Apa Khabar'"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              rows={4}
            />

            {/* Example Buttons */}
            <div className="mt-4 mb-4">
              <p className="text-gray-600 text-sm font-bold mb-2 text-center">
                Try these examples:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "Saya",
                  "Makan",
                  "Terima Kasih",
                  "Apa Khabar",
                  "Selamat Pagi",
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => setExampleText(example)}
                    disabled={loading}
                    className="px-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-sm font-bold rounded-full transition-colors disabled:opacity-50"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {/* Translate Button */}
            <div className="mt-4 flex flex-col items-center gap-3">
              <button
                onClick={handleTranslate}
                disabled={
                  loading || !inputText.trim() || backendStatus !== "connected"
                }
                className={`w-full py-4 rounded-2xl font-black text-xl text-white shadow-lg transition-all transform active:scale-95 
                  ${
                    loading ||
                    !inputText.trim() ||
                    backendStatus !== "connected"
                      ? "bg-gray-200 cursor-not-allowed text-gray-400"
                      : "bg-yellow-400 hover:bg-yellow-300 border-b-4 border-yellow-600 active:border-b-0"
                  }`}
              >
                {loading ? "SEARCHING..." : "TRANSLATE TO BIM"}
              </button>

              {errorMessage && (
                <p className="text-red-500 font-bold text-sm bg-red-50 px-4 py-1 rounded-lg">
                  {errorMessage}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Output */}
        <div className="bg-cyan-400 rounded-[2.5rem] p-8 shadow-2xl border-b-8 border-cyan-600 flex flex-col h-[500px]">
          <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-widest">
            BIM Visual
          </h2>

          <div className="bg-white rounded-3xl flex-grow p-4 shadow-inner flex flex-col items-center justify-center relative overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
            {/* Loading Overlay */}
            {loading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-8 border-cyan-400 border-t-yellow-400 rounded-full animate-spin"></div>
                <p className="mt-4 font-black text-cyan-600 animate-bounce">
                  LOADING BIM SIGN...
                </p>
              </div>
            )}

            {/* Initial State */}
            {!result && !loading && (
              <div className="text-center p-8">
                <div className="text-6xl mb-4 animate-bounce">👋</div>
                <p className="text-gray-400 font-black text-xl uppercase leading-tight">
                  Waiting for
                  <br />
                  Malay input
                </p>
                <p className="text-gray-300 text-sm mt-2">
                  Type text on the left and click TRANSLATE
                </p>
              </div>
            )}

            {/* Success Results */}
            {result?.exists && (
              <div className="w-full h-full flex flex-col">
                {/* Word Display */}
                <div className="text-center mb-4">
                  <h3 className="text-2xl font-black text-cyan-700">
                    {result.currentWord}
                  </h3>
                  {result.isFullPhrase && (
                    <p className="text-green-600 text-sm font-bold mt-1">
                      ✓ Full phrase recognized
                    </p>
                  )}
                </div>

                {/* Media Display */}
                <div className="flex-grow w-full flex items-center justify-center overflow-hidden rounded-2xl border-4 border-gray-50 bg-gray-50 shadow-sm">
                  {result.videoUrl ? (
                    <video
                      key={result.videoUrl}
                      src={result.videoUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      controls
                      className="max-w-full max-h-64 object-contain"
                    />
                  ) : result.imageUrl ? (
                    <img
                      src={result.imageUrl}
                      alt={`BIM Sign for ${result.currentWord}`}
                      className="max-w-full max-h-64 object-contain p-2"
                      onError={(e) => {
                        console.error("Image failed to load:", result.imageUrl);
                        e.currentTarget.src =
                          "https://via.placeholder.com/400x300?text=Image+Not+Found";
                      }}
                    />
                  ) : (
                    <div className="text-center">
                      <div className="text-4xl mb-2">🤷‍♂️</div>
                      <p className="text-gray-400 font-bold">
                        No media available
                      </p>
                    </div>
                  )}
                </div>

                {/* Media Type Indicator */}
                <div className="mt-3 text-center">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      result.videoUrl
                        ? "bg-blue-100 text-blue-600"
                        : "bg-green-100 text-green-600"
                    }`}
                  >
                    {result.videoUrl ? "🎬 BIM Video" : "🖼️ BIM Image"}
                  </span>
                </div>

                {/* Navigation for multiple results */}
                {multipleResults.length > 1 && (
                  <div className="mt-4 flex justify-between items-center">
                    <button
                      onClick={showPreviousResult}
                      disabled={currentResultIndex === 0}
                      className={`px-4 py-2 rounded-lg font-bold text-sm ${
                        currentResultIndex === 0
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-yellow-400 hover:bg-yellow-500 text-white"
                      }`}
                    >
                      ← Previous
                    </button>

                    <div className="text-gray-600 font-bold text-sm">
                      {currentResultIndex + 1} of {multipleResults.length}
                    </div>

                    <button
                      onClick={showNextResult}
                      disabled={
                        currentResultIndex >= multipleResults.length - 1
                      }
                      className={`px-4 py-2 rounded-lg font-bold text-sm ${
                        currentResultIndex >= multipleResults.length - 1
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-yellow-400 hover:bg-yellow-500 text-white"
                      }`}
                    >
                      Next →
                    </button>
                  </div>
                )}

                {/* Success Message */}
                <div className="mt-3 text-center">
                  <span className="bg-green-100 text-green-600 px-4 py-1 rounded-full font-bold text-sm">
                    ✓ Found in BIM Dictionary
                  </span>
                </div>
              </div>
            )}

            {/* Error State */}
            {result && !result.exists && !loading && (
              <div className="text-center">
                <div className="text-6xl mb-4">😿</div>
                <p className="text-red-500 font-black text-xl uppercase">
                  Not Found
                </p>
                <p className="text-gray-400 text-sm font-bold mt-2">
                  No BIM sign found for "{inputText}"
                </p>
                <button
                  onClick={() => setExampleText("Saya")}
                  className="mt-4 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-white font-bold rounded-full transition-colors"
                >
                  Try "Saya" instead
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center">
        <p className="text-yellow-900 font-black text-xs uppercase tracking-widest opacity-40">
          Malaysian Sign Language Learning Tool • BIM Buddy v1.0 • Powered by
          Gemini AI
        </p>
        <p className="text-yellow-800 text-xs mt-2 opacity-60">
          Backend: http://127.0.0.1:5000 • Dictionary: {dictionaryCount} signs
        </p>
      </footer>
    </div>
  );
};

export default MainInterface;
