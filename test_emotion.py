#!/usr/bin/env python3
import sys
import os

# vad_deeplearningのパスを追加
sys.path.append('/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning')

try:
    from inference import inference_core
    
    # テスト用の音声ファイルパス（実際のファイルに置き換えてください）
    # audio_file = "/path/to/your/audio.wav"
    
    # もしくは、録音したwebmファイルがあれば使用
    test_files = [
        "/tmp/test_audio.wav",  # 例
        "/tmp/recording_1.webm",  # 例
    ]
    
    print("感情認識テストを開始します...")
    print("=" * 50)
    
    # デバイスをCPUに変更（GPUがない場合）
    import torch
    if not torch.cuda.is_available():
        import inference
        inference.device = "cpu"
        print("GPUが利用できないため、CPUモードで実行します")
    
    # テスト実行
    print("\nテスト音声ファイルを探しています...")
    
    # 実際にはここに音声ファイルのパスを指定
    # result = inference_core(audio_file)
    # print(f"結果: {result}")
    
    print("\n使用方法:")
    print("1. 音声ファイル（.wav または .webm）を用意")
    print("2. 以下のコマンドを実行:")
    print("   python test_emotion.py /path/to/audio.wav")
    
except Exception as e:
    print(f"エラーが発生しました: {e}")
    print("\n必要なパッケージがインストールされているか確認してください:")
    print("- torch")
    print("- transformers") 
    print("- librosa")
    print("- pandas")
    print("- numpy")