#!/usr/bin/env python3
"""tsuchiya_happy_002.wavの感情分析結果を詳しく調査"""
import sys
sys.path.append('/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning')

from inference import inference_core
import librosa
import numpy as np

test_file = "/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning/tsuchiya_happy_002.wav"

print("=== tsuchiya_happy_002.wav の分析 ===\n")

# 音声ファイルの情報
y, sr = librosa.load(test_file, sr=None)
duration = len(y) / sr

print(f"ファイル情報:")
print(f"  サンプリングレート: {sr} Hz")
print(f"  長さ: {duration:.2f} 秒")
print(f"  サンプル数: {len(y)}")

# 音声の特徴を簡単に分析
print(f"\n音声特徴:")
print(f"  平均振幅: {np.mean(np.abs(y)):.4f}")
print(f"  最大振幅: {np.max(np.abs(y)):.4f}")

# ピッチ推定（基本周波数）
pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
pitch_mean = []
for t in range(pitches.shape[1]):
    index = magnitudes[:, t].argmax()
    pitch = pitches[index, t]
    if pitch > 0:
        pitch_mean.append(pitch)

if pitch_mean:
    print(f"  推定平均ピッチ: {np.mean(pitch_mean):.1f} Hz")

# 感情分析実行
print(f"\n感情分析結果:")
result = inference_core(test_file)

if result:
    print(f"  ang: {result['ang']:.4f}")
    print(f"  hap: {result['hap']:.4f}")
    print(f"  sad: {result['sad']:.4f}")
    print(f"  判定: {result['emo']}")
    
    # 順位を表示
    emotions = [
        ("ang", result['ang']),
        ("hap", result['hap']),
        ("sad", result['sad'])
    ]
    emotions.sort(key=lambda x: x[1], reverse=True)
    
    print(f"\n順位:")
    for i, (emo, value) in enumerate(emotions, 1):
        print(f"  {i}位: {emo} ({value:.4f})")
    
    # 差を計算
    print(f"\n値の差:")
    print(f"  sad - hap = {result['sad'] - result['hap']:.4f}")
    print(f"  sad - ang = {result['sad'] - result['ang']:.4f}")
    
    # 補正があった場合の結果を推定
    yi_ang, yi_hap, yi_sad = 0.25940862, 0.58535635, 0.20732406
    ang_corr = result['ang'] - yi_ang
    hap_corr = result['hap'] - yi_hap
    sad_corr = result['sad'] - yi_sad
    
    print(f"\n【参考】もし補正があった場合:")
    print(f"  ang: {ang_corr:.4f}")
    print(f"  hap: {hap_corr:.4f}")
    print(f"  sad: {sad_corr:.4f}")
    
    # 補正ありでの判定
    if ang_corr >= sad_corr and not (hap_corr >= ang_corr):
        emo_corr = "ang"
    elif sad_corr >= hap_corr and not (ang_corr >= sad_corr):
        emo_corr = "sad"
    elif hap_corr >= ang_corr and not (sad_corr >= hap_corr):
        emo_corr = "hap"
    else:
        emo_corr = "other"
    
    print(f"  判定: {emo_corr}")
    
else:
    print("分析失敗")

print(f"\n=== 考察 ===")
print("'happy'というファイル名なのにsadと判定される理由:")
print("1. モデルが日本語音声の特徴を正しく学習できていない")
print("2. 英語ベースのWav2Vec2モデルの限界")
print("3. HCUDBの学習データの偏り")
print("4. 日本人の'happy'な声が英語話者より抑制的")