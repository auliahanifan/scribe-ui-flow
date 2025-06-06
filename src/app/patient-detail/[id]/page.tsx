"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom"; // Assuming react-router-dom is used in your Next.js app
import { usePatientStore } from "@/lib/store/patient-store";
// Updated import to use the new recording store for Deepgram streaming
import { useRecordingStore } from "@/lib/store/recording-store";

import { PatientHeader } from "@/components/patient/PatientHeader";
import { SOAPNoteDisplay } from "@/components/soap/SOAPNoteDisplay";
// import { RecordButton } from '@/components/recording/RecordButton'; // Replaced with direct buttons for now
import { RecordButton } from "@/components/recording/RecordButton";
import { SavedRecordingsList } from "@/components/recording/SavedRecordingsList";
import { BottomNavigation } from "@/components/ui/bottom-navigation";
import { Button } from "@/components/ui/button";
import TranscriptionDisplay from "@/components/TranscriptionDisplay";
import SOAPNoteGenerator from "@/components/soap/SOAPNoteGenerator";
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

  // Get patient data from patient store
  const { patients, selectedPatient, selectPatient } = usePatientStore();

  // Get recording state from the new recording store
  const {
    recordingStatus,
    recordingDuration,
    finalTranscription,
    partialTranscription,
    connectionStatus,
    isStreaming,
    soapNote,
    transcriptionSegments,
    toggleRecording,
    generateSOAP,
    resetSession,
    playRecording,
    stopPlayback,
    getSavedRecordingsForPatient,
  } = useRecordingStore();

  const patientId = params.id || "";
  const isRecording = recordingStatus === 'recording';

  // Patient selection effect
  useEffect(() => {
    const patient = patients.find((p) => p.id === patientId);
    if (patient) {
      selectPatient(patient);
    } else if (patientId) {
      navigate("/patient-queue");
    }
  }, [patientId, patients, selectPatient, navigate]);

  // Reset recording session when entering patient detail page
  useEffect(() => {
    resetSession();
  }, [patientId, resetSession]);


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

  const handleToggleRecording = async () => {
    await toggleRecording(patientId);
  };

  const handleGenerateSOAP = async () => {
    await generateSOAP();
  };

  // Get the saved recordings using the current patient ID
  const savedRecordings = getSavedRecordingsForPatient(patientId);

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
      <div className="flex-1 p-6 space-y-6">
        {/* Transcription Display */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Live Transcription</h2>
          <TranscriptionDisplay
            finalTranscription={finalTranscription}
            partialTranscription={partialTranscription}
            isRecording={isRecording}
            connectionStatus={connectionStatus}
            isStreaming={isStreaming}
            transcriptionSegments={transcriptionSegments}
          />
        </div>

        {/* Recording Controls */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex flex-col items-center space-y-4">
            <RecordButton
              status={recordingStatus}
              onToggleRecording={handleToggleRecording}
              recordingDuration={recordingDuration}
              connectionStatus={connectionStatus}
              isStreaming={isStreaming}
            />
          </div>
        </div>

        {/* SOAP Note Generator */}
        <div className="bg-white p-6 rounded-lg shadow">
          <SOAPNoteGenerator
            transcription={finalTranscription}
            patientName={selectedPatient.name}
            isGenerating={recordingStatus === 'processing'}
            onSOAPGenerated={(soapResponse) => {
              // Handle SOAP note generation completion if needed
              console.log('SOAP note generated:', soapResponse);
            }}
          />
        </div>

        {/* Legacy SOAP Display (if exists) */}
        {soapNote && (
          <div className="bg-white p-6 rounded-lg shadow">
            <SOAPNoteDisplay soapNote={soapNote} />
          </div>
        )}
      </div>

      {/* Saved Recordings Section */}
      <div className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex justify-center mb-4">
            <Button
              variant="outline"
              onClick={() => setShowSavedRecordings(!showSavedRecordings)}
            >
              {showSavedRecordings ? "Hide" : "Show"} Previously Saved
              Recordings
            </Button>
          </div>

          {showSavedRecordings && savedRecordings.length > 0 && (
            <SavedRecordingsList
              recordings={savedRecordings}
              onPlay={playRecording}
              onStop={stopPlayback}
            />
          )}
          {showSavedRecordings && savedRecordings.length === 0 && (
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
