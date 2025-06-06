
import { create } from 'zustand';
import { VisitSession, TranscriptSegment, SOAPNote } from '@/types';
import { mockAudioService } from '@/lib/mock-services/audio';
import { mockTranscriptionService } from '@/lib/mock-services/transcription';
import { mockSOAPService } from '@/lib/mock-services/soap';

interface RecordingStore {
  currentSession: VisitSession | null;
  recordingStatus: 'idle' | 'recording' | 'processing';
  recordingDuration: number;
  transcript: TranscriptSegment[];
  soapNote: SOAPNote | null;
  
  // Actions
  toggleRecording: (patientId: string) => Promise<void>;
  updateRecordingDuration: (duration: number) => void;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  generateSOAP: () => Promise<void>;
  resetSession: () => void;
}

export const useRecordingStore = create<RecordingStore>((set, get) => ({
  currentSession: null,
  recordingStatus: 'idle',
  recordingDuration: 0,
  transcript: [],
  soapNote: null,
  
  toggleRecording: async (patientId: string) => {
    const { recordingStatus } = get();
    
    if (recordingStatus === 'idle') {
      // Start recording
      const newSession: VisitSession = {
        id: crypto.randomUUID(),
        patientId,
        startTime: new Date().toISOString(),
        transcript: [],
        status: 'recording'
      };
      
      set({ 
        recordingStatus: 'recording',
        currentSession: newSession,
        transcript: [],
        soapNote: null
      });
      
      // Start mock transcription
      mockTranscriptionService.startTranscription((segment) => {
        const store = get();
        const newTranscript = [...store.transcript, segment];
        set({ transcript: newTranscript });
        
        // Update current session
        if (store.currentSession) {
          set({
            currentSession: {
              ...store.currentSession,
              transcript: newTranscript
            }
          });
        }
      });
      
      await mockAudioService.toggleRecording();
      
    } else if (recordingStatus === 'recording') {
      // Stop recording and process
      set({ recordingStatus: 'processing' });
      
      // Stop transcription
      mockTranscriptionService.stopTranscription();
      await mockAudioService.toggleRecording();
      
      // Generate SOAP note
      await get().generateSOAP();
      
      set({ 
        recordingStatus: 'idle',
        recordingDuration: 0
      });
    }
  },
  
  updateRecordingDuration: (duration) => set({ recordingDuration: duration }),
  
  addTranscriptSegment: (segment) => {
    set((state) => ({
      transcript: [...state.transcript, segment]
    }));
  },
  
  generateSOAP: async () => {
    const { transcript } = get();
    
    try {
      const soapNote = await mockSOAPService.generateSOAP(transcript);
      set({ soapNote });
      
      // Update current session
      const currentSession = get().currentSession;
      if (currentSession) {
        set({
          currentSession: {
            ...currentSession,
            soapNote,
            status: 'completed',
            endTime: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error('Failed to generate SOAP note:', error);
    }
  },
  
  resetSession: () => {
    set({
      currentSession: null,
      recordingStatus: 'idle',
      recordingDuration: 0,
      transcript: [],
      soapNote: null
    });
  }
}));
