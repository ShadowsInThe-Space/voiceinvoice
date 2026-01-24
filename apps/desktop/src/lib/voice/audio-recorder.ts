/**
 * AudioRecorder class for voice recording.
 *
 * Provides a high-level API for recording audio using the MediaRecorder API.
 * Handles microphone access, recording state management, and audio data collection.
 *
 * @module lib/voice/audio-recorder
 */

/**
 * Recording state enumeration.
 */
export enum RecordingState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PAUSED = 'PAUSED',
}

/**
 * Configuration options for AudioRecorder.
 */
export interface AudioRecorderConfig {
  /** MIME type for recording (default: audio/webm;codecs=opus) */
  mimeType: string;

  /** Sample rate in Hz (default: 48000) */
  sampleRate: number;

  /** Enable echo cancellation (default: true) */
  echoCancellation: boolean;

  /** Enable noise suppression (default: true) */
  noiseSuppression: boolean;

  /** Enable auto gain control (default: true) */
  autoGainControl: boolean;
}

/**
 * Result returned after stopping a recording.
 */
export interface RecordingResult {
  /** The recorded audio as a Blob */
  blob: Blob;

  /** Duration of the recording in milliseconds */
  duration: number;

  /** MIME type of the recording */
  mimeType: string;
}

/**
 * Default configuration for AudioRecorder.
 */
const DEFAULT_CONFIG: AudioRecorderConfig = {
  mimeType: 'audio/webm;codecs=opus',
  sampleRate: 48000,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

/**
 * Preferred MIME types in order of preference.
 */
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
];

/**
 * AudioRecorder class for capturing voice input.
 *
 * Provides methods for starting, stopping, pausing, and resuming recordings.
 * Uses the MediaRecorder API for audio capture.
 *
 * @example
 * const recorder = new AudioRecorder();
 *
 * recorder.onStateChange((state) => {
 *   console.log('Recording state:', state);
 * });
 *
 * await recorder.start();
 * // ... user speaks
 * const result = await recorder.stop();
 * console.log('Recorded', result.duration, 'ms of audio');
 */
export class AudioRecorder {
  private config: AudioRecorderConfig;
  private state: RecordingState = RecordingState.IDLE;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private pausedDuration: number = 0;
  private pauseStartTime: number = 0;
  private stateChangeCallback: ((state: RecordingState) => void) | null = null;

  /**
   * Creates a new AudioRecorder instance.
   *
   * @param {Partial<AudioRecorderConfig>} config - Custom configuration options
   */
  constructor(config: Partial<AudioRecorderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Validate MIME type support
    if (
      typeof MediaRecorder !== 'undefined' &&
      !MediaRecorder.isTypeSupported(this.config.mimeType)
    ) {
      // Fall back to a supported type
      const supported = AudioRecorder.getSupportedMimeTypes();
      if (supported.length > 0) {
        this.config.mimeType = supported[0];
      }
    }
  }

  /**
   * Starts recording audio.
   *
   * Requests microphone access and begins recording.
   *
   * @returns {Promise<void>}
   * @throws {Error} If already recording or microphone access is denied
   */
  async start(): Promise<void> {
    if (this.state !== RecordingState.IDLE) {
      throw new Error('Already recording');
    }

    // Request microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: this.config.echoCancellation,
        noiseSuppression: this.config.noiseSuppression,
        autoGainControl: this.config.autoGainControl,
        sampleRate: this.config.sampleRate,
      },
    });

    // Create MediaRecorder
    this.mediaRecorder = new MediaRecorder(this.mediaStream, {
      mimeType: this.config.mimeType,
    });

    // Collect audio chunks
    this.audioChunks = [];
    this.mediaRecorder.ondataavailable = (event: BlobEvent): void => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    // Start recording
    this.mediaRecorder.start();
    this.startTime = Date.now();
    this.pausedDuration = 0;

    this.setState(RecordingState.RECORDING);
  }

  /**
   * Stops recording and returns the recorded audio.
   *
   * @returns {Promise<RecordingResult>} The recording result
   * @throws {Error} If not currently recording
   */
  async stop(): Promise<RecordingResult> {
    if (this.state === RecordingState.IDLE || !this.mediaRecorder) {
      throw new Error('Not recording');
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder not initialized'));
        return;
      }

      this.mediaRecorder.onstop = (): void => {
        // Calculate duration
        const endTime = Date.now();
        const duration = endTime - this.startTime - this.pausedDuration;

        // Create blob from chunks
        const blob = new Blob(this.audioChunks, { type: this.config.mimeType });

        // Stop all tracks
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach((track) => track.stop());
          this.mediaStream = null;
        }

        // Reset state
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.setState(RecordingState.IDLE);

        resolve({
          blob,
          duration,
          mimeType: this.config.mimeType,
        });
      };

      this.mediaRecorder.onerror = (event: Event): void => {
        reject(new Error(`Recording error: ${event}`));
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Pauses the current recording.
   *
   * @throws {Error} If not currently recording
   */
  pause(): void {
    if (this.state !== RecordingState.RECORDING || !this.mediaRecorder) {
      throw new Error('Not recording');
    }

    this.mediaRecorder.pause();
    this.pauseStartTime = Date.now();
    this.setState(RecordingState.PAUSED);
  }

  /**
   * Resumes a paused recording.
   *
   * @throws {Error} If not currently paused
   */
  resume(): void {
    if (this.state !== RecordingState.PAUSED || !this.mediaRecorder) {
      throw new Error('Not paused');
    }

    this.mediaRecorder.resume();
    this.pausedDuration += Date.now() - this.pauseStartTime;
    this.setState(RecordingState.RECORDING);
  }

  /**
   * Returns the current recording state.
   *
   * @returns {RecordingState} Current state
   */
  getState(): RecordingState {
    return this.state;
  }

  /**
   * Returns the current configuration.
   *
   * @returns {AudioRecorderConfig} Current configuration
   */
  getConfig(): AudioRecorderConfig {
    return { ...this.config };
  }

  /**
   * Returns the current recording duration in milliseconds.
   *
   * @returns {number} Duration in milliseconds, or 0 if not recording
   */
  getDuration(): number {
    if (this.state === RecordingState.IDLE) {
      return 0;
    }

    const now = Date.now();
    let duration = now - this.startTime - this.pausedDuration;

    if (this.state === RecordingState.PAUSED) {
      duration -= now - this.pauseStartTime;
    }

    return Math.max(0, duration);
  }

  /**
   * Registers a callback for state changes.
   *
   * @param {Function} callback - Function to call when state changes
   */
  onStateChange(callback: (state: RecordingState) => void): void {
    this.stateChangeCallback = callback;
  }

  /**
   * Updates the state and notifies listeners.
   *
   * @param {RecordingState} newState - The new state
   */
  private setState(newState: RecordingState): void {
    this.state = newState;
    if (this.stateChangeCallback) {
      this.stateChangeCallback(newState);
    }
  }

  /**
   * Checks if MediaRecorder is supported in the current environment.
   *
   * @returns {boolean} True if supported
   */
  static isSupported(): boolean {
    return typeof MediaRecorder !== 'undefined';
  }

  /**
   * Returns a list of supported MIME types.
   *
   * @returns {string[]} Array of supported MIME types
   */
  static getSupportedMimeTypes(): string[] {
    if (typeof MediaRecorder === 'undefined') {
      return [];
    }

    return PREFERRED_MIME_TYPES.filter((type) => MediaRecorder.isTypeSupported(type));
  }
}
