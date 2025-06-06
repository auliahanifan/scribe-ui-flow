import { useRecordingStore } from "./recordingStore";

// IMPORTANT: Replace with your actual Deepgram API Key
const DEEPGRAM_API_KEY = "c6c6637ddc6d78707f1564c3acfb40053b2de6d2";

const AUDIO_CONFIG = {
  sampleRate: 16000,
  channelCount: 1,
  // For browser-based MediaRecorder, these are the most widely supported formats
  mimeType: "audio/webm;codecs=opus",
  timeslice: 250, // ms for chunking (20-250ms recommended by Deepgram)
  // Deepgram WebSocket URL parameters
  model: "nova-2", // You can use "nova-2-medical" for medical context
  language: "en-US",
  encoding: "opus", // Must match the codec in mimeType
  punctuate: "true", // Fixed typo: was "puncutate"
  interim_results: "true",
  smart_format: "true",
  endpointing: "true", // Enable endpointing for better speech detection
  utterance_end_ms: "1000", // Time to wait before ending utterance
};

function getDeepgramWebSocketUrl(): string {
  const params = new URLSearchParams({
    model: AUDIO_CONFIG.model,
    language: AUDIO_CONFIG.language,
    encoding: AUDIO_CONFIG.encoding,
    sample_rate: AUDIO_CONFIG.sampleRate.toString(),
    channels: AUDIO_CONFIG.channelCount.toString(),
    punctuate: AUDIO_CONFIG.punctuate,
    interim_results: AUDIO_CONFIG.interim_results,
    smart_format: AUDIO_CONFIG.smart_format,
    endpointing: AUDIO_CONFIG.endpointing,
    utterance_end_ms: AUDIO_CONFIG.utterance_end_ms,
  });

  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}

export class AudioStreamer {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private websocket: WebSocket | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;

  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // Initial delay 1s
  private shouldReconnect: boolean = true;
  private isAuthenticated: boolean = false;

  constructor() {
    this.handleDataAvailable = this.handleDataAvailable.bind(this);
    this.handleWebSocketOpen = this.handleWebSocketOpen.bind(this);
    this.handleWebSocketMessage = this.handleWebSocketMessage.bind(this);
    this.handleWebSocketClose = this.handleWebSocketClose.bind(this);
    this.handleWebSocketError = this.handleWebSocketError.bind(this);
  }

  private async getMicrophoneAccess(): Promise<MediaStream | null> {
    const { setConnectionStatus } = useRecordingStore.getState();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("getUserMedia not supported on your browser!");
        setConnectionStatus("error_mic_unsupported");
        return null;
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: AUDIO_CONFIG.sampleRate,
          channelCount: AUDIO_CONFIG.channelCount,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      return this.mediaStream;
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setConnectionStatus("error_mic_permission");
      return null;
    }
  }

  private setupWebSocket() {
    const { setConnectionStatus } = useRecordingStore.getState();

    if (this.websocket && this.websocket.readyState < WebSocket.CLOSING) {
      console.log("WebSocket already open or connecting.");
      return;
    }

    const wsUrl = getDeepgramWebSocketUrl();
    console.log("Connecting to Deepgram WebSocket:", wsUrl);
    setConnectionStatus("connecting_ws");

    // For browser-based connections, use Sec-WebSocket-Protocol for authentication
    // This is the secure way to pass the API key from the browser
    this.websocket = new WebSocket(wsUrl, ["token", DEEPGRAM_API_KEY]);

    this.websocket.onopen = this.handleWebSocketOpen;
    this.websocket.onmessage = this.handleWebSocketMessage;
    this.websocket.onclose = this.handleWebSocketClose;
    this.websocket.onerror = this.handleWebSocketError;
  }

  private handleWebSocketOpen() {
    console.log("Deepgram WebSocket connection established.");
    const { setConnectionStatus, setStreaming } = useRecordingStore.getState();

    // No need to send authentication message - it's handled via Sec-WebSocket-Protocol
    setConnectionStatus("connected");
    setStreaming(true);
    this.isAuthenticated = true;

    // Reset reconnection attempts
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;

    // Start KeepAlive messages to maintain connection
    this.startKeepAlive();

    // Start MediaRecorder now that WebSocket is open
    if (this.mediaStream) {
      this.startMediaRecorder(this.mediaStream);
    }
  }

  private handleWebSocketMessage(event: MessageEvent) {
    const {
      setConnectionStatus,
      appendTranscription,
      setPartialTranscription,
    } = useRecordingStore.getState();

    try {
      const messageData = JSON.parse(event.data);

      // Handle different message types
      if (messageData.type === "Metadata") {
        console.log("Deepgram Metadata received:", messageData);
        return;
      }

      if (messageData.type === "Warning") {
        console.warn("Deepgram Warning:", messageData);
        return;
      }

      if (messageData.type === "Error" || messageData.error) {
        console.error("Deepgram Error:", messageData.error || messageData);
        setConnectionStatus("error_deepgram_api");

        // Handle specific error codes
        if (messageData.error?.code === "INVALID_AUTH") {
          this.stopStreaming(false); // Don't reconnect on auth errors
        }
        return;
      }

      // Handle transcription results
      if (messageData.type === "Results" && messageData.channel) {
        const channel = messageData.channel;

        if (channel.alternatives && channel.alternatives.length > 0) {
          const transcript = channel.alternatives[0].transcript;

          if (transcript && transcript.length > 0) {
            if (messageData.is_final) {
              // Final transcript - append to full transcription
              appendTranscription(transcript + " ");
              setPartialTranscription("");

              // Log if this is end of speech
              if (messageData.speech_final) {
                console.log("End of speech detected");
              }
            } else {
              // Interim transcript - update partial transcription
              setPartialTranscription(transcript);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing Deepgram message:", error);
    }
  }

  private handleWebSocketClose(event: CloseEvent) {
    console.log(
      "Deepgram WebSocket closed:",
      event.code,
      event.reason,
      "Clean:",
      event.wasClean
    );

    const { setConnectionStatus, setStreaming } = useRecordingStore.getState();

    this.stopKeepAlive();
    this.cleanupMediaRecorder();
    setStreaming(false);
    this.isAuthenticated = false;

    // Handle specific close codes
    if (event.code === 1008 && event.reason === "DATA-0000") {
      console.error("Deepgram couldn't decode audio data");
      setConnectionStatus("error_audio_format");
      return;
    }

    if (event.code === 1011 && event.reason === "NET-0001") {
      console.error("No audio received within timeout period");
      setConnectionStatus("error_no_audio");
      return;
    }

    // Attempt reconnection for transient errors
    if (
      this.shouldReconnect &&
      !event.wasClean &&
      this.reconnectAttempts < this.maxReconnectAttempts
    ) {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        30000
      );

      console.log(
        `Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${
          this.maxReconnectAttempts
        })`
      );
      setConnectionStatus(`reconnecting_attempt_${this.reconnectAttempts}`);

      setTimeout(() => {
        if (this.shouldReconnect) {
          this.setupWebSocket();
        }
      }, delay);
    } else {
      setConnectionStatus(
        event.wasClean ? "disconnected" : "error_connection_lost"
      );
    }
  }

  private handleWebSocketError(event: Event) {
    console.error("Deepgram WebSocket error:", event);
    const { setConnectionStatus, setStreaming } = useRecordingStore.getState();
    setConnectionStatus("error_websocket");
    setStreaming(false);
  }

  private startKeepAlive() {
    // Send KeepAlive messages every 8 seconds to prevent timeout
    this.keepAliveInterval = setInterval(() => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        const keepAliveMsg = JSON.stringify({ type: "KeepAlive" });
        this.websocket.send(keepAliveMsg);
        console.log("Sent KeepAlive message");
      }
    }, 8000);
  }

  private stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  private startMediaRecorder(stream: MediaStream) {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      console.log("MediaRecorder already active.");
      return;
    }

    try {
      // Check if the preferred mimeType is supported
      let options: MediaRecorderOptions = { mimeType: AUDIO_CONFIG.mimeType };

      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.warn(
          `${options.mimeType} not supported, trying alternatives...`
        );

        // Try alternative formats
        const alternatives = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/ogg;codecs=opus",
          "audio/ogg",
        ];

        const supported = alternatives.find((mime) =>
          MediaRecorder.isTypeSupported(mime)
        );

        if (!supported) {
          throw new Error("No supported audio format found");
        }

        console.log(`Using supported format: ${supported}`);
        options.mimeType = supported;

        // Update encoding parameter based on selected format
        // Note: This would require reconnecting with updated parameters
        console.warn(
          "Audio format mismatch may cause issues. Consider updating AUDIO_CONFIG."
        );
      }

      this.mediaRecorder = new MediaRecorder(stream, options);

      this.mediaRecorder.ondataavailable = this.handleDataAvailable;

      this.mediaRecorder.onstop = () => {
        console.log("MediaRecorder stopped.");
        // Send CloseStream message when recorder stops
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
          console.log("Sending CloseStream to Deepgram.");
          this.websocket.send(JSON.stringify({ type: "CloseStream" }));
        }
      };

      this.mediaRecorder.onerror = (event: Event) => {
        console.error("MediaRecorder error:", event);
        useRecordingStore.getState().setConnectionStatus("error_recorder");
        this.stopStreaming(true); // Attempt reconnect on recorder errors
      };

      this.mediaRecorder.start(AUDIO_CONFIG.timeslice);
      console.log(
        `MediaRecorder started with timeslice: ${AUDIO_CONFIG.timeslice}ms`
      );
    } catch (e) {
      console.error("Exception while creating MediaRecorder:", e);
      useRecordingStore
        .getState()
        .setConnectionStatus("error_recorder_unsupported");
      this.stopStreaming(false);
    }
  }

  private handleDataAvailable(event: BlobEvent) {
    if (
      event.data &&
      event.data.size > 0 &&
      this.websocket &&
      this.websocket.readyState === WebSocket.OPEN &&
      this.isAuthenticated
    ) {
      // Send audio data as binary WebSocket message
      this.websocket.send(event.data);
    } else if (event.data && event.data.size === 0) {
      console.warn("Received empty audio data blob");
    }
  }

  private cleanupMediaRecorder() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      console.log("Stopping MediaRecorder...");
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;
  }

  private cleanupMediaStream() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  private cleanupWebSocket(graceful: boolean = true) {
    this.stopKeepAlive();

    if (this.websocket) {
      if (this.websocket.readyState === WebSocket.OPEN) {
        if (graceful) {
          // Send CloseStream message before closing
          console.log("Sending CloseStream message...");
          this.websocket.send(JSON.stringify({ type: "CloseStream" }));
          console.log("Closing WebSocket connection gracefully...");
          this.websocket.close(1000, "Client initiated disconnect");
        } else {
          console.log("Terminating WebSocket connection...");
          this.websocket.close(1001, "Going away");
        }
      } else if (this.websocket.readyState === WebSocket.CONNECTING) {
        console.log("Aborting pending WebSocket connection...");
        this.websocket.close();
      }

      // Clear event handlers
      this.websocket.onopen = null;
      this.websocket.onmessage = null;
      this.websocket.onclose = null;
      this.websocket.onerror = null;
      this.websocket = null;
    }
  }

  public async startStreaming(): Promise<void> {
    const { startRecording, setConnectionStatus } =
      useRecordingStore.getState();

    console.log("Starting audio streaming to Deepgram...");
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;

    startRecording(); // Updates store state

    const stream = await this.getMicrophoneAccess();
    if (!stream) {
      console.error("Failed to get microphone access.");
      useRecordingStore.getState().stopRecording();
      return;
    }

    this.setupWebSocket();
  }

  public stopStreaming(allowReconnect: boolean = false): void {
    const { stopRecording } = useRecordingStore.getState();

    console.log("Stopping audio streaming...");
    this.shouldReconnect = allowReconnect;

    // Clean up in order
    this.cleanupMediaRecorder();
    this.cleanupWebSocket(true);
    this.cleanupMediaStream();

    stopRecording();
    console.log("Audio streaming stopped.");
  }
}
