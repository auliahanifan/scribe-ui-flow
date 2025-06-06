
export class MockAudioService {
  private isRecording = false;
  private startTime: number = 0;
  private recordingCallbacks: Array<(status: 'idle' | 'recording' | 'processing') => void> = [];
  
  async toggleRecording(): Promise<'started' | 'stopped'> {
    if (!this.isRecording) {
      return this.startRecording();
    } else {
      return this.stopRecording();
    }
  }
  
  private async startRecording(): Promise<'started'> {
    // Simulate microphone access delay
    await new Promise(resolve => setTimeout(resolve, 500));
    this.isRecording = true;
    this.startTime = Date.now();
    this.notifyCallbacks('recording');
    return 'started';
  }
  
  private async stopRecording(): Promise<'stopped'> {
    this.isRecording = false;
    this.notifyCallbacks('processing');
    
    // Simulate processing time
    setTimeout(() => {
      this.notifyCallbacks('idle');
    }, 2000);
    
    return 'stopped';
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
}

export const mockAudioService = new MockAudioService();
