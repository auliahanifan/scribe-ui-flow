"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom"; // Assuming react-router-dom is used in your Next.js app
import { usePatientStore } from "@/lib/store/patient-store";
// Updated import to use the new recording store for Deepgram streaming
import { useRecordingStore } from "@/lib/recordingStore";
import { AudioStreamer } from "../../../lib/audioStreamer"; // Adjusted path

import { PatientHeader } from "@/components/patient/PatientHeader";
import { SOAPNoteDisplay } from "@/components/soap/SOAPNoteDisplay";
// import { RecordButton } from '@/components/recording/RecordButton'; // Replaced with direct buttons for now
import { SavedRecordingsList } from "@/components/recording/SavedRecordingsList";
import { BottomNavigation } from "@/components/ui/bottom-navigation";
import { Button } from "@/components/ui/button";
import TranscriptionDisplay from "@/components/TranscriptionDisplay"; // Added import
import {
  ArrowLeft,
  Save,
  Mic,
  StopCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  WifiOff,
} from "lucide-react";

// Helper function to format time
const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
};

export default function PatientDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [showSavedRecordings, setShowSavedRecordings] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  // Get patient data from patient store
  const { patients, selectedPatient, selectPatient } = usePatientStore();

  // Get recording state from the new recording store
  const {
    isRecording,
    isStreaming,
    transcriptionText,
    partialTranscription,
    isGeneratingSOAP,
    soapNote, // This might be from the old store, ensure it's compatible or update its source
    connectionStatus,
    // Actions from the new store are mostly called by AudioStreamer itself
    // We might need resetRecordingState if we want a manual reset button
  } = useRecordingStore();

  // Old store items - these might need to be re-evaluated or removed if not used with new flow
  // const {
  //   playRecording, // For playing saved local recordings
  //   stopPlayback,  // For stopping playback of saved local recordings
  //   getSavedRecordingsForPatient
  // } = useRecordingStore(state => ({
  //   playRecording: (state as any).playRecording, // Cast if these are from old store mixed in
  //   stopPlayback: (state as any).stopPlayback,
  //   getSavedRecordingsForPatient: (state as any).getSavedRecordingsForPatient,
  // }));
  // TODO: The above block was causing an infinite loop. playRecording, stopPlayback, and getSavedRecordingsForPatient need to be sourced correctly.
  // For now, let's define them as undefined or no-op functions to prevent further errors until they are properly implemented/sourced.
  const playRecording = undefined; // Placeholder
  const stopPlayback = undefined; // Placeholder
  const getSavedRecordingsForPatient = (patientId: string) => []; // Placeholder

  const patientId = params.id || "";

  useEffect(() => {
    // Initialize AudioStreamer on component mount
    if (!audioStreamerRef.current) {
      audioStreamerRef.current = new AudioStreamer();
    }
    // Cleanup AudioStreamer on component unmount
    return () => {
      if (audioStreamerRef.current && isRecording) {
        audioStreamerRef.current.stopStreaming();
      }
    };
  }, [isRecording]); // Add isRecording to dependencies if cleanup logic depends on it

  useEffect(() => {
    const patient = patients.find((p) => p.id === patientId);
    if (patient) {
      selectPatient(patient);
    } else {
      // Consider navigating only if patientId is present but not found
      // This might run on initial render before params.id is available if not careful
      if (patientId) navigate("/patient-queue");
    }
  }, [patientId, patients, selectPatient, navigate]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording) {
      setElapsedTime(0); // Reset timer on new recording start
      interval = setInterval(() => {
        setElapsedTime((prevTime) => prevTime + 1);
      }, 1000);
    } else if (!isRecording && elapsedTime !== 0) {
      // If recording stopped, clear interval. elapsedTime will retain the final duration.
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]); // Removed elapsedTime from dependency array to prevent reset issues

  if (!selectedPatient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading patient data...</p>
        </div>
      </div>
    );
  }

  const handleStartRecording = async () => {
    if (audioStreamerRef.current) {
      setElapsedTime(0); // Reset timer display
      await audioStreamerRef.current.startStreaming();
    }
  };

  const handleStopRecording = () => {
    if (audioStreamerRef.current) {
      audioStreamerRef.current.stopStreaming();
    }
  };

  // Get the saved recordings using the current patient ID (assuming this is for locally saved ones)
  const savedRecordings = getSavedRecordingsForPatient
    ? getSavedRecordingsForPatient(patientId)
    : [];

  let statusMessage = "";
  let canStartRecording =
    !isRecording &&
    (connectionStatus === "disconnected" ||
      connectionStatus === "error_mic_permission" ||
      connectionStatus === "error_mic_unsupported" ||
      connectionStatus === "error_config_api_key" ||
      connectionStatus === "error_websocket" ||
      connectionStatus === "error_connection_lost" ||
      connectionStatus === "error_deepgram_api" ||
      connectionStatus === "error_recorder" ||
      connectionStatus === "error_recorder_unsupported" ||
      connectionStatus === "error_recorder_mime_unsupported");

  let startButtonText = "Start Recording";

  if (isRecording) {
    if (
      connectionStatus === "connected" ||
      connectionStatus === "authenticating"
    ) {
      startButtonText = "Recording...";
    }
  } else {
    switch (connectionStatus) {
      case "connecting":
      case "connecting_ws":
        startButtonText = "Connecting...";
        statusMessage = "Attempting to connect...";
        break;
      case "authenticating":
        startButtonText = "Authenticating...";
        statusMessage = "Authenticating with transcription service...";
        break;
      case "error_mic_permission":
        statusMessage =
          "Microphone permission denied. Please enable it in your browser settings.";
        break;
      case "error_mic_unsupported":
        statusMessage = "Microphone access is not supported by your browser.";
        break;
      case "error_config_api_key":
        statusMessage =
          "API key for transcription service is not configured correctly.";
        break;
      case "error_websocket":
      case "error_connection_lost":
        statusMessage =
          "Connection to transcription service failed. Please check your internet connection.";
        break;
      case "error_deepgram_api":
        statusMessage =
          "Error from transcription service. Please try again later.";
        break;
      default:
        if (connectionStatus.startsWith("reconnecting_attempt_")) {
          startButtonText = "Reconnecting...";
          statusMessage = `Connection lost. Attempting to reconnect (${connectionStatus
            .split("_")
            .pop()})...`;
        }
        break;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Queue
          </Button>
        </div>
        <PatientHeader patient={selectedPatient} />
      </div>

      {/* Main Content Area - Transcription and SOAP */}
      <div className="flex-1 p-6 grid md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Live Transcription</h2>
          <TranscriptionDisplay
            finalTranscription={transcriptionText}
            partialTranscription={partialTranscription}
            isRecording={isRecording}
          />
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <SOAPNoteDisplay soapNote={soapNote} />
        </div>
      </div>

      {/* Recording Controls Section */}
      <div className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex flex-col items-center">
            <div className="flex items-center space-x-4 mb-2">
              {!isRecording && (
                <Button
                  onClick={handleStartRecording}
                  disabled={
                    !canStartRecording ||
                    connectionStatus === "connecting" ||
                    connectionStatus === "connecting_ws" ||
                    connectionStatus === "authenticating" ||
                    connectionStatus.startsWith("reconnecting")
                  }
                  className="px-6 py-3 text-lg bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-transform transform hover:scale-105"
                >
                  <Mic className="h-5 w-5 mr-2" /> {startButtonText}
                </Button>
              )}
              {isRecording && (
                <Button
                  onClick={handleStopRecording}
                  className="px-6 py-3 text-lg bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-transform transform hover:scale-105"
                >
                  <StopCircle className="h-5 w-5 mr-2" /> Stop Recording
                </Button>
              )}
            </div>

            <div className="flex items-center text-gray-700 mb-2 h-10">
              {isRecording && (
                <div className="flex items-center">
                  <span className="relative flex h-3 w-3 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span>{formatDuration(elapsedTime)}</span>
                </div>
              )}
              {!isRecording && elapsedTime > 0 && (
                <span>Last recording: {formatDuration(elapsedTime)}</span>
              )}
            </div>

            {/* Connection Status Indicator */}
            <div className="flex items-center justify-center text-sm mb-2 h-5">
              {(() => {
                if (
                  isRecording &&
                  (connectionStatus === "connected" ||
                    connectionStatus === "listening_deepgram")
                ) {
                  return (
                    <span className="text-green-600 flex items-center">
                      <Mic className="h-4 w-4 mr-1" /> Transcribing...
                    </span>
                  );
                }
                if (
                  connectionStatus === "connecting" ||
                  connectionStatus === "connecting_ws" ||
                  connectionStatus === "authenticating"
                ) {
                  return (
                    <span className="text-blue-600 flex items-center">
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />{" "}
                      {connectionStatus === "authenticating"
                        ? "Authenticating..."
                        : "Connecting..."}
                    </span>
                  );
                }
                if (connectionStatus.startsWith("reconnecting")) {
                  return (
                    <span className="text-yellow-600 flex items-center">
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />{" "}
                      Reconnecting...
                    </span>
                  );
                }
                if (connectionStatus === "connected" && !isRecording) {
                  return (
                    <span className="text-green-600 flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Connected
                    </span>
                  );
                }
                if (
                  connectionStatus === "error" ||
                  connectionStatus === "error_auth" ||
                  connectionStatus === "error_ws_closed"
                ) {
                  let connErrorMessage = "Connection Error";
                  if (connectionStatus === "error_auth")
                    connErrorMessage = "Authentication Failed";
                  if (connectionStatus === "error_ws_closed")
                    connErrorMessage = "Connection Lost";
                  return (
                    <span className="text-red-600 flex items-center">
                      <WifiOff className="h-4 w-4 mr-1" /> {connErrorMessage}
                    </span>
                  );
                }
                return null; // Default: no specific connection status to show, or handled by recording indicator
              })()}
            </div>

            {statusMessage && (
              <div className="mt-2 text-sm text-red-600 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-1" /> {statusMessage}
              </div>
            )}

            {/* Existing Save Recording button - commented out as its flow needs rework with Deepgram
            {recordingStatus === 'idle' && recordingDuration > 0 && (
              <Button 
                onClick={handleSaveRecording}
                className="mt-4 bg-green-600 hover:bg-green-700"
                disabled={recordingDuration === 0}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Recording to Device
              </Button>
            )} 
            */}
          </div>

          {/* Toggle Saved Recordings (for locally saved audio files) */}
          <div className="mt-6 mb-4 flex justify-center">
            <Button
              variant="outline"
              onClick={() => setShowSavedRecordings(!showSavedRecordings)}
            >
              {showSavedRecordings ? "Hide" : "Show"} Previously Saved
              Recordings
            </Button>
          </div>

          {showSavedRecordings &&
            savedRecordings &&
            savedRecordings.length > 0 && (
              <SavedRecordingsList
                recordings={savedRecordings}
                onPlay={playRecording} // Ensure these are correctly typed or handled
                onStop={stopPlayback}
              />
            )}
          {showSavedRecordings &&
            (!savedRecordings || savedRecordings.length === 0) && (
              <p className="text-center text-gray-500">
                No previously saved recordings for this patient.
              </p>
            )}
        </div>
      </div>

      <BottomNavigation activeTab="patient-detail" />
    </div>
  );
}
