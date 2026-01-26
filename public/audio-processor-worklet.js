class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4800; // 約100ms分 (48kHzの場合)
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || input.length === 0 || !input[0]) return true;

        const channelData = input[0];

        // データがバッファに収まる場合
        if (this.bufferIndex + channelData.length <= this.bufferSize) {
            this.buffer.set(channelData, this.bufferIndex);
            this.bufferIndex += channelData.length;
        } else {
            // バッファの残りを埋める
            const remainingSpace = this.bufferSize - this.bufferIndex;
            this.buffer.set(channelData.subarray(0, remainingSpace), this.bufferIndex);

            // バッファがいっぱいになったので送信
            this.port.postMessage({
                audio: this.buffer.slice(), // 複製を送信
                timestamp: currentTime
            });

            // 新しいバッファの先頭に残りのデータを書き込む
            this.bufferIndex = 0;
            const overflowData = channelData.subarray(remainingSpace);
            this.buffer.set(overflowData, 0);
            this.bufferIndex = overflowData.length;
        }

        return true;
    }
}

registerProcessor('audio-processor-worklet', AudioProcessor);
