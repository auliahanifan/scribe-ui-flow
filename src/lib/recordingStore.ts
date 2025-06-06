import { create } from 'zustand';
import { type SOAPNote } from '@/types'; // Import the specific SOAPNote type

// type SoapNote = object | null; // Remove or comment out the old generic type

interface RecordingState {
  isRecording: boolean;
  isStreaming: boolean;
  transcriptionText: string;
  partialTranscription: string;
  isGeneratingSOAP: boolean;
  soapNote: SOAPNote | null; // Use the imported SOAPNote type, allowing null
  connectionStatus: string; // e.g., 'disconnected', 'connecting', 'connected', 'error'

  // Actions
  startRecording: () => void;
  stopRecording: () => void;
  setStreaming: (isStreaming: boolean) => void;
  setConnectionStatus: (status: string) => void;
  appendTranscription: (text: string) => void;
  setPartialTranscription: (text: string) => void;
  startGeneratingSOAP: () => void;
  setSoapNote: (note: SOAPNote | null) => void;
  failGeneratingSOAP: () => void;
  resetRecordingState: () => void;
}

const initialState = {
  isRecording: false,
  isStreaming: false,
  transcriptionText: '',
  partialTranscription: '',
  isGeneratingSOAP: false,
  soapNote: null,
  connectionStatus: 'disconnected',
};

export const useRecordingStore = create<RecordingState>((set) => ({
  ...initialState,

  startRecording: () => set({
    isRecording: true,
    transcriptionText: '', // Reset transcription on new recording
    partialTranscription: '',
    soapNote: null, // Reset SOAP note on new recording
    isGeneratingSOAP: false,
    connectionStatus: 'connecting', // Initial status when starting
    // isStreaming will typically be set by the audio streamer based on actual connection events
  }),

  stopRecording: () => set({
    isRecording: false,
    isStreaming: false, // Assume streaming stops when recording stops
    partialTranscription: '', // Clear any lingering partial transcription
    // connectionStatus might be set to 'disconnected' by the streamer later
  }),

  setStreaming: (isStreaming: boolean) => set({ isStreaming }),

  setConnectionStatus: (status: string) => set({ connectionStatus: status }),

  appendTranscription: (text: string) => set(state => ({
    transcriptionText: state.transcriptionText + text,
    partialTranscription: '', // Clear partial once it's appended as final
  })),

  setPartialTranscription: (text: string) => set({ partialTranscription: text }),

  startGeneratingSOAP: () => set({ isGeneratingSOAP: true, soapNote: null }),

  setSoapNote: (note: SOAPNote | null) => set({ soapNote: note, isGeneratingSOAP: false }),

  failGeneratingSOAP: () => set({ isGeneratingSOAP: false }),

  resetRecordingState: () => set(initialState),
}));

// Example of how audioStreamer.ts might interact with this store:
// import { useRecordingStore } from './recordingStore'; // Adjust path as needed
// 
// // Inside your audioStreamer logic:
// // on partial transcription update:
// // useRecordingStore.getState().setPartialTranscription(newPartialText);
// 
// // on final transcription segment:
// // useRecordingStore.getState().appendTranscription(finalSegmentText);
// 
// // on connection established:
// // useRecordingStore.getState().setConnectionStatus('connected');
// // useRecordingStore.getState().setStreaming(true);
// 
// // on disconnection:
// // useRecordingStore.getState().setConnectionStatus('disconnected');
// // useRecordingStore.getState().setStreaming(false);
// 
// // on error:
// // useRecordingStore.getState().setConnectionStatus('error');
// // useRecordingStore.getState().setStreaming(false);
