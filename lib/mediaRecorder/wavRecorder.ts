let ExtendableMediaRecorder: any;
let register: any;
let connect: any;

let isRegistered = false;
let initializationPromise: Promise<void> | null = null;

// グローバルなストリームキャッシュ（スマホで毎回許可を求められる問題を解決）
let cachedStream: MediaStream | null = null;
let cachedDeviceId: string | undefined = undefined;

export async function initializeWavRecorder() {
  // 既に初期化中の場合は、その Promise を返す（重複初期化を防ぐ）
  if (initializationPromise) {
    return initializationPromise;
  }

  if (!isRegistered && typeof window !== 'undefined') {
    initializationPromise = (async () => {
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
        initializationPromise = null;
        throw error;
      }
    })();

    return initializationPromise;
  }
}

// ページ読み込み時に事前初期化（録音ボタンを押す前に完了させる）
if (typeof window !== 'undefined') {
  // 少し遅延させてページ読み込みをブロックしない
  setTimeout(() => {
    initializeWavRecorder().catch(console.error);
  }, 100);
}

// キャッシュされたストリームを取得または新規作成
async function getOrCreateStream(preferredDeviceId?: string): Promise<MediaStream> {
  // キャッシュされたストリームが有効かチェック
  if (cachedStream && cachedDeviceId === preferredDeviceId) {
    const tracks = cachedStream.getAudioTracks();
    if (tracks.length > 0 && tracks[0].readyState === 'live') {
      console.log('♻️ Reusing cached audio stream');
      return cachedStream;
    }
  }

  // 新しいストリームを取得
  console.log('🎤 Getting new audio stream...');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: preferredDeviceId ? { exact: preferredDeviceId } : undefined,
      channelCount: 1,
      sampleRate: 44100,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  // キャッシュを更新
  cachedStream = stream;
  cachedDeviceId = preferredDeviceId;

  return stream;
}

// ストリームを解放（ページ離脱時などに呼ぶ）
export function releaseStream() {
  if (cachedStream) {
    cachedStream.getTracks().forEach(track => track.stop());
    cachedStream = null;
    cachedDeviceId = undefined;
    console.log('🔇 Audio stream released');
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

      // Initialize WAV encoder (待機して確実に完了させる)
      await initializeWavRecorder();

      // Get microphone access (キャッシュされたストリームを再利用)
      console.log('🎤 WavRecorder: Requesting microphone access...');

      // デバイス列挙は初回のみ（ラベルが取得できる場合のみ意味がある）
      let preferredDeviceId: string | undefined = undefined;

      // 既にキャッシュされたストリームがある場合はデバイス列挙をスキップ
      if (!cachedStream) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(device => device.kind === 'audioinput');

          console.log('🎤 Available audio inputs:', audioInputs.map(d => ({
            deviceId: d.deviceId,
            label: d.label,
            groupId: d.groupId
          })));

          // Filter out iPhone Continuity microphone
          const builtInMic = audioInputs.find(device =>
            device.label && // ラベルがある場合のみフィルタ
            !device.label.toLowerCase().includes('iphone') &&
            !device.label.toLowerCase().includes('continuity')
          );

          preferredDeviceId = builtInMic?.deviceId;

          if (preferredDeviceId) {
            console.log('🎤 Using device:', builtInMic?.label || 'Default');
          } else {
            console.log('🎤 No built-in mic found, using default');
          }
        } catch (enumError) {
          console.warn('⚠️ Device enumeration failed, using default:', enumError);
        }
      }

      // キャッシュされたストリームを取得または新規作成
      this.stream = await getOrCreateStream(preferredDeviceId);
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

    // ストリームは破棄しない（キャッシュして再利用するため）
    // スマホで毎回マイク許可を求められる問題を解決
    this.stream = null;

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