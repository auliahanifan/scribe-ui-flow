
import { create } from 'zustand';
import { VisitSession, TranscriptSegment, SOAPNote } from '@/types';
import { mockTranscriptionService } from '@/lib/mock-services/transcription';
import { mockSOAPService } from '@/lib/mock-services/soap';
import { realAudioService } from '@/lib/services/real-audio-service';
import { deepgramService, TranscriptionResult } from '@/lib/services/deepgram-service';

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
  
  // Real-time transcription state
  finalTranscription: string;
  partialTranscription: string;
  connectionStatus: string;
  isStreaming: boolean;
  transcriptionSegments: Array<{
    transcript: string;
    speaker: number;
    timestamp: string;
    start?: number;
    end?: number;
    confidence: number;
  }>;
  
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
  
  // Real-time transcription actions
  updateTranscription: (result: TranscriptionResult) => void;
  updateConnectionStatus: (status: string) => void;
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
  
  // Real-time transcription state
  finalTranscription: '',
  partialTranscription: '',
  connectionStatus: 'Disconnected',
  isStreaming: false,
  transcriptionSegments: [],
  
  toggleRecording: async (patientId: string) => {
    const { recordingStatus } = get();
    
    if (recordingStatus === 'idle') {
      // Reset any previous session data first
      get().resetSession();
      
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
        soapNote: null,
        finalTranscription: '',
        partialTranscription: '',
        isStreaming: true,
        transcriptionSegments: []
      });
      
      try {
        // Start real-time transcription with Deepgram
        await deepgramService.startStreaming(
          (result: TranscriptionResult) => {
            get().updateTranscription(result);
          },
          (status: string) => {
            get().updateConnectionStatus(status);
          }
        );
        
        // Also start local audio recording
        await audioService.toggleRecording();
        
      } catch (error) {
        console.error('Error starting transcription:', error);
        // Fallback to mock transcription if Deepgram fails
        mockTranscriptionService.startTranscription((segment) => {
          const store = get();
          const newTranscript = [...store.transcript, segment];
          set({ transcript: newTranscript });
          
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
      }
      
    } else if (recordingStatus === 'recording') {
      // Stop recording
      set({ 
        recordingStatus: 'processing',
        isStreaming: false 
      });
      
      try {
        // Stop real-time transcription
        deepgramService.stopStreaming();
        
        // Stop local audio recording
        await audioService.toggleRecording();
        
        // Auto-save the recording
        console.log('Auto-saving recording for patient:', patientId);
        const savedRecording = await get().saveRecording(patientId);
        if (savedRecording) {
          console.log('Recording auto-saved successfully:', savedRecording.id);
        }
        
        // Auto-generate SOAP note if we have transcription
        const { finalTranscription } = get();
        if (finalTranscription && finalTranscription.trim().length > 0) {
          console.log('Auto-generating SOAP note from transcription...');
          await get().generateSOAP();
        }
        
        set({ recordingStatus: 'idle' });
        
      } catch (error) {
        console.error('Error stopping recording:', error);
        set({ recordingStatus: 'idle' });
      }
      
      // Stop fallback transcription
      mockTranscriptionService.stopTranscription();
    }
  },
  
  updateRecordingDuration: (duration) => set({ recordingDuration: duration }),
  
  addTranscriptSegment: (segment) => {
    set((state) => ({
      transcript: [...state.transcript, segment]
    }));
  },
  
  generateSOAP: async () => {
    const { finalTranscription, transcriptionSegments, currentSession } = get();
    
    if (!finalTranscription || finalTranscription.trim().length < 10) {
      console.warn('Insufficient transcription for SOAP generation');
      return;
    }
    
    // Create enhanced transcription with speaker labels for better SOAP generation
    let enhancedTranscription = finalTranscription;
    if (transcriptionSegments.length > 0) {
      enhancedTranscription = transcriptionSegments
        .map(segment => {
          const speaker = segment.speaker === 0 ? 'Doctor' : 'Patient';
          const timestamp = segment.start ? `[${Math.floor(segment.start/60)}:${String(Math.floor(segment.start%60)).padStart(2, '0')}] ` : '';
          return `${timestamp}${speaker}: ${segment.transcript}`;
        })
        .join('\n');
    }
    
    try {
      set({ recordingStatus: 'processing' });
      
      // Import the OpenRouter SOAP service
      const { openaiSOAPService } = await import('@/lib/services/openai-soap-service');
      
      // Get patient context if available
      let patientContext = undefined;
      if (currentSession) {
        // Try to get patient name from patient store
        const { usePatientStore } = await import('@/lib/store/patient-store');
        const patients = usePatientStore.getState().patients;
        const patient = patients.find(p => p.id === currentSession.patientId);
        
        patientContext = {
          id: currentSession.patientId,
          name: patient?.name || 'Patient',
          age: patient?.age
        };
      }
      
      // Generate SOAP note using OpenRouter with enhanced transcription
      const soapResponse = await openaiSOAPService.generateSOAP({
        transcription: enhancedTranscription,
        patientContext,
        visitType: 'General Consultation'
      });
      
      console.log('Enhanced transcription for SOAP:', enhancedTranscription);
      
      // Convert to the expected format
      const soapNote = {
        id: crypto.randomUUID(),
        patientId: currentSession?.patientId || '',
        visitDate: new Date().toISOString(),
        subjective: soapResponse.soapNote.subjective,
        objective: soapResponse.soapNote.objective,
        assessment: soapResponse.soapNote.assessment,
        plan: soapResponse.soapNote.plan,
        generatedAt: soapResponse.generatedAt,
        confidence: soapResponse.confidence
      };
      
      set({ soapNote });
      
      // Update current session
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
      
      console.log('SOAP note generated successfully');
      
      // Show success notification (we could add a toast system later)
      if (typeof window !== 'undefined') {
        console.log('🎉 SOAP note automatically generated from transcription!');
      }
      
    } catch (error) {
      console.error('Failed to generate SOAP note:', error);
    } finally {
      set({ recordingStatus: 'idle' });
    }
  },
  
  resetSession: () => {
    console.log('🔄 RESETTING session - clearing all data');
    set({
      currentSession: null,
      recordingStatus: 'idle',
      recordingDuration: 0,
      transcript: [],
      soapNote: null,
      finalTranscription: '',
      partialTranscription: '',
      connectionStatus: 'Disconnected',
      isStreaming: false,
      transcriptionSegments: []
    });
    console.log('✅ Session reset complete');
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
  },
  
  // Real-time transcription methods
  updateTranscription: (result: TranscriptionResult) => {
    console.log('🔥 STORE: Received NEW transcription update:', result);
    const currentState = get();
    console.log('📊 STORE: Current state before update:', {
      finalTranscription: currentState.finalTranscription,
      partialTranscription: currentState.partialTranscription,
      segmentsCount: currentState.transcriptionSegments.length
    });
    
    if (result.isFinal) {
      // Final transcription - add to segments and final text
      // Create timestamp
      const now = new Date();
      const timestamp = now.toISOString();
      
      // Determine speaker label
      const speakerLabel = result.speaker !== undefined ? result.speaker : 0;
      
      // Create segment
      const segment = {
        transcript: result.transcript,
        speaker: speakerLabel,
        timestamp,
        start: result.start,
        end: result.end,
        confidence: result.confidence
      };
      
      console.log('Adding final transcription segment:', segment);
      
      set((state) => ({
        finalTranscription: state.finalTranscription + ' ' + result.transcript,
        partialTranscription: '',
        transcriptionSegments: [...state.transcriptionSegments, segment]
      }));
    } else {
      // Interim result - update partial text with speaker info
      const speakerPrefix = result.speaker !== undefined ? `[Speaker ${result.speaker}] ` : '';
      console.log('Updating partial transcription:', speakerPrefix + result.transcript);
      set({ partialTranscription: speakerPrefix + result.transcript });
    }
  },
  
  updateConnectionStatus: (status: string) => {
    set({ connectionStatus: status });
  }
}));
