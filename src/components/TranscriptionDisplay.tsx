import React, { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

interface TranscriptionSegment {
  transcript: string;
  speaker: number;
  timestamp: string;
  start?: number;
  end?: number;
  confidence: number;
}

interface TranscriptionDisplayProps {
  finalTranscription: string;
  partialTranscription: string;
  isRecording: boolean;
  connectionStatus?: string;
  isStreaming?: boolean;
  transcriptionSegments?: TranscriptionSegment[];
}

const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({
  finalTranscription,
  partialTranscription,
  isRecording,
  connectionStatus = "Disconnected",
  isStreaming = false,
  transcriptionSegments = [],
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [finalTranscription, partialTranscription]); // Scroll on new text

  // Determine placeholder text based on recording state
  let placeholderText = "Click 'Start Recording' to begin transcription.";
  if (isRecording && !finalTranscription && !partialTranscription) {
    if (connectionStatus === "Connecting...") {
      placeholderText = "Connecting to transcription service...";
    } else if (connectionStatus === "Connected" || connectionStatus === "Transcribing...") {
      placeholderText = "Listening...";
    } else if (connectionStatus === "Connection Failed") {
      placeholderText = "Connection failed. Using fallback transcription...";
    }
  }

  const hasContent = finalTranscription || partialTranscription || transcriptionSegments.length > 0;

  const getSpeakerName = (speaker: number) => {
    switch (speaker) {
      case 0: return 'Doctor';
      case 1: return 'Patient';
      default: return `Speaker ${speaker}`;
    }
  };

  const getSpeakerColor = (speaker: number) => {
    switch (speaker) {
      case 0: return 'text-blue-700 bg-blue-50'; // Doctor
      case 1: return 'text-green-700 bg-green-50'; // Patient
      default: return 'text-gray-700 bg-gray-50';
    }
  };

  const formatTimestamp = (start?: number) => {
    if (!start) return '';
    const minutes = Math.floor(start / 60);
    const seconds = Math.floor(start % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getConnectionStatusBadge = () => {
    if (!isRecording) return null;

    let variant: "default" | "secondary" | "destructive" | "outline" = "default";
    let icon = <Wifi className="h-3 w-3" />;

    switch (connectionStatus) {
      case "Connecting...":
        variant = "secondary";
        icon = <Loader2 className="h-3 w-3 animate-spin" />;
        break;
      case "Connected":
      case "Transcribing...":
        variant = "default";
        icon = <Wifi className="h-3 w-3" />;
        break;
      case "Connection Failed":
      case "Connection Error":
        variant = "destructive";
        icon = <WifiOff className="h-3 w-3" />;
        break;
      default:
        variant = "outline";
        icon = <WifiOff className="h-3 w-3" />;
    }

    return (
      <Badge variant={variant} className="text-xs gap-1">
        {icon}
        {connectionStatus}
      </Badge>
    );
  };

  return (
    <div className="space-y-2">
      {/* Connection status header */}
      {isRecording && (
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium">Real-time Transcription</h3>
          {getConnectionStatusBadge()}
        </div>
      )}
      
      <div
        ref={scrollRef}
        className="w-full h-64 p-4 border border-gray-300 rounded-md overflow-y-auto bg-white shadow-sm transition-all duration-300 ease-in-out"
        aria-live="polite" // Announce changes to screen readers
        role="log" // Semantic role for a log
      >
        {hasContent ? (
          <div className="space-y-3">
            {/* Show segments with diarization */}
            {transcriptionSegments.map((segment, index) => (
              <div key={index} className="flex flex-col space-y-1">
                <div className="flex items-center justify-between">
                  <Badge 
                    variant="outline" 
                    className={`text-xs px-2 py-1 ${getSpeakerColor(segment.speaker)}`}
                  >
                    {getSpeakerName(segment.speaker)}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(segment.start)}
                  </span>
                </div>
                <p className="text-gray-800 text-sm pl-2 border-l-2 border-gray-200">
                  {segment.transcript}
                </p>
              </div>
            ))}
            
            {/* Show partial transcription */}
            {partialTranscription && (
              <div className="flex flex-col space-y-1 opacity-70">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs px-2 py-1 bg-yellow-50 text-yellow-700">
                    Transcribing...
                  </Badge>
                </div>
                <p className="text-gray-600 text-sm italic pl-2 border-l-2 border-yellow-200">
                  {partialTranscription}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-400 italic text-center flex items-center justify-center h-full">
            {placeholderText}
          </p>
        )}
      </div>
    </div>
  );
};

export default TranscriptionDisplay;
