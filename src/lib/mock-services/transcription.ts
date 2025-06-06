
import { TranscriptSegment } from '@/types';

export class MockTranscriptionService {
  private onTranscriptCallback?: (segment: TranscriptSegment) => void;
  private timeoutIds: NodeJS.Timeout[] = [];
  
  startTranscription(onTranscript: (segment: TranscriptSegment) => void): void {
    this.onTranscriptCallback = onTranscript;
    this.simulateTranscription();
  }
  
  stopTranscription(): void {
    this.timeoutIds.forEach(id => clearTimeout(id));
    this.timeoutIds = [];
    this.onTranscriptCallback = undefined;
  }
  
  private simulateTranscription(): void {
    const mockConversation = [
      { speaker: 'doctor', text: 'Good morning! How are you feeling today?' },
      { speaker: 'patient', text: 'I\'ve been having some chest pain for the past few days.' },
      { speaker: 'doctor', text: 'Can you describe the pain? Is it sharp or dull?' },
      { speaker: 'patient', text: 'It\'s more of a sharp pain, especially when I take deep breaths.' },
      { speaker: 'doctor', text: 'I see. Any shortness of breath or dizziness?' },
      { speaker: 'patient', text: 'A little shortness of breath, but no dizziness.' },
      { speaker: 'doctor', text: 'Let me listen to your heart and lungs.' },
      { speaker: 'patient', text: 'Okay, thank you doctor.' },
      { speaker: 'doctor', text: 'Your heart sounds normal. Lungs are clear. I\'d like to run an EKG to be safe.' },
      { speaker: 'patient', text: 'That sounds good. I was worried it might be serious.' }
    ];
    
    mockConversation.forEach((item, index) => {
      const timeoutId = setTimeout(() => {
        this.onTranscriptCallback?.({
          id: `transcript-${index}`,
          text: item.text,
          speaker: item.speaker as 'doctor' | 'patient',
          timestamp: Date.now(),
          confidence: 0.95
        });
      }, index * 3000); // 3 second intervals
      
      this.timeoutIds.push(timeoutId);
    });
  }
}

export const mockTranscriptionService = new MockTranscriptionService();
