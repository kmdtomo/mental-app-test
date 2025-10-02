#!/usr/bin/env python3
"""補正前後の値を詳しく調査"""
import sys
sys.path.append('/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning')

from inference import inference_core
import numpy as np

# テスト音声ファイルのパス（実際のファイルに変更してください）
test_file = "/tmp/test_audio.wav"

print("=== 補正値の影響を調査 ===\n")

# inference_coreを改造して補正前後の値を取得
import torch
import librosa
from inference import load_model, device, judge

model, processor = load_model()
model.eval()
model.to(device)

# ダミー音声でテスト（実際の音声ファイルがあれば使用）
try:
    # ランダムな音声データでテスト
    dummy_audio = np.random.randn(16000).astype(np.float32)  # 1秒の音声
    
    # プロセッサーで処理
    inputs = processor(dummy_audio, sampling_rate=16000, return_tensors="pt", padding=True)
    inputs.to(device)
    
    # モデルで推論
    with torch.no_grad():
        raw_output = model(inputs.input_values).to("cpu").detach().numpy()
    
    print("生の出力（補正前）:")
    print(f"  Shape: {raw_output.shape}")
    print(f"  Raw values: {raw_output}")
    
    # 転置して各感情の値を取得
    tmp = raw_output.T
    print(f"\n転置後:")
    print(f"  ang (tmp[0]): {tmp[0]}")
    print(f"  hap (tmp[1]): {tmp[1]}")
    print(f"  sad (tmp[2]): {tmp[2]}")
    
    # 補正値
    yi_ang, yi_hap, yi_sad = 0.25940862, 0.58535635, 0.20732406
    
    print(f"\nYouden Index補正値:")
    print(f"  yi_ang: {yi_ang}")
    print(f"  yi_hap: {yi_hap}")
    print(f"  yi_sad: {yi_sad}")
    
    # 補正後
    ang = tmp[0] - yi_ang
    hap = tmp[1] - yi_hap
    sad = tmp[2] - yi_sad
    
    print(f"\n補正後の値:")
    print(f"  ang: {ang}")
    print(f"  hap: {hap}")
    print(f"  sad: {sad}")
    
    # 判定
    emo = judge(ang, sad, hap)
    print(f"\n判定結果: {emo}")
    
    # 各条件をチェック
    print(f"\n判定ロジックの詳細:")
    print(f"  ang >= sad: {ang >= sad}")
    print(f"  sad >= hap: {sad >= hap}")
    print(f"  hap >= ang: {hap >= ang}")
    
except Exception as e:
    print(f"エラー: {e}")
    import traceback
    traceback.print_exc()

# モデルの構造を確認
print("\n=== モデル構造の確認 ===")
print(f"fc層の形状: {model.fc.weight.shape}")
print(f"出力数: {model.fc.out_features}")
print(f"fc層の重み統計:")
print(f"  Mean: {model.fc.weight.data.mean().item():.6f}")
print(f"  Std: {model.fc.weight.data.std().item():.6f}")
print(f"  Min: {model.fc.weight.data.min().item():.6f}")
print(f"  Max: {model.fc.weight.data.max().item():.6f}")