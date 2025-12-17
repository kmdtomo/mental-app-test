import json
import base64
import numpy as np
import torch
import io
import os
import soundfile as sf
import librosa
from transformers import Wav2Vec2Processor, Wav2Vec2Config
from models import CustomWav2Vec2Model

# グローバル変数としてモデルをロード（コールドスタート対策）
# Hugging Faceのベースモデルを使用
BASE_MODEL = "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"
MODEL_FILE = os.path.join("model", "model_20230425_MSPPodcast.pkl")

print("Loading model...")
device = "cpu"

try:
    # Hugging Faceからベースモデルをロード（ローカルキャッシュのみ使用）
    processor = Wav2Vec2Processor.from_pretrained(BASE_MODEL, local_files_only=True)
    model = CustomWav2Vec2Model.from_pretrained(BASE_MODEL, local_files_only=True)

    # カスタム学習済み重みをロード
    state_dict = torch.load(MODEL_FILE, map_location=torch.device('cpu'))
    model.load_state_dict(state_dict)
    model.eval()
    print("Model loaded successfully")
except Exception as e:
    print(f"Error loading model: {e}")
    import traceback
    traceback.print_exc()
    model = None
    processor = None

def analyze_audio_segment(audio_data, sr=16000):
    if model is None or processor is None:
        return {"error": "Model not loaded"}

    try:
        # 前処理
        inputs = processor(audio_data, sampling_rate=sr, return_tensors="pt", padding=True)
        
        # 推論
        with torch.no_grad():
            # forwardメソッド内で torch.mean と fc層 を通る
            # output shape: [3] -> (arousal, valence, dominance)
            output = model(inputs.input_values)
            output = output.numpy()

        return {
            "arousal": float(output[0]),
            "valence": float(output[1]),
            "dominance": float(output[2])
        }
    except Exception as e:
        print(f"Prediction error: {e}")
        return {"error": str(e)}

def handler(event, context):
    """
    AWS Lambda Handler
    Expected event: { "audio_base64": "...", "format": "wav" }
    """
    try:
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event

        audio_base64 = body.get('audio_base64')
        if not audio_base64:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No audio_base64 provided'})
            }

        # Base64デコード
        audio_bytes = base64.b64decode(audio_base64)
        
        # 音声読み込み (soundfileを使用)
        # io.BytesIOを使用してメモリ上で処理
        audio_data, sr = sf.read(io.BytesIO(audio_bytes))

        # リサンプリングが必要な場合 (モデルは16kHzを想定)
        target_sr = 16000
        if sr != target_sr:
            # librosaでリサンプリング
            # librosa.resampleはnumpy arrayを期待する
            audio_data = librosa.resample(y=audio_data, orig_sr=sr, target_sr=target_sr)
        
        # モノラル化（もしステレオなら）
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)

        # 分析実行
        result = analyze_audio_segment(audio_data, sr=target_sr)

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': json.dumps(result)
        }

    except Exception as e:
        print(f"Handler error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

    except Exception as e:
        print(f"Handler error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
