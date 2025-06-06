import React, { useEffect, useRef } from 'react';

interface TranscriptionDisplayProps {
  finalTranscription: string;
  partialTranscription: string;
  isRecording: boolean;
}

const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({ finalTranscription, partialTranscription, isRecording }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [finalTranscription, partialTranscription]); // Scroll on new text

  // Determine placeholder text based on recording state
  let placeholderText = "Click 'Start Recording' to begin transcription.";
  if (isRecording && !finalTranscription && !partialTranscription) {
    placeholderText = "Listening...";
  }

  const hasContent = finalTranscription || partialTranscription;

  return (
    <div 
      ref={scrollRef} 
      className="w-full h-48 p-4 border border-gray-300 rounded-md overflow-y-auto bg-white shadow-sm transition-all duration-300 ease-in-out"
      aria-live="polite" // Announce changes to screen readers
      role="log" // Semantic role for a log
    >
      {hasContent ? (
        <p className="text-gray-800 whitespace-pre-wrap break-words">
          {finalTranscription}
          {finalTranscription && partialTranscription ? ' ' : ''} {/* Add space if both exist */}
          <span className="text-gray-500">
            {partialTranscription}
          </span>
        </p>
      ) : (
        <p className="text-gray-400 italic text-center flex items-center justify-center h-full">
          {placeholderText}
        </p>
      )}
    </div>
  );
};

export default TranscriptionDisplay;
