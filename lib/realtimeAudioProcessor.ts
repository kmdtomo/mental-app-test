import { getEmotionFromVAD, EmotionResult } from './emotionLabeling';

interface AudioWorkletNodeWithParameters extends AudioWorkletNode {
    parameters: AudioParamMap;
}

export class RealtimeAudioProcessor {
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private peerConnection: RTCPeerConnection | null = null;
    private dataChannel: RTCDataChannel | null = null;
    private isProcessing = false;

    // Callbacks
    public onTranscription: (text: string, isFinal: boolean) => void = () => { };
    public onEmotionResult: (result: EmotionResult) => void = () => { };
    public onError: (error: string) => void = () => { };

    constructor() { }

    async start() {
        console.log('RealtimeAudioProcessor: start() called');
        try {
            // 0. AudioContextを即座に作成 (ユーザー操作の直後に行う必要があるため)
            // これにより、ブラウザの自動再生ポリシーによるブロックを防ぐ
            this.audioContext = new AudioContext({ sampleRate: 16000 });

            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // 1. マイク許可の取得
            console.log('Requesting microphone access...');
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 48000, // 高音質で取得
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            console.log('Microphone access granted');

            // 2. OpenAI Realtime APIとの接続 (WebRTC)
            console.log('Connecting to OpenAI Realtime API...');
            await this.connectToOpenAI();
            console.log('Connected to OpenAI');

            // 3. AudioWorkletのセットアップ (Lambdaへの感情分析用)
            // 既に作成したAudioContextを使用
            console.log('Setting up AudioWorklet...');
            await this.setupAudioWorklet();
            console.log('AudioWorklet setup complete');

            this.isProcessing = true;
            console.log('Recording started successfully');
        } catch (error: any) {
            console.error('Failed to start recording:', error);
            this.onError(error.message || '録音の開始に失敗しました');
            this.stop();
        }
    }

    stop() {
        this.isProcessing = false;

        // OpenAI WebRTC 切断
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // AudioWorklet 停止
        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode = null;
        }

        // AudioContext 停止
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        // マイク停止
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
    }

    private async connectToOpenAI() {
        const EPHEMERAL_KEY_URL = "https://api.openai.com/v1/realtime/sessions";
        const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

        if (!apiKey) throw new Error("OpenAI API Key not found");

        // 1. セッション作成 (Ephemeral Token取得)
        const tokenResponse = await fetch(EPHEMERAL_KEY_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-realtime-preview-2024-12-17",
                voice: "alloy",
                instructions: "あなたは親切なアシスタントです。ユーザーの入力に対して簡潔に日本語で応答してください。",
                input_audio_transcription: {
                    model: "whisper-1"
                }
            }),
        });

        if (!tokenResponse.ok) {
            const err = await tokenResponse.text();
            throw new Error(`Failed to create session: ${err}`);
        }

        const data = await tokenResponse.json();
        const ephemeralKey = data.client_secret.value;

        // 2. WebRTC接続の確立
        const pc = new RTCPeerConnection();
        this.peerConnection = pc;

        // 音声トラックの追加
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => pc.addTrack(track, this.mediaStream!));
        }

        // データチャンネル (イベント送受信用)
        const dc = pc.createDataChannel("oai-events");
        this.dataChannel = dc;

        dc.onmessage = (e) => this.handleOpenAIMessage(e);
        dc.onopen = () => {
            console.log("Data channel opened");
            // VAD設定（話し終わり判定）を調整してレスポンスを高速化
            const sessionUpdate = {
                type: "session.update",
                session: {
                    turn_detection: {
                        type: "server_vad",
                        threshold: 0.5,
                        prefix_padding_ms: 300,
                        silence_duration_ms: 400 // デフォルトより短くして反応を早める (例: 400ms)
                    }
                }
            };
            dc.send(JSON.stringify(sessionUpdate));
        };

        // オファー生成と送信
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const baseUrl = "https://api.openai.com/v1/realtime";
        const model = "gpt-4o-realtime-preview-2024-12-17";

        const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
            method: "POST",
            body: offer.sdp,
            headers: {
                "Authorization": `Bearer ${ephemeralKey}`,
                "Content-Type": "application/sdp"
            },
        });

        const answerSdp = await sdpResponse.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

        // 接続状態の監視
        pc.oniceconnectionstatechange = () => {
            console.log(`ICE Connection State changed: ${pc.iceConnectionState}`);
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                this.onError('Audio connection lost. Please try again.');
                this.stop();
            }
        };
    }

    private handleOpenAIMessage(event: MessageEvent) {
        try {
            const msg = JSON.parse(event.data);

            // 文字起こし結果 (入力音声の認識)
            if (msg.type === 'conversation.item.input_audio_transcription.completed') {
                this.onTranscription(msg.transcript, true);
            }
            // AIの応答 (テキストデルタ)など
            else if (msg.type === 'response.text.delta') {
                // AIの返答を表示したい場合はここで処理
            }

        } catch (e) {
            console.error("Error parsing data channel message", e);
        }
    }

    private async setupAudioWorklet() {
        if (!this.mediaStream || !this.audioContext) return;

        // 既存のAudioContextを使用 (start()で初期化済み)
        // this.audioContext = new AudioContext({ sampleRate: 16000 }); 
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);

        await this.audioContext.audioWorklet.addModule('/audio-processor-worklet.js');

        this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor-worklet');

        this.workletNode.port.onmessage = async (event) => {
            // Workletからは { audio: Float32Array, timestamp: number } が送られてくる
            const audioData = event.data.audio;
            if (audioData) {
                await this.sendToLambda(audioData);
            }
        };

        source.connect(this.workletNode);
        this.workletNode.connect(this.audioContext.destination); // 必要ならミュート
    }

    private async sendToLambda(audioData: Float32Array) {
        // 実際の実装では、ある程度のチャンクサイズ（例: 200ms分）が溜まったら送る
        // Lambda側は短い音声でも処理可能だが、頻度が高すぎるとネットワーク負荷になる

        const lambdaEndpoint = process.env.NEXT_PUBLIC_AWS_LAMBDA_EMOTION_ANALYSIS_URL;
        if (!lambdaEndpoint) {
            console.error("Lambda endpoint not configured");
            return;
        }

        try {
            // Float32 -> Int16変換后
            const pcm16 = this.floatTo16BitPCM(audioData);

            // WAVヘッダーを付与してバイナリ作成
            const wavBytes = this.createWavFile(pcm16, 16000); // 16kHz

            // Base64変換
            const base64Audio = this.arrayBufferToBase64(wavBytes);

            // console.log(`Sending audio chunk to Lambda (${base64Audio.length} chars)`);

            const response = await fetch(lambdaEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audio_base64: base64Audio,
                    format: 'wav',
                    sample_rate: 16000
                })
            });

            if (response.ok) {
                const result = await response.json();
                // console.log("Lambda Result:", result);
                const emotion = getEmotionFromVAD(result.arousal, result.valence, result.dominance);
                this.onEmotionResult(emotion);
            } else {
                console.error("Lambda Error:", response.status, await response.text());
            }
        } catch (e) {
            console.error("Lambda inference failed", e);
        }
    }

    private createWavFile(samples: Int16Array, sampleRate: number): ArrayBuffer {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        // RIFF chunk descriptor
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        this.writeString(view, 8, 'WAVE');

        // fmt sub-chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
        view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
        view.setUint16(22, 1, true); // NumChannels (1 channel)
        view.setUint32(24, sampleRate, true); // SampleRate
        view.setUint32(28, sampleRate * 2, true); // ByteRate
        view.setUint16(32, 2, true); // BlockAlign
        view.setUint16(34, 16, true); // BitsPerSample

        // data sub-chunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true);

        // PCM data
        const length = samples.length;
        for (let i = 0; i < length; i++) {
            view.setInt16(44 + i * 2, samples[i], true);
        }

        return buffer;
    }

    private writeString(view: DataView, offset: number, string: string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    private floatTo16BitPCM(output: Float32Array) {
        const buffer = new ArrayBuffer(output.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < output.length; i++) {
            const s = Math.max(-1, Math.min(1, output[i]));
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        return new Int16Array(buffer);
    }

    private arrayBufferToBase64(buffer: ArrayBuffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }
}
