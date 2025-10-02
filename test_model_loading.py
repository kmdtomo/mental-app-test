#!/usr/bin/env python3
"""モデルが正しくロードされているかを検証するスクリプト"""
import sys
import torch
import numpy as np

sys.path.append('/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning')

print("=== モデル読み込み検証開始 ===\n")

# 1. モデルを直接ロード（inference.pyの方法と同じ）
from models import CustomWav2Vec2Model
from transformers import Wav2Vec2Config
from pathlib import Path

base_model = "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"
model_path = Path("/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning/model/model_20241026_HCUDB.pkl")

print(f"1. モデルファイルの存在確認:")
print(f"   ファイル: {model_path}")
print(f"   存在: {model_path.exists()}")
print(f"   サイズ: {model_path.stat().st_size / 1024 / 1024:.2f} MB\n")

# 2. 保存されている重みを確認
print("2. 保存されている重みの確認:")
checkpoint = torch.load(model_path, map_location='cpu')
print(f"   キーの数: {len(checkpoint)}")
print(f"   fc層の重みが含まれているか:")
print(f"   - fc.weight: {'fc.weight' in checkpoint}")
print(f"   - fc.bias: {'fc.bias' in checkpoint}")
if 'fc.weight' in checkpoint:
    print(f"   - fc.weight shape: {checkpoint['fc.weight'].shape}")
    print(f"   - fc.weight mean: {checkpoint['fc.weight'].mean().item():.6f}")
    print(f"   - fc.weight std: {checkpoint['fc.weight'].std().item():.6f}")
print()

# 3. モデルの初期化方法を比較
print("3. モデル初期化方法の比較:")

# 方法A: from_pretrained() + load_state_dict() (現在の方法)
print("\n方法A: from_pretrained() + load_state_dict()")
model_a = CustomWav2Vec2Model.from_pretrained(base_model)
print(f"   初期化後のfc.weight mean: {model_a.fc.weight.data.mean().item():.6f}")
print(f"   初期化後のfc.weight std: {model_a.fc.weight.data.std().item():.6f}")
model_a.load_state_dict(checkpoint)
print(f"   load_state_dict後のfc.weight mean: {model_a.fc.weight.data.mean().item():.6f}")
print(f"   load_state_dict後のfc.weight std: {model_a.fc.weight.data.std().item():.6f}")

# 方法B: config経由での初期化
print("\n方法B: Config経由での初期化")
config = Wav2Vec2Config.from_pretrained(base_model)
model_b = CustomWav2Vec2Model(config)
print(f"   初期化後のfc.weight mean: {model_b.fc.weight.data.mean().item():.6f}")
print(f"   初期化後のfc.weight std: {model_b.fc.weight.data.std().item():.6f}")
model_b.load_state_dict(checkpoint)
print(f"   load_state_dict後のfc.weight mean: {model_b.fc.weight.data.mean().item():.6f}")
print(f"   load_state_dict後のfc.weight std: {model_b.fc.weight.data.std().item():.6f}")

# 4. 両方のモデルの出力を比較
print("\n4. モデル出力の比較:")
dummy_input = torch.randn(1, 16000)  # 1秒の音声
model_a.eval()
model_b.eval()
with torch.no_grad():
    output_a = model_a(dummy_input)
    output_b = model_b(dummy_input)
    
print(f"   モデルA出力: {output_a.numpy()}")
print(f"   モデルB出力: {output_b.numpy()}")
print(f"   差の最大値: {(output_a - output_b).abs().max().item():.10f}")
print(f"   出力が同じか: {torch.allclose(output_a, output_b, atol=1e-6)}")

# 5. inference.pyのload_model関数をテスト
print("\n5. inference.pyのload_model関数をテスト:")
from inference import load_model
model_inf, processor = load_model()
print(f"   モデルのロード: 成功")
print(f"   fc.weight mean: {model_inf.fc.weight.data.mean().item():.6f}")
print(f"   fc.weight std: {model_inf.fc.weight.data.std().item():.6f}")

# 同じ入力でテスト
model_inf.eval()
with torch.no_grad():
    output_inf = model_inf(dummy_input)
print(f"   推論出力: {output_inf.numpy()}")
print(f"   モデルAとの差: {(output_a - output_inf).abs().max().item():.10f}")
print(f"   出力が同じか: {torch.allclose(output_a, output_inf, atol=1e-6)}")

print("\n=== 結論 ===")
print("モデルは正しくロードされています！" if torch.allclose(output_a, output_inf, atol=1e-6) else "モデルのロードに問題があります！")