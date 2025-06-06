// Real implementation of audio recording using MediaRecorder API
export class RealAudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private stream: MediaStream | null = null;
  private startTime: number = 0;
  private recordingCallbacks: Array<(status: 'idle' | 'recording' | 'processing') => void> = [];
  
  constructor() {
    // Initialize with empty chunks
    this.reset();
  }
  
  private reset(): void {
    this.audioChunks = [];
    this.mediaRecorder = null;
    this.stream = null;
  }
  
  async toggleRecording(): Promise<'started' | 'stopped'> {
    if (!this.isRecording) {
      return this.startRecording();
    } else {
      return this.stopRecording();
    }
  }
  
  private async startRecording(): Promise<'started'> {
    try {
      // Clear previous chunks when starting a new recording
      this.audioChunks = [];
      
      // Request microphone permission
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create media recorder with audio/webm MIME type
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      console.log('Starting recording with MediaRecorder');
      
      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`Received audio chunk of size ${event.data.size}`);
          this.audioChunks.push(event.data);
        } else {
          console.log('Received empty audio chunk');
        }
      };
      
      // Start recording
      this.mediaRecorder.start(500); // Collect data more frequently (every 500ms)
      this.isRecording = true;
      this.startTime = Date.now();
      this.notifyCallbacks('recording');
      
      return 'started';
    } catch (error) {
      console.error('Error starting recording:', error);
      this.notifyCallbacks('idle');
      throw error;
    }
  }
  
  private async stopRecording(): Promise<'stopped'> {
    if (!this.mediaRecorder) {
      return 'stopped';
    }
    
    return new Promise((resolve) => {
      if (this.mediaRecorder) {
        this.notifyCallbacks('processing');
        
        // Set up onstop event handler
        this.mediaRecorder.onstop = () => {
          // Make sure we've collected all audio chunks
          console.log(`Recording stopped with ${this.audioChunks.length} audio chunks`);
          
          // Stop all tracks in the stream
          if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
          }
          
          this.isRecording = false;
          this.notifyCallbacks('idle');
          resolve('stopped');
        };
        
        // Stop recording and wait for final dataavailable event
        this.mediaRecorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0) {
            console.log(`Got final audio chunk of size ${event.data.size}`);
            this.audioChunks.push(event.data);
          }
        }, { once: true });
        
        // Stop recording
        this.mediaRecorder.stop();
      } else {
        this.notifyCallbacks('idle');
        resolve('stopped');
      }
    });
  }
  
  getRecordingTime(): number {
    return this.isRecording ? Date.now() - this.startTime : 0;
  }
  
  onStatusChange(callback: (status: 'idle' | 'recording' | 'processing') => void): void {
    this.recordingCallbacks.push(callback);
  }
  
  private notifyCallbacks(status: 'idle' | 'recording' | 'processing'): void {
    this.recordingCallbacks.forEach(callback => callback(status));
  }
  
  getAudioBlob(): Blob | null {
    if (this.audioChunks.length === 0) {
      return null;
    }
    
    return new Blob(this.audioChunks, { type: 'audio/webm' });
  }
  
  getAudioUrl(): string | null {
    const blob = this.getAudioBlob();
    if (!blob) {
      return null;
    }
    
    return URL.createObjectURL(blob);
  }
  
  async getAudioBase64(): Promise<string | null> {
    const blob = this.getAudioBlob();
    if (!blob) {
      return null;
    }
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        resolve(base64data);
      };
      reader.readAsDataURL(blob);
    });
  }
  
  static async blobFromBase64(base64: string): Promise<Blob> {
    // Convert the base64 back to a Blob
    const response = await fetch(base64);
    return await response.blob();
  }
  
  clearRecording(): void {
    this.audioChunks = [];
  }
}

export const realAudioService = new RealAudioService();
