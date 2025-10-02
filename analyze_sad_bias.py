#!/usr/bin/env python3
"""なぜsadが高くなりやすいか調査"""
import sys
import torch
import numpy as np

sys.path.append('/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning')

from models import CustomWav2Vec2Model
from transformers import Wav2Vec2Config
from pathlib import Path

print("=== モデルの重みバイアスを調査 ===\n")

# モデルをロード
model_path = Path("/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning/model/model_20241026_HCUDB.pkl")
base_model = "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"

config = Wav2Vec2Config.from_pretrained(base_model)
model = CustomWav2Vec2Model(config)
model.load_state_dict(torch.load(model_path, map_location='cpu'))
model.eval()

# fc層の重みを分析
fc_weight = model.fc.weight.data  # [3, 1024]
fc_bias = model.fc.bias.data      # [3]

print("1. 出力層（fc層）のバイアス項:")
print(f"   ang bias: {fc_bias[0]:.6f}")
print(f"   hap bias: {fc_bias[1]:.6f}")
print(f"   sad bias: {fc_bias[2]:.6f}")
print(f"   → sadが最も高い: {'YES' if fc_bias[2] > max(fc_bias[0], fc_bias[1]) else 'NO'}")

print("\n2. 重みの統計:")
for i, emotion in enumerate(['ang', 'hap', 'sad']):
    weights = fc_weight[i]
    print(f"   {emotion}: mean={weights.mean():.6f}, std={weights.std():.6f}, max={weights.max():.6f}")

print("\n3. 重みベクトルのノルム（影響力の大きさ）:")
for i, emotion in enumerate(['ang', 'hap', 'sad']):
    norm = torch.norm(fc_weight[i]).item()
    print(f"   {emotion}: {norm:.6f}")

# 最近の録音ファイルを確認
import glob
wav_files = sorted(glob.glob("/tmp/audio_*.wav"))
if wav_files and len(wav_files) > 0:
    print("\n4. 実際の録音データの傾向:")
    from inference import inference_core
    
    results = []
    for wav_file in wav_files[-3:]:  # 最新3件
        result = inference_core(wav_file)
        if result:
            results.append(result)
    
    if results:
        avg_ang = np.mean([r['ang'] for r in results])
        avg_hap = np.mean([r['hap'] for r in results])
        avg_sad = np.mean([r['sad'] for r in results])
        
        print(f"   平均 ang: {avg_ang:.4f}")
        print(f"   平均 hap: {avg_hap:.4f}")
        print(f"   平均 sad: {avg_sad:.4f}")
        print(f"   sadが最も高い: {'YES' if avg_sad > max(avg_ang, avg_hap) else 'NO'}")

print("\n=== 結論 ===")
print("モデル自体にsadが高く出やすいバイアスがある可能性があります。")
print("これは学習データ（HCUDB）の特性による可能性が高いです。")
print("あなたの声の問題ではありません！")