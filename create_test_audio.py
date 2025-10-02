#!/usr/bin/env python3
import numpy as np
import soundfile as sf
import os

# 1秒間の無音音声を作成（テスト用）
sample_rate = 16000
duration = 1.0  # 秒
samples = int(sample_rate * duration)

# 無音データ（実際には少しノイズを入れる）
audio_data = np.random.normal(0, 0.001, samples)

# WAVファイルとして保存
output_path = '/tmp/test_audio.wav'
sf.write(output_path, audio_data, sample_rate)

print(f"テスト音声を作成しました: {output_path}")
print(f"サンプルレート: {sample_rate}Hz")
print(f"長さ: {duration}秒")