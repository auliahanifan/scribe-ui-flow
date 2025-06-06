
'use client';

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePatientStore } from '@/lib/store/patient-store';
import { useRecordingStore } from '@/lib/store/recording-store';
import { PatientHeader } from '@/components/patient/PatientHeader';
import { SOAPNoteDisplay } from '@/components/soap/SOAPNoteDisplay';
import { RecordButton } from '@/components/recording/RecordButton';
import { SavedRecordingsList } from '@/components/recording/SavedRecordingsList';
import { BottomNavigation } from '@/components/ui/bottom-navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save } from 'lucide-react';

export default function PatientDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [showSavedRecordings, setShowSavedRecordings] = useState(false);
  
  // Get patient data and recording state from stores
  const { patients, selectedPatient, selectPatient } = usePatientStore();
  const { 
    toggleRecording, 
    recordingStatus, 
    recordingDuration,
    saveRecording,
    playRecording,
    stopPlayback,
    getSavedRecordingsForPatient,
    soapNote
  } = useRecordingStore();
  
  // Define patientId once and use it throughout the component
  const patientId = params.id || '';

  useEffect(() => {
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      selectPatient(patient);
    } else {
      navigate('/patient-queue');
    }
  }, [patientId, patients, selectPatient, navigate]);

  if (!selectedPatient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading patient...</p>
        </div>
      </div>
    );
  }

  const handleToggleRecording = async () => {
    console.log('Toggle recording for patient:', patientId);
    await toggleRecording(patientId);
  };
  
  const handleSaveRecording = async () => {
    if (recordingDuration > 0) {
      try {
        console.log('Saving recording for patient:', patientId);
        
        const savedRecording = await saveRecording(patientId);
        if (savedRecording) {
          console.log('Recording saved successfully:', savedRecording.id);
          setShowSavedRecordings(true);
        }
      } catch (error) {
        console.error('Error saving recording:', error);
        // Could show an error message to the user here
      }
    }
  };
  
  // Get the saved recordings using the current patient ID
  const savedRecordings = getSavedRecordingsForPatient(patientId);
  
  console.log('Patient detail page - Patient ID:', patientId);
  console.log('Patient detail page - Saved recordings:', savedRecordings?.length || 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header with Back Button */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Queue
          </Button>
        </div>
        <PatientHeader patient={selectedPatient} />
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <SOAPNoteDisplay soapNote={soapNote} />
        </div>
      </div>

      {/* Recording Section */}
      <div className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex flex-col items-center mb-8">
            <RecordButton
              status={recordingStatus}
              onToggleRecording={handleToggleRecording}
              recordingDuration={recordingDuration}
            />
            
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
          </div>
          
          {/* Toggle Saved Recordings */}
          <div className="mb-6 flex justify-center">
            <Button 
              variant="outline" 
              onClick={() => setShowSavedRecordings(!showSavedRecordings)}
            >
              {showSavedRecordings ? 'Hide' : 'Show'} Saved Recordings
            </Button>
          </div>
          
          {/* Saved Recordings List */}
          {showSavedRecordings && (
            <SavedRecordingsList 
              recordings={savedRecordings}
              onPlay={playRecording}
              onStop={stopPlayback}
            />
          )}
        </div>
      </div>

      <BottomNavigation activeTab="patient-detail" />
    </div>
  );
}
