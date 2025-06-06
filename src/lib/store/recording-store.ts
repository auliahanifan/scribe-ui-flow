
import { create } from 'zustand';
import { VisitSession, TranscriptSegment, SOAPNote } from '@/types';
import { mockTranscriptionService } from '@/lib/mock-services/transcription';
import { mockSOAPService } from '@/lib/mock-services/soap';
import { realAudioService } from '@/lib/services/real-audio-service';

// Use real audio service instead of mock
const audioService = realAudioService;

export interface SavedRecording {
  id: string;
  patientId: string;
  date: string;
  duration: number;
  url: string;
  title: string;
}

interface RecordingStore {
  currentSession: VisitSession | null;
  recordingStatus: 'idle' | 'recording' | 'processing';
  recordingDuration: number;
  transcript: TranscriptSegment[];
  soapNote: SOAPNote | null;
  savedRecordings: SavedRecording[];
  currentAudio: string | null;
  
  // Actions
  toggleRecording: (patientId: string) => Promise<void>;
  updateRecordingDuration: (duration: number) => void;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  generateSOAP: () => Promise<void>;
  resetSession: () => void;
  saveRecording: (patientId: string) => Promise<SavedRecording | null>;
  playRecording: (recordingId: string) => void;
  stopPlayback: () => void;
  getSavedRecordingsForPatient: (patientId: string) => SavedRecording[];
  persistRecordings: () => void;
}

// Helper function to load saved recordings from localStorage
const loadSavedRecordingsFromStorage = (): SavedRecording[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const savedData = localStorage.getItem('savedRecordings');
    if (savedData) {
      return JSON.parse(savedData);
    }
  } catch (error) {
    console.error('Error loading recordings from localStorage:', error);
  }
  return [];
};

// Helper function to save recordings to localStorage
const saveRecordingsToStorage = (recordings: SavedRecording[]) => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('savedRecordings', JSON.stringify(recordings));
  } catch (error) {
    console.error('Error saving recordings to localStorage:', error);
  }
};

export const useRecordingStore = create<RecordingStore>((set, get) => ({
  currentSession: null,
  recordingStatus: 'idle',
  recordingDuration: 0,
  transcript: [],
  soapNote: null,
  savedRecordings: loadSavedRecordingsFromStorage(),
  currentAudio: null,
  
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
      
      await audioService.toggleRecording();
      
    } else if (recordingStatus === 'recording') {
      // Stop recording
      set({ recordingStatus: 'idle' });
      
      // Stop transcription
      mockTranscriptionService.stopTranscription();
      await audioService.toggleRecording();
      
      // Auto-save the recording
      try {
        console.log('Auto-saving recording for patient:', patientId);
        const savedRecording = await get().saveRecording(patientId);
        if (savedRecording) {
          console.log('Recording auto-saved successfully:', savedRecording.id);
        }
      } catch (error) {
        console.error('Error auto-saving recording:', error);
      }
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
  },
  
  saveRecording: async (patientId: string) => {
    const { recordingDuration } = get();
    
    try {
      // Get the audio as base64 for persistent storage
      const audioBase64 = await audioService.getAudioBase64();
      
      if (!audioBase64) {
        console.error('No audio recording available to save');
        return null;
      }
      
      console.log('Audio recording length:', audioBase64.length, 'Patient ID:', patientId);
      
      // Create a saved recording with base64 data for storage
      const newRecording: SavedRecording = {
        id: crypto.randomUUID(),
        patientId,
        date: new Date().toISOString(),
        duration: recordingDuration,
        url: audioBase64, // Store the base64 data directly
        title: `Recording ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`
      };
      
      // Update store with new recording
      const updatedRecordings = [...get().savedRecordings, newRecording];
      set({ savedRecordings: updatedRecordings });
      
      // Log the total number of recordings in store
      console.log('Total recordings after save:', updatedRecordings.length);
      
      // Save to localStorage immediately
      saveRecordingsToStorage(updatedRecordings);
      console.log('Recordings saved to localStorage');
      
      // Add a verification step to ensure data was saved
      const verifyFromStorage = loadSavedRecordingsFromStorage();
      console.log('Verified recordings in localStorage:', verifyFromStorage.length);
      
      // Clear the current recording from the audio service to prepare for next recording
      audioService.clearRecording();
      
      return newRecording;
    } catch (error) {
      console.error('Error saving recording:', error);
      return null;
    }
  },
  
  playRecording: (recordingId: string) => {
    const { savedRecordings } = get();
    const recording = savedRecordings.find(r => r.id === recordingId);
    
    if (recording) {
      set({ currentAudio: recording.url });
    }
  },
  
  stopPlayback: () => {
    set({ currentAudio: null });
  },
  
  getSavedRecordingsForPatient: (patientId: string) => {
    const recordings = get().savedRecordings.filter(recording => recording.patientId === patientId);
    console.log(`Found ${recordings.length} recordings for patient ${patientId} out of ${get().savedRecordings.length} total`);
    return recordings;
  },
  
  // New method to persist the recordings to localStorage
  persistRecordings: () => {
    const { savedRecordings } = get();
    saveRecordingsToStorage(savedRecordings);
  }
}));
