
import { SOAPNote, TranscriptSegment } from '@/types';

export class MockSOAPService {
  async generateSOAP(transcript: TranscriptSegment[]): Promise<SOAPNote> {
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return {
      subjective: `Patient reports chest pain lasting 3 days, describes as sharp, intermittent pain that worsens with deep inspiration. Denies fever, nausea, or vomiting. Reports mild shortness of breath but no dizziness or syncope. No prior cardiac history.`,
      
      objective: `Vital signs: T 98.6°F, HR 72 bpm, BP 120/80 mmHg, RR 16, O2 sat 98% on room air. Patient appears comfortable, in no acute distress. Cardiovascular: Regular rate and rhythm, no murmurs, rubs, or gallops. Pulmonary: Clear to auscultation bilaterally, no wheezes or rales. No chest wall tenderness on palpation.`,
      
      assessment: `Chest pain, likely musculoskeletal in origin given pleuritic nature and normal cardiac exam. Differential includes costochondritis, muscle strain, or atypical presentation of cardiac condition. Low probability for cardiac etiology given age and presentation, but warrants further evaluation.`,
      
      plan: `1. EKG to rule out cardiac abnormalities\n2. Chest X-ray to evaluate lung fields\n3. Basic metabolic panel and troponin levels\n4. NSAIDs for pain management\n5. Return precautions for worsening symptoms\n6. Follow-up in 1 week or sooner if symptoms persist\n7. Avoid strenuous activity until cleared`,
      
      generatedAt: new Date().toISOString()
    };
  }
}

export const mockSOAPService = new MockSOAPService();
