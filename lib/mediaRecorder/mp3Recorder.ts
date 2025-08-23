export interface RecordingOptions {
  maxDuration?: number; // milliseconds
  onProgress?: (duration: number) => void;
  onStop?: (blob: Blob) => void;
  onStreamReady?: (stream: MediaStream) => void;
  onStart?: () => void; // MediaRecorder が実際に開始したとき
}

export class Mp3Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime = 0;
  private progressInterval: NodeJS.Timeout | null = null;
  private maxDurationTimeout: NodeJS.Timeout | null = null;
  private stream: MediaStream | null = null;

  constructor(private options: RecordingOptions = {}) {}

  async start(): Promise<void> {
    try {
      console.log('Starting MP3 recording...');

      // Get microphone access
      console.log('Requesting microphone access...');
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000, // Optimal for speech
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      console.log('Microphone access granted');
      
      // Notify that stream is ready
      this.options.onStreamReady?.(this.stream);

      // Determine best supported format
      let mimeType = 'audio/webm;codecs=opus'; // Default fallback
      
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      }
      
      console.log('Using mime type:', mimeType);
      
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType,
        bitsPerSecond: 32000 // Lower bitrate for smaller files
      });

      this.chunks = [];

      this.mediaRecorder.onstart = () => {
        this.options.onStart?.();
      };

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
          console.log('Data chunk received, size:', event.data.size);
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log('Recording stopped, creating blob from', this.chunks.length, 'chunks');
        const blob = new Blob(this.chunks, { type: mimeType });
        console.log('Blob created, size:', blob.size, 'type:', blob.type);
        this.options.onStop?.(blob);
        this.cleanup();
      };

      // Start recording with timeslice for better streaming
      this.mediaRecorder.start(1000); // Collect data every second
      this.startTime = Date.now();
      console.log('Recording started');

      // Set up progress tracking
      if (this.options.onProgress) {
        this.progressInterval = setInterval(() => {
          const duration = Date.now() - this.startTime;
          this.options.onProgress!(duration);
        }, 100);
      }

      // Set up max duration
      if (this.options.maxDuration) {
        this.maxDurationTimeout = setTimeout(() => {
          console.log('Max duration reached, stopping recording');
          this.stop();
        }, this.options.maxDuration);
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      this.cleanup();
      throw error;
    }
  }

  stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      console.log('Stopping recording...');
      this.mediaRecorder.stop();
    }
  }

  private cleanup(): void {
    // Clear intervals and timeouts
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    if (this.maxDurationTimeout) {
      clearTimeout(this.maxDurationTimeout);
      this.maxDurationTimeout = null;
    }

    // Stop all tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    console.log('Cleanup completed');
  }

  getState(): RecordingState | null {
    return this.mediaRecorder?.state || null;
  }
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}