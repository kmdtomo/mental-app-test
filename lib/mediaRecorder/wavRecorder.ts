let ExtendableMediaRecorder: any;
let register: any;
let connect: any;

let isRegistered = false;

export async function initializeWavRecorder() {
  if (!isRegistered && typeof window !== 'undefined') {
    try {
      // Dynamic import to avoid SSR issues
      const extendableModule = await import('extendable-media-recorder');
      const encoderModule = await import('extendable-media-recorder-wav-encoder');
      
      ExtendableMediaRecorder = extendableModule.MediaRecorder;
      register = extendableModule.register;
      connect = encoderModule.connect;
      
      await register(await connect());
      isRegistered = true;
      console.log('✅ WAV encoder initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize WAV recorder:', error);
      // Fallback: Use default MediaRecorder
    }
  }
}

export interface RecordingOptions {
  maxDuration?: number; // milliseconds
  onProgress?: (duration: number) => void;
  onStop?: (blob: Blob) => void;
  onStreamReady?: (stream: MediaStream) => void;
  onStart?: () => void; // MediaRecorder が実際に開始したとき
}

export class WavRecorder {
  private mediaRecorder: any = null;
  private chunks: Blob[] = [];
  private startTime = 0;
  private progressInterval: NodeJS.Timeout | null = null;
  private maxDurationTimeout: NodeJS.Timeout | null = null;
  private stream: MediaStream | null = null;

  constructor(private options: RecordingOptions = {}) {}

  async start(): Promise<void> {
    try {
      console.log('🎙️ WavRecorder: Starting recording...');
      
      // Initialize WAV encoder
      await initializeWavRecorder();

      // Get microphone access
      console.log('🎤 WavRecorder: Requesting microphone access...');
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000, // Optimal for speech
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      console.log('✅ WavRecorder: Microphone access granted');
      
      // Notify that stream is ready
      this.options.onStreamReady?.(this.stream);

      // Use ExtendableMediaRecorder for WAV support
      const mimeType = 'audio/wav';
      console.log('📼 WavRecorder: Using mime type:', mimeType);
      
      // Check if ExtendableMediaRecorder is loaded
      if (!ExtendableMediaRecorder) {
        throw new Error('WAV encoder not initialized. Please try again.');
      }
      
      this.mediaRecorder = new ExtendableMediaRecorder(this.stream, {
        mimeType: mimeType
      });

      this.chunks = [];

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        console.log('📦 Data available event, size:', event.data?.size);
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);
          console.log('✅ Data chunk added, total chunks:', this.chunks.length);
        } else {
          console.warn('⚠️ Empty data chunk received');
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log('⏹️ Recording stopped, creating blob from', this.chunks.length, 'chunks');
        if (this.chunks.length === 0) {
          console.error('❌ No audio chunks recorded!');
          this.cleanup();
          return;
        }
        const blob = new Blob(this.chunks, { type: mimeType });
        console.log('💾 Blob created, size:', blob.size, 'type:', blob.type);
        if (blob.size === 0) {
          console.error('❌ Blob is empty!');
        } else {
          this.options.onStop?.(blob);
        }
        this.cleanup();
      };
      
      // Add error handler
      this.mediaRecorder.onerror = (event: any) => {
        console.error('❌ MediaRecorder error:', event);
        this.cleanup();
      };

      // Start recording with timeslice to get continuous data
      this.mediaRecorder.start(1000); // Get data every 1 second
      this.startTime = Date.now();
      console.log('🔴 WavRecorder: Recording started successfully with 1s timeslice');
      
      // Notify that recording has started
      this.options.onStart?.();

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
          console.log('⏱️ Max duration reached, stopping recording');
          this.stop();
        }, this.options.maxDuration);
      }
    } catch (error) {
      console.error('❌ WavRecorder: Error starting recording:', error);
      const errorObj = error as Error;
      console.error('Error details:', {
        name: errorObj.name,
        message: errorObj.message,
        stack: errorObj.stack
      });
      this.cleanup();
      throw error;
    }
  }

  stop(): void {
    console.log('⏸️ WavRecorder: Stop called, state:', this.mediaRecorder?.state);
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      console.log('⏸️ WavRecorder: Stopping recording...');
      try {
        this.mediaRecorder.stop();
      } catch (error) {
        console.error('❌ WavRecorder: Error stopping recording:', error);
      }
    } else {
      console.warn('⚠️ WavRecorder: Cannot stop - recorder is inactive or null');
    }
  }

  private cleanup(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    
    if (this.maxDurationTimeout) {
      clearTimeout(this.maxDurationTimeout);
      this.maxDurationTimeout = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this.mediaRecorder = null;
    this.chunks = [];
  }
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}