
'use client';

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePatientStore } from '@/lib/store/patient-store';
import { useRecordingStore } from '@/lib/store/recording-store';
import { PatientHeader } from '@/components/patient/PatientHeader';
import { SOAPNoteDisplay } from '@/components/soap/SOAPNoteDisplay';
import { RecordButton } from '@/components/recording/RecordButton';
import { BottomNavigation } from '@/components/ui/bottom-navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PatientDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const patientId = params.id as string;
  
  const { patients, selectedPatient, selectPatient } = usePatientStore();
  const { 
    recordingStatus, 
    recordingDuration, 
    soapNote, 
    toggleRecording 
  } = useRecordingStore();

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
    await toggleRecording(selectedPatient.id);
  };

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
        <div className="flex justify-center">
          <RecordButton
            status={recordingStatus}
            onToggleRecording={handleToggleRecording}
            recordingDuration={recordingDuration}
          />
        </div>
      </div>

      <BottomNavigation activeTab="patient-detail" />
    </div>
  );
}
