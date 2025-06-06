interface DeepgramConfig {
  apiKey: string;
  language?: string;
  model?: string;
  smartFormat?: boolean;
  punctuate?: boolean;
  interimResults?: boolean;
  sampleRate?: number;
}

interface MediaRecorderOptions {
  mimeType?: string;
  audioBitsPerSecond?: number;
}

interface TranscriptionResult {
  transcript: string;
  confidence: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
    speaker?: number;
  }>;
  isFinal: boolean;
  speaker?: number;
  start?: number;
  end?: number;
}

interface DeepgramResponse {
  channel: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
      words?: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
        speaker?: number;
      }>;
    }>;
  };
  is_final: boolean;
  start?: number;
  duration?: number;
  speaker?: number;
}

class DeepgramStreamingService {
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private config: DeepgramConfig;
  private onTranscriptionCallback: ((result: TranscriptionResult) => void) | null = null;
  private onConnectionStatusCallback: ((status: string) => void) | null = null;
  private isStreaming = false;

  constructor(config: DeepgramConfig) {
    this.config = {
      language: 'en-US',
      model: 'general',
      smartFormat: true,
      punctuate: true,
      interimResults: true,
      sampleRate: 16000,
      ...config
    };
  }

  async startStreaming(
    onTranscription: (result: TranscriptionResult) => void,
    onConnectionStatus?: (status: string) => void
  ): Promise<void> {
    if (this.isStreaming) {
      throw new Error('Already streaming');
    }

    this.onTranscriptionCallback = onTranscription;
    this.onConnectionStatusCallback = onConnectionStatus;

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // Set up Deepgram WebSocket connection
      await this.connectToDeepgram();

      // Set up MediaRecorder for streaming
      this.setupMediaRecorder(stream);

      this.isStreaming = true;
      
      console.log('✅ Deepgram streaming started - ready for LIVE transcription');
      
      // Test if callback is working immediately
      if (this.onTranscriptionCallback) {
        console.log('🧪 Testing transcription callback...');
        setTimeout(() => {
          if (this.onTranscriptionCallback && this.isStreaming) {
            this.onTranscriptionCallback({
              transcript: 'LIVE SESSION TEST - This should appear immediately',
              confidence: 1.0,
              isFinal: true,
              speaker: 0,
              start: 0.1,
              end: 2.0
            });
          }
        }, 1000);
      } else {
        console.error('❌ No transcription callback available at startup!');
      }
      
    } catch (error) {
      console.error('Error starting streaming:', error);
      this.notifyConnectionStatus('Connection Failed');
      throw error;
    }
  }

  private async connectToDeepgram(): Promise<void> {
    // Validate API key
    if (!this.config.apiKey) {
      throw new Error('Valid Deepgram API key is required');
    }

    const params = new URLSearchParams({
      language: this.config.language!,
      model: 'nova-2', // Use the working model
      smart_format: this.config.smartFormat!.toString(),
      punctuate: this.config.punctuate!.toString(),
      interim_results: this.config.interimResults!.toString(),
      encoding: 'opus', // Use opus encoding for WebM audio
      channels: '1',
      endpointing: 'true',
      utterance_end_ms: '1000',
      diarize: 'true',
      timestamps: 'true'
    });

    const wsUrl = `wss://api.deepgram.com/v1/listen?${params}`;
    console.log('Connecting to Deepgram WebSocket:', wsUrl);
    
    this.notifyConnectionStatus('Connecting...');
    
    this.ws = new WebSocket(wsUrl, ['token', this.config.apiKey]);

    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not initialized'));
        return;
      }

      this.ws.onopen = () => {
        console.log('Deepgram WebSocket connected successfully');
        this.notifyConnectionStatus('Connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data: DeepgramResponse = JSON.parse(event.data);
          console.log('📥 Raw Deepgram response:', data);
          
          if (data.channel?.alternatives?.[0]) {
            const alternative = data.channel.alternatives[0];
            
            // Only process if there's actual transcript content
            if (alternative.transcript && alternative.transcript.trim().length > 0) {
              const result: TranscriptionResult = {
                transcript: alternative.transcript,
                confidence: alternative.confidence,
                words: alternative.words,
                isFinal: data.is_final,
                speaker: data.speaker,
                start: data.start,
                end: data.start && data.duration ? data.start + data.duration : undefined
              };

              console.log('🎯 LIVE transcription result:', result);

              if (this.onTranscriptionCallback) {
                this.onTranscriptionCallback(result);
              } else {
                console.warn('⚠️ No transcription callback available');
              }
            } else {
              console.log('📝 Empty transcript from Deepgram (normal for silence)');
            }
          } else {
            console.log('📦 Deepgram metadata or keepalive message');
          }
        } catch (error) {
          console.error('❌ Error parsing Deepgram response:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('Deepgram WebSocket error:', error);
        this.notifyConnectionStatus('Connection Error');
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = (event) => {
        console.log('❌ Deepgram WebSocket closed', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        
        // Add specific error messages based on close codes
        let statusMessage = 'Connection Lost';
        switch (event.code) {
          case 1000:
            statusMessage = 'Disconnected';
            console.log('✅ Normal WebSocket closure');
            break;
          case 1006:
            console.error('❌ WebSocket closed abnormally - possible network issue');
            break;
          case 1011:
            console.error('❌ WebSocket closed due to server error - check API key/parameters');
            break;
          case 1003:
            console.error('❌ WebSocket closed due to unsupported data format');
            break;
          default:
            console.error(`❌ WebSocket closed with code ${event.code}: ${event.reason}`);
        }
        
        this.notifyConnectionStatus(statusMessage);
      };
    });
  }

  private setupMediaRecorder(stream: MediaStream): void {
    // Try different MIME types based on browser support
    let options: MediaRecorderOptions;
    
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000
      };
      console.log('Using WebM with Opus codec');
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      options = {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 16000
      };
      console.log('Using WebM without specific codec');
    } else {
      // Fallback to default
      options = {};
      console.log('Using default MediaRecorder options');
    }

    this.mediaRecorder = new MediaRecorder(stream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('🎤 Sending audio to Deepgram, size:', event.data.size, 'bytes');
        // Send audio blob directly to Deepgram (no conversion needed for opus)
        this.ws.send(event.data);
        console.log('📡 Audio chunk sent to Deepgram:', event.data.size, 'bytes');
      } else {
        console.warn('⚠️ Cannot send audio - WebSocket not ready or no audio data');
      }
    };

    // Add MediaRecorder event listeners for debugging
    this.mediaRecorder.onstart = () => {
      console.log('🎬 MediaRecorder started successfully');
    };
    
    this.mediaRecorder.onerror = (error) => {
      console.error('❌ MediaRecorder error:', error);
    };
    
    this.mediaRecorder.onstop = () => {
      console.log('🛑 MediaRecorder stopped');
    };
    
    // Start recording with small time slices for real-time streaming
    console.log('🎯 Starting MediaRecorder with 250ms chunks...');
    this.mediaRecorder.start(250); // 250ms chunks
    this.notifyConnectionStatus('Transcribing...');
  }

  stopStreaming(): void {
    if (!this.isStreaming) {
      return;
    }

    try {
      // Stop media recorder
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }

      // Close WebSocket connection
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }

      this.isStreaming = false;
      this.notifyConnectionStatus('Stopped');
      
    } catch (error) {
      console.error('Error stopping streaming:', error);
    } finally {
      this.cleanup();
    }
  }

  private cleanup(): void {
    this.ws = null;
    this.mediaRecorder = null;
    this.onTranscriptionCallback = null;
    this.onConnectionStatusCallback = null;
    this.isStreaming = false;
  }

  private notifyConnectionStatus(status: string): void {
    if (this.onConnectionStatusCallback) {
      this.onConnectionStatusCallback(status);
    }
  }

  getConnectionStatus(): string {
    if (!this.isStreaming) return 'Disconnected';
    if (this.ws?.readyState === WebSocket.CONNECTING) return 'Connecting...';
    if (this.ws?.readyState === WebSocket.OPEN) return 'Connected';
    return 'Connection Error';
  }

  isCurrentlyStreaming(): boolean {
    return this.isStreaming;
  }
}

// Create a singleton instance with environment configuration
const createDeepgramService = () => {
  const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY || '';
  
  console.log('Deepgram API Key loaded:', apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT SET');
  
  if (!apiKey) {
    console.warn('Deepgram API key not found. Please set VITE_DEEPGRAM_API_KEY environment variable.');
  }

  return new DeepgramStreamingService({
    apiKey,
    language: 'en-US',
    model: 'general', // Could be 'medical' if available
    smartFormat: true,
    punctuate: true,
    interimResults: true,
    sampleRate: 16000
  });
};

export const deepgramService = createDeepgramService();
export type { TranscriptionResult, DeepgramConfig };