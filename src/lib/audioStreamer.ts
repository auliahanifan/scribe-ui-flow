import { useRecordingStore } from "./recordingStore";

// IMPORTANT: Replace with your actual Deepgram API Key
const DEEPGRAM_API_KEY = "d3fdd5e622cdc03c368bad9551c8121ff685c6bd";

const AUDIO_CONFIG = {
  sampleRate: 16000,
  channelCount: 1,
  // Deepgram expects audio/opus if using opus, or you can send PCM (audio/l16) directly.
  // For MediaRecorder, 'audio/webm;codecs=opus' or 'audio/ogg;codecs=opus' are common for Opus.
  // Ensure your Deepgram settings match the encoding.
  mimeType: "audio/webm;codecs=opus",
  timeslice: 250, // ms for chunking
  // Deepgram WebSocket URL parameters
  // model: 'nova-2', // Or your preferred model
  model: "nova-2-medical", // Using medical model as per project context
  language: "en-US",
  encoding: "opus", // This should match the codec in mimeType
  puncutate: "true",
  interim_results: "true",
  smart_format: "true", // Recommended for better transcript accuracy
  // diarize: 'true', // Enable if speaker diarization is needed
};

function getDeepgramWebSocketUrl() {
  let url = `wss://api.deepgram.com/v1/listen?model=${AUDIO_CONFIG.model}&language=${AUDIO_CONFIG.language}`;
  url += `&encoding=${AUDIO_CONFIG.encoding}&sample_rate=${AUDIO_CONFIG.sampleRate}&channels=${AUDIO_CONFIG.channelCount}`;
  url += `&punctuate=${AUDIO_CONFIG.puncutate}&interim_results=${AUDIO_CONFIG.interim_results}`;
  url += `&smart_format=${AUDIO_CONFIG.smart_format}`;
  // if (AUDIO_CONFIG.diarize) url += `&diarize=${AUDIO_CONFIG.diarize}`;
  // For API key authentication via query param (less secure, but an option if header auth is complex for client WebSocket)
  // url += `&token=${DEEPGRAM_API_KEY}`;
  return url;
}

export class AudioStreamer {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private websocket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;

  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // Initial delay 1s
  private shouldReconnect: boolean = true;

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
          // Potentially add noiseSuppression, echoCancellation if needed, but test performance
          // noiseSuppression: true,
          // echoCancellation: true,
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
    /*
    if (DEEPGRAM_API_KEY === "YOUR_DEEPGRAM_API_KEY") {
      console.error(
        "DEEPGRAM_API_KEY is not set. Please update it in audioStreamer.ts"
      );
      setConnectionStatus("error_config_api_key");
      return;
    } */

    const wsUrl = getDeepgramWebSocketUrl();
    console.log("Connecting to Deepgram WebSocket:", wsUrl);
    setConnectionStatus("connecting_ws");
    this.websocket = new WebSocket(wsUrl);
    // Deepgram expects binary data (audio)
    // this.websocket.binaryType = 'arraybuffer'; // Default is blob, which is fine

    this.websocket.onopen = this.handleWebSocketOpen;
    this.websocket.onmessage = this.handleWebSocketMessage;
    this.websocket.onclose = this.handleWebSocketClose;
    this.websocket.onerror = this.handleWebSocketError;
  }

  private handleWebSocketOpen() {
    console.log("Deepgram WebSocket connection established.");
    useRecordingStore.getState().setConnectionStatus("authenticating");

    // Send API Key for authentication as the first message
    // This is one way Deepgram supports auth if not using headers/tokens in URL
    this.websocket?.send(
      JSON.stringify({
        type: "Authenticate",
        api_key: DEEPGRAM_API_KEY,
      })
    );

    // The actual 'connected' status and streaming=true will be set upon successful auth
    // or if Deepgram sends a ready message. For now, we assume auth message is enough to proceed.
    // Deepgram typically starts sending messages (like Metadata) upon successful connection and auth.

    this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    this.reconnectDelay = 1000; // Reset reconnect delay

    // Start MediaRecorder now that WebSocket is open and auth message sent
    if (this.mediaStream) {
      this.startMediaRecorder(this.mediaStream);
    }
  }

  private handleWebSocketMessage(event: MessageEvent) {
    const {
      setConnectionStatus,
      setStreaming,
      appendTranscription,
      setPartialTranscription,
    } = useRecordingStore.getState();
    try {
      const messageData = JSON.parse(event.data as string);
      // console.log('DG Message:', messageData);

      if (messageData.type === "Metadata") {
        console.log("Deepgram Metadata:", messageData);
        setConnectionStatus("connected"); // Consider fully connected after receiving metadata
        setStreaming(true);
        return;
      }

      if (messageData.type === "Error" || messageData.error) {
        console.error(
          "Deepgram Error:",
          messageData.error || messageData.reason
        );
        setConnectionStatus("error_deepgram_api");
        // Potentially stop streaming or attempt to handle specific errors
        this.stopStreaming(false); // Don't attempt reconnect on API errors like bad auth
        return;
      }

      if (
        messageData.channel &&
        messageData.channel.alternatives &&
        messageData.channel.alternatives.length > 0
      ) {
        const transcript = messageData.channel.alternatives[0].transcript;
        if (transcript && transcript.length > 0) {
          if (messageData.is_final) {
            // If speech_final is true, it's the absolute end of a phrase/sentence segment.
            // If is_final is true but speech_final is false, it might be a word-final result.
            // For simplicity, we'll append if is_final is true.
            appendTranscription(transcript + " ");
            setPartialTranscription(""); // Clear partial transcription
          } else {
            setPartialTranscription(transcript);
          }
        }
      }
    } catch (error) {
      console.error("Error processing message from Deepgram:", error);
    }
  }

  private handleWebSocketClose(event: CloseEvent) {
    console.log(
      "Deepgram WebSocket connection closed:",
      event.code,
      event.reason,
      "Was clean:",
      event.wasClean
    );
    const { setConnectionStatus, setStreaming } = useRecordingStore.getState();
    this.cleanupMediaRecorder(); // Stop recorder if WS closes
    setStreaming(false);

    if (
      this.shouldReconnect &&
      !event.wasClean &&
      this.reconnectAttempts < this.maxReconnectAttempts
    ) {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        30000
      ); // Exponential backoff up to 30s
      console.log(
        `Attempting to reconnect in ${delay / 1000}s (attempt ${
          this.reconnectAttempts
        }/${this.maxReconnectAttempts})`
      );
      setConnectionStatus(`reconnecting_attempt_${this.reconnectAttempts}`);
      setTimeout(() => {
        if (this.shouldReconnect) {
          // Check again in case stopStreaming was called
          this.setupWebSocket();
        }
      }, delay);
      this.reconnectDelay = delay; // Update for next potential cycle if this one fails early
    } else {
      setConnectionStatus(
        event.wasClean ? "disconnected" : "error_connection_lost"
      );
      if (!event.wasClean) {
        console.error(
          "WebSocket disconnected unexpectedly and max reconnect attempts reached or reconnect disabled."
        );
      }
      this.shouldReconnect = true; // Reset for next manual start
    }
  }

  private handleWebSocketError(event: Event) {
    console.error("Deepgram WebSocket error:", event);
    // handleWebSocketClose will usually be called after an error, so it will handle reconnection.
    // However, if onclose is not triggered, we ensure state is updated.
    const { setConnectionStatus, setStreaming } = useRecordingStore.getState();
    setConnectionStatus("error_websocket");
    setStreaming(false);
    // No need to call cleanupMediaRecorder here as onclose should handle it.
    // If onclose is not reliably called after onerror, then add cleanup here too.
  }

  private startMediaRecorder(stream: MediaStream) {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      console.log("MediaRecorder already active.");
      return;
    }
    try {
      const options = { mimeType: AUDIO_CONFIG.mimeType }; // audioBitsPerSecond can be omitted for Opus
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.error(
          `${options.mimeType} is not Supported by MediaRecorder! Check browser compatibility.`
        );
        // Try a more common fallback like 'audio/webm' if opus isn't directly supported in webm container
        // Or, if Deepgram supports it, consider sending raw PCM (requires different setup)
        useRecordingStore
          .getState()
          .setConnectionStatus("error_recorder_mime_unsupported");
        this.stopStreaming(false); // Stop if critical feature unsupported
        return;
      }
      this.mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
      console.error("Exception while creating MediaRecorder:", e);
      useRecordingStore
        .getState()
        .setConnectionStatus("error_recorder_unsupported");
      this.stopStreaming(false);
      return;
    }

    this.mediaRecorder.ondataavailable = this.handleDataAvailable;
    this.mediaRecorder.onstop = () => {
      console.log("MediaRecorder stopped.");
      // If WebSocket is still open, send CloseStream message
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        console.log("Sending CloseStream to Deepgram.");
        this.websocket.send(JSON.stringify({ type: "CloseStream" }));
      }
    };
    this.mediaRecorder.onerror = (event: Event) => {
      console.error("MediaRecorder error:", event);
      useRecordingStore.getState().setConnectionStatus("error_recorder");
      this.stopStreaming(true); // Attempt reconnect if recorder fails mid-stream
    };

    this.mediaRecorder.start(AUDIO_CONFIG.timeslice);
    console.log(
      "MediaRecorder started, streaming to Deepgram. Timeslice:",
      AUDIO_CONFIG.timeslice
    );
  }

  private handleDataAvailable(event: BlobEvent) {
    if (
      event.data &&
      event.data.size > 0 &&
      this.websocket &&
      this.websocket.readyState === WebSocket.OPEN
    ) {
      this.websocket.send(event.data);
    } else if (this.websocket && this.websocket.readyState !== WebSocket.OPEN) {
      // console.warn('WebSocket not open, cannot send audio data. State:', this.websocket.readyState);
    }
  }

  private cleanupMediaRecorder() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      console.log("Stopping MediaRecorder...");
      this.mediaRecorder.stop(); // This will trigger onstop, which sends CloseStream
    }
    this.mediaRecorder = null;
  }

  private cleanupMediaStream() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  private cleanupWebSocket(isGraceful = true) {
    if (this.websocket) {
      if (this.websocket.readyState === WebSocket.OPEN) {
        if (isGraceful) {
          // MediaRecorder.onstop should send CloseStream. If stopping directly without recorder,
          // send it here.
          // this.websocket.send(JSON.stringify({ type: 'CloseStream' }));
          console.log("Closing Deepgram WebSocket connection gracefully.");
          this.websocket.close(1000, "Client initiated disconnect");
        } else {
          console.log("Terminating Deepgram WebSocket connection.");
          this.websocket.close(1001, "Client initiated termination"); // 1001: Going away
        }
      } else if (this.websocket.readyState === WebSocket.CONNECTING) {
        console.log("Aborting pending Deepgram WebSocket connection.");
        this.websocket.close(1000, "Client aborted connection attempt");
      }
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
    console.log("Attempting to start audio streaming to Deepgram...");
    this.shouldReconnect = true; // Enable reconnection attempts for this session
    this.reconnectAttempts = 0; // Reset for a fresh start

    startRecording(); // Updates store: isRecording=true, resets transcripts, connectionStatus='connecting'

    const stream = await this.getMicrophoneAccess();
    if (!stream) {
      console.error("Failed to get microphone access. Cannot start streaming.");
      // getMicrophoneAccess already sets connectionStatus on error
      // Ensure recording state is also reset if mic access fails critically
      useRecordingStore.getState().stopRecording();
      return;
    }

    // AudioContext is not strictly necessary here as MediaRecorder handles encoding with constraints.
    // this.audioContext = new AudioContext({ sampleRate: AUDIO_CONFIG.sampleRate });

    this.setupWebSocket(); // This will try to open WebSocket and then start MediaRecorder on successful open & auth.
  }

  // Parameter to control if stop should allow reconnection, e.g. user stop vs error stop
  public stopStreaming(allowReconnect: boolean = false): void {
    const { stopRecording } = useRecordingStore.getState();
    console.log("Stopping audio streaming to Deepgram...");
    this.shouldReconnect = allowReconnect;

    // 1. Stop the recorder first. Its onstop will send CloseStream.
    this.cleanupMediaRecorder();
    // 2. Then close the WebSocket connection.
    this.cleanupWebSocket(true); // true for graceful
    // 3. Release the microphone.
    this.cleanupMediaStream();

    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = null;
    }
    stopRecording(); // Updates store: isRecording=false
    console.log("Audio streaming stopped.");
  }
}
