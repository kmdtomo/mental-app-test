#!/usr/bin/env python3
"""異なる感情の音声をシミュレートしてテスト"""
import sys
import numpy as np
import soundfile as sf
from pathlib import Path

sys.path.append('/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning')
from inference import inference_core

# テスト用音声を生成
def create_test_audio(emotion_type, duration=3.0, sr=16000):
    """感情に応じた音声特徴をシミュレート"""
    t = np.linspace(0, duration, int(sr * duration))
    
    if emotion_type == "happy":
        # 高い周波数、変動が大きい
        freq = 440 + 100 * np.sin(2 * np.pi * 5 * t)  # 周波数変動
        audio = 0.3 * np.sin(2 * np.pi * freq * t)
        # 高周波成分を追加
        audio += 0.1 * np.sin(2 * np.pi * 880 * t)
        audio += 0.05 * np.sin(2 * np.pi * 1320 * t)
        
    elif emotion_type == "sad":
        # 低い周波数、単調
        freq = 220  # 低い基本周波数
        audio = 0.3 * np.sin(2 * np.pi * freq * t)
        # エンベロープで減衰
        envelope = np.exp(-0.3 * t)
        audio *= envelope
        
    elif emotion_type == "angry":
        # 強い音圧、ノイズ成分
        freq = 330
        audio = 0.4 * np.sin(2 * np.pi * freq * t)
        # ノイズ成分追加
        noise = 0.1 * np.random.normal(0, 0.1, len(t))
        audio += noise
        # 急激な変化
        audio *= (1 + 0.3 * np.sin(2 * np.pi * 10 * t))
        
    else:  # neutral
        # 中間的な周波数、安定
        freq = 330
        audio = 0.3 * np.sin(2 * np.pi * freq * t)
    
    # 音声らしくするための処理
    # 振幅変調
    am = 1 + 0.2 * np.sin(2 * np.pi * 3 * t)
    audio *= am
    
    # クリッピング防止
    audio = np.clip(audio, -0.9, 0.9)
    
    return audio.astype(np.float32)

# テスト実行
print("=== 補正なしでの感情認識テスト ===\n")

test_cases = [
    ("happy", "喜び"),
    ("sad", "悲しみ"),
    ("angry", "怒り"),
    ("neutral", "中立")
]

results = []

for emotion_type, emotion_name in test_cases:
    # テスト音声を生成
    audio = create_test_audio(emotion_type)
    
    # 一時ファイルに保存
    temp_file = f"/tmp/test_{emotion_type}.wav"
    sf.write(temp_file, audio, 16000)
    
    # 感情分析
    result = inference_core(temp_file)
    
    if result:
        results.append({
            "type": emotion_name,
            "ang": result["ang"],
            "hap": result["hap"],
            "sad": result["sad"],
            "emo": result["emo"]
        })
        
        print(f"【{emotion_name}音声】")
        print(f"  ang: {result['ang']:.4f}")
        print(f"  hap: {result['hap']:.4f}")
        print(f"  sad: {result['sad']:.4f}")
        print(f"  判定: {result['emo']}")
        print()

# 結果の分析
print("\n=== 分析結果 ===")
print("補正を外したことで：")

for r in results:
    max_emotion = max(['ang', 'hap', 'sad'], key=lambda x: r[x])
    print(f"- {r['type']}音声 → 最高値: {max_emotion}({r[max_emotion]:.4f}), 判定: {r['emo']}")
    if max_emotion == r['emo']:
        print("  ✓ 最高値と判定が一致")
    else:
        print("  ✗ 不一致！")

# 実際の音声ファイルもテスト
import glob
real_files = glob.glob("/tmp/audio_*.wav")
if real_files:
    print("\n\n=== 実際の録音ファイルでテスト ===")
    latest_file = sorted(real_files)[-1]
    result = inference_core(latest_file)
    if result:
        print(f"ファイル: {latest_file}")
        print(f"ang: {result['ang']:.4f}")
        print(f"hap: {result['hap']:.4f}") 
        print(f"sad: {result['sad']:.4f}")
        print(f"判定: {result['emo']}")
        
        # 最高値を確認
        emotions = {"ang": result["ang"], "hap": result["hap"], "sad": result["sad"]}
        max_emo = max(emotions, key=emotions.get)
        print(f"最高値: {max_emo} ({emotions[max_emo]:.4f})")
        print(f"判定との一致: {'✓' if max_emo == result['emo'] else '✗'}")