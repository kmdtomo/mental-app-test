class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4800; // 約100ms分 (48kHzの場合)
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || input.length === 0) return true;

        const channelData = input[0];

        // バッファにデータを蓄積
        if (this.bufferIndex + channelData.length > this.bufferSize) {
            // バッファがいっぱいになったら送信
            this.port.postMessage({
                audio: this.buffer.slice(0, this.bufferIndex),
                timestamp: currentTime
            });
            this.bufferIndex = 0;
        }

        this.buffer.set(channelData, this.bufferIndex);
        this.bufferIndex += channelData.length;

        return true;
    }
}

registerProcessor('audio-processor-worklet', AudioProcessor);
