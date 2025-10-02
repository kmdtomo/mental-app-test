#!/usr/bin/env python3
import sys
import os

# vad_deeplearningのパスを追加
sys.path.append('/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning')

try:
    # CPUモードで実行（GPUがない場合）
    import torch
    if not torch.cuda.is_available():
        # deviceをcpuに設定
        import inference
        inference.device = "cpu"
        print("CPUモードで実行します")
    
    from inference import inference_core
    
    # テスト用のサンプル音声を作成（実際の音声ファイルがある場合は置き換えてください）
    print("VAD感情認識テストを開始...")
    print("=" * 50)
    
    # 実際の音声ファイルパスを指定してください
    # 例: audio_file = "/path/to/your/audio.wav"
    
    # もし録音されたファイルがあれば、そのパスを使用
    import glob
    webm_files = glob.glob("/tmp/*.webm")
    wav_files = glob.glob("/tmp/*.wav")
    
    test_files = webm_files + wav_files
    
    if test_files:
        print(f"見つかった音声ファイル: {test_files[0]}")
        print("感情分析を実行中...")
        
        try:
            result = inference_core(test_files[0])
            if result:
                print("\n=== 感情分析結果 ===")
                print(f"ファイル: {result['file']}")
                print(f"怒り (ang): {result['ang']:.3f}")
                print(f"喜び (hap): {result['hap']:.3f}")
                print(f"悲しみ (sad): {result['sad']:.3f}")
                print(f"主要感情: {result['emo']}")
                print("=" * 50)
            else:
                print("分析に失敗しました")
        except Exception as e:
            print(f"エラー: {e}")
    else:
        print("音声ファイルが見つかりません")
        print("\n使用方法:")
        print("1. 音声ファイルを用意")
        print("2. 以下を実行:")
        print("   python3 test_vad.py")
        
except ImportError as e:
    print(f"モジュールのインポートエラー: {e}")
    print("必要なパッケージがインストールされているか確認してください")
except Exception as e:
    print(f"予期しないエラー: {e}")
    import traceback
    traceback.print_exc()