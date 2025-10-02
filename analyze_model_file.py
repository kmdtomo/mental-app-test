#!/usr/bin/env python3
"""model_20241026_HCUDB.pklの中身を調査"""
import torch
import pickle
from pathlib import Path

model_path = "/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning/model/model_20241026_HCUDB.pkl"

print("=== model_20241026_HCUDB.pkl の詳細分析 ===\n")

# ファイル情報
file_size = Path(model_path).stat().st_size
print(f"ファイルサイズ: {file_size / 1024 / 1024:.2f} MB")
print(f"作成日時: 2024年10月26日")

# モデルの中身を読み込み
try:
    checkpoint = torch.load(model_path, map_location='cpu')
    print(f"\nデータ型: {type(checkpoint)}")
    
    if isinstance(checkpoint, dict):
        print(f"キーの数: {len(checkpoint)}")
        print("\n主要なキー:")
        
        # fc層の重みを詳しく分析
        if 'fc.weight' in checkpoint and 'fc.bias' in checkpoint:
            fc_weight = checkpoint['fc.weight']
            fc_bias = checkpoint['fc.bias']
            
            print(f"\nfc層（最終出力層）の詳細:")
            print(f"  重み形状: {fc_weight.shape}  # [出力数, 入力数]")
            print(f"  バイアス形状: {fc_bias.shape}")
            print(f"  出力数: {fc_weight.shape[0]} (ang, hap, sadの3つ)")
            print(f"  入力数: {fc_weight.shape[1]} (Wav2Vec2の隠れ層サイズ)")
            
            print(f"\nfc層の統計:")
            print(f"  重み平均: {fc_weight.mean():.6f}")
            print(f"  重み標準偏差: {fc_weight.std():.6f}")
            print(f"  バイアス: {fc_bias.numpy()}")
            
            # 各感情の重みベクトルの特徴
            print(f"\n各感情の重みベクトル特徴:")
            emotions = ['ang', 'hap', 'sad']
            for i, emotion in enumerate(emotions):
                weight_vec = fc_weight[i]
                print(f"  {emotion}: mean={weight_vec.mean():.6f}, std={weight_vec.std():.6f}, norm={torch.norm(weight_vec):.6f}")
        
        # その他の層を確認
        print(f"\n全キー一覧（最初の20個）:")
        keys = list(checkpoint.keys())
        for i, key in enumerate(keys[:20]):
            tensor = checkpoint[key]
            if hasattr(tensor, 'shape'):
                print(f"  {i+1:2d}. {key}: {tensor.shape}")
            else:
                print(f"  {i+1:2d}. {key}: {type(tensor)}")
        
        if len(keys) > 20:
            print(f"  ... 他 {len(keys) - 20} 個のキー")
            
    # モデルが学習した内容を推測
    print(f"\n=== このモデルの正体 ===")
    print("1. ベース: audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim（英語）")
    print("2. 追加学習: HCUDB（日本語感情データ）で2024年10月26日に学習")
    print("3. 出力: 3次元（本来はAVDだが、ang/hap/sadとして使用）")
    print("4. 問題: 英語ベース + 日本語データ + 概念の混同")
    
except Exception as e:
    print(f"エラー: {e}")
    import traceback
    traceback.print_exc()