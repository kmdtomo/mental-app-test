#!/usr/bin/env python3
"""補正なしで感情分析をテスト"""
import sys
import os
import torch
import librosa
import numpy as np
from typing import Dict, Any

sys.path.append('/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning')

from models import CustomWav2Vec2Model
from transformers import Wav2Vec2Processor
from pathlib import Path

model_dir = Path("/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning/model")
base_model = "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"
device = "cuda" if torch.cuda.is_available() else "cpu"

def judge_no_correction(ang, hap, sad):
    """補正なしの判定"""
    values = {"ang": ang, "hap": hap, "sad": sad}
    return max(values, key=values.get)

def inference_core_no_correction(fname: str) -> Dict[str, Any]:
    """補正なしの推論"""
    # モデルロード
    model = CustomWav2Vec2Model.from_pretrained(base_model)
    model.load_state_dict(torch.load(
        model_dir/"model_20241026_HCUDB.pkl", 
        map_location=torch.device('cpu')
    ))
    processor = Wav2Vec2Processor.from_pretrained(base_model)
    
    model.eval()
    model.to(device)
    
    try:
        # 音声読み込み
        inputs, sr = librosa.load(fname, sr=16000)
        inputs = processor(inputs, sampling_rate=sr, return_tensors="pt", padding=True)
        inputs.to(device)
        
        # 推論
        tmp = model(inputs.input_values).to("cpu").detach().numpy().T
        
        # 補正なし！
        ang, hap, sad = float(tmp[0]), float(tmp[1]), float(tmp[2])
        
        # 判定
        predicted_emo = judge_no_correction(ang, hap, sad)
        
        print(f"\n=== 補正なしの結果 ===")
        print(f"ang: {ang:.4f}")
        print(f"hap: {hap:.4f}")
        print(f"sad: {sad:.4f}")
        print(f"判定: {predicted_emo}")
        
        # 補正ありとの比較
        yi_ang, yi_hap, yi_sad = 0.25940862, 0.58535635, 0.20732406
        ang_corrected = ang - yi_ang
        hap_corrected = hap - yi_hap
        sad_corrected = sad - yi_sad
        
        print(f"\n=== 補正ありの場合（参考）===")
        print(f"ang: {ang_corrected:.4f}")
        print(f"hap: {hap_corrected:.4f}")
        print(f"sad: {sad_corrected:.4f}")
        
        return dict(
            file=fname, 
            ang=ang, 
            hap=hap, 
            sad=sad, 
            emo=predicted_emo,
            ang_corrected=ang_corrected,
            hap_corrected=hap_corrected,
            sad_corrected=sad_corrected
        )
        
    except Exception as e:
        print(f"エラー: {e}")
        return None

# テスト実行
if __name__ == "__main__":
    # 最新の録音ファイルを探す
    import glob
    wav_files = glob.glob("/tmp/audio_*.wav")
    
    if wav_files:
        # 最新のファイルを使用
        test_file = sorted(wav_files)[-1]
        print(f"テストファイル: {test_file}")
        
        result = inference_core_no_correction(test_file)
        
        if result:
            print(f"\n最も高い感情値:")
            values = {
                "ang": result["ang"],
                "hap": result["hap"],
                "sad": result["sad"]
            }
            max_emotion = max(values, key=values.get)
            print(f"{max_emotion}: {values[max_emotion]:.4f}")
    else:
        print("テスト用音声ファイルが見つかりません")
        print("アプリで録音してから再実行してください")