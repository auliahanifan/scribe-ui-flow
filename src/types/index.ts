
export interface Patient {
  id: string;
  name: string;
  age: number;
  appointmentTime: string;
  status: 'waiting' | 'in-progress' | 'completed';
  lastVisit?: string;
  avatar?: string;
  phone?: string;
  email?: string;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  speaker: 'doctor' | 'patient';
  timestamp: number;
  confidence: number;
}

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  generatedAt: string;
}

export interface VisitSession {
  id: string;
  patientId: string;
  startTime: string;
  endTime?: string;
  transcript: TranscriptSegment[];
  soapNote?: SOAPNote;
  status: 'idle' | 'recording' | 'processing' | 'completed';
  duration?: number;
}
