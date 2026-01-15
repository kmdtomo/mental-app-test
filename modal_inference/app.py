import modal
import io
import base64
from pathlib import Path

# Modal アプリ定義
app = modal.App("emotion-analysis")

# カスタムイメージ定義
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("libsndfile1", "ffmpeg")
    .pip_install(
        "torch==2.1.0",
        "transformers==4.35.0",
        "librosa==0.9.2",
        "soundfile==0.12.1",
        "numpy==1.23.5",
        "scipy==1.10.1",
        "fastapi",
    )
)

# モデル重みを保存するVolume
volume = modal.Volume.from_name("emotion-model-weights", create_if_missing=True)
MODEL_DIR = "/model"


# カスタム重みをアップロードするための関数
@app.function(image=image, volumes={MODEL_DIR: volume})
def upload_model_weights():
    """カスタム重みをVolumeにアップロード（1回だけ実行）"""
    import os

    model_path = f"{MODEL_DIR}/model_20230425_MSPPodcast.pkl"
    if os.path.exists(model_path):
        print(f"Model already exists at {model_path}")
        return True

    print("Model not found in volume. Please upload manually.")
    return False


# Web エンドポイント
@app.function(
    image=image,
    gpu="T4",
    memory=4096,
    timeout=120,
    scaledown_window=300,
    volumes={MODEL_DIR: volume},
)
@modal.fastapi_endpoint(method="POST")
def analyze_emotion(request: dict) -> dict:
    """
    HTTPエンドポイント（Lambda互換API）

    Expected request body:
        {"audio_base64": "..."}

    Returns:
        {"arousal": float, "valence": float, "dominance": float}
        or {"error": str}
    """
    import os
    import torch
    import numpy as np
    import soundfile as sf
    import librosa
    from transformers import Wav2Vec2Processor, Wav2Vec2Model, Wav2Vec2Config

    # CustomWav2Vec2Modelを直接定義
    class CustomWav2Vec2Model(Wav2Vec2Model):
        config_class = Wav2Vec2Config

        def __init__(self, config):
            super().__init__(config)
            self.fc = torch.nn.Linear(1024, 3)
            self.init_weights()

        def forward(self, input_values):
            output = super().forward(input_values)
            x = torch.mean(output.last_hidden_state, dim=1)
            x = self.fc(x)
            return x.squeeze()

    # リクエストボディを取得
    audio_base64 = request.get("audio_base64")

    if not audio_base64:
        return {"error": "No audio_base64 provided"}

    try:
        # モデルロード
        BASE_MODEL = "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"
        MODEL_FILE = f"{MODEL_DIR}/model_20230425_MSPPodcast.pkl"

        # デバイス設定（GPU利用可能ならGPU）
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Using device: {device}")

        print("Loading processor...")
        processor = Wav2Vec2Processor.from_pretrained(BASE_MODEL)

        print("Loading model...")
        model = CustomWav2Vec2Model.from_pretrained(BASE_MODEL)

        # カスタム重みをロード（存在する場合）
        if os.path.exists(MODEL_FILE):
            print(f"Loading custom weights from {MODEL_FILE}...")
            state_dict = torch.load(MODEL_FILE, map_location=device)
            model.load_state_dict(state_dict)
            print("Custom weights loaded!")
        else:
            print(f"Custom weights not found at {MODEL_FILE}, using base model")

        model = model.to(device)
        model.eval()
        print("Model ready!")

        # Base64デコード
        audio_bytes = base64.b64decode(audio_base64)

        # 音声読み込み
        audio_data, sr = sf.read(io.BytesIO(audio_bytes))

        # リサンプリング（16kHzに変換）
        target_sr = 16000
        if sr != target_sr:
            audio_data = librosa.resample(y=audio_data, orig_sr=sr, target_sr=target_sr)

        # モノラル化
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)

        # 前処理
        inputs = processor(
            audio_data,
            sampling_rate=target_sr,
            return_tensors="pt",
            padding=True
        )

        # 推論（GPU使用）
        with torch.no_grad():
            input_values = inputs.input_values.to(device)
            output = model(input_values)
            output = output.cpu().numpy()

        return {
            "arousal": float(output[0]),
            "valence": float(output[1]),
            "dominance": float(output[2])
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Analysis error: {e}")
        return {"error": str(e)}


# セグメント一括分析エンドポイント
@app.function(
    image=image,
    gpu="T4",
    memory=4096,
    timeout=300,  # 5分（複数セグメント処理のため長めに）
    scaledown_window=300,
    volumes={MODEL_DIR: volume},
)
@modal.fastapi_endpoint(method="POST")
def analyze_emotion_segments(request: dict) -> dict:
    """
    複数セグメントを一括で感情分析するエンドポイント
    ffmpegによる音声分割もModal側で実行

    Expected request body:
        {
            "audio_base64": "...",  # 元の音声ファイル全体
            "segments": [
                {"segment_index": 0, "start_time": 0.5, "end_time": 5.0, "text": "..."},
                ...
            ]
        }

    Returns:
        {
            "results": [
                {"segment_index": 0, "arousal": float, "valence": float, "dominance": float},
                ...
            ]
        }
        or {"error": str}
    """
    import os
    import subprocess
    import tempfile
    import torch
    import numpy as np
    import soundfile as sf
    import librosa
    from transformers import Wav2Vec2Processor, Wav2Vec2Model, Wav2Vec2Config

    # CustomWav2Vec2Modelを直接定義
    class CustomWav2Vec2Model(Wav2Vec2Model):
        config_class = Wav2Vec2Config

        def __init__(self, config):
            super().__init__(config)
            self.fc = torch.nn.Linear(1024, 3)
            self.init_weights()

        def forward(self, input_values):
            output = super().forward(input_values)
            x = torch.mean(output.last_hidden_state, dim=1)
            x = self.fc(x)
            return x.squeeze()

    audio_base64 = request.get("audio_base64")
    segments = request.get("segments", [])

    if not audio_base64:
        return {"error": "No audio_base64 provided"}

    if not segments:
        return {"error": "No segments provided"}

    try:
        # モデルを一度だけロード
        BASE_MODEL = "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"
        MODEL_FILE = f"{MODEL_DIR}/model_20230425_MSPPodcast.pkl"

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Using device: {device}")

        print("Loading processor...")
        processor = Wav2Vec2Processor.from_pretrained(BASE_MODEL)

        print("Loading model...")
        model = CustomWav2Vec2Model.from_pretrained(BASE_MODEL)

        if os.path.exists(MODEL_FILE):
            print(f"Loading custom weights from {MODEL_FILE}...")
            state_dict = torch.load(MODEL_FILE, map_location=device)
            model.load_state_dict(state_dict)
            print("Custom weights loaded!")
        else:
            print(f"Custom weights not found at {MODEL_FILE}, using base model")

        model = model.to(device)
        model.eval()
        print("Model ready!")

        # 一時ディレクトリを作成
        with tempfile.TemporaryDirectory() as temp_dir:
            # 元の音声ファイルを保存
            audio_bytes = base64.b64decode(audio_base64)
            input_path = os.path.join(temp_dir, "input.wav")
            with open(input_path, "wb") as f:
                f.write(audio_bytes)

            results = []

            for segment in segments:
                segment_index = segment.get("segment_index")
                start_time = segment.get("start_time")
                end_time = segment.get("end_time")
                duration = end_time - start_time

                print(f"[Segment {segment_index}] Processing: {start_time}s - {end_time}s (duration: {duration:.2f}s)")

                # 短すぎるセグメントはスキップ
                if duration <= 0.05:
                    print(f"[Segment {segment_index}] Skipping: duration too short")
                    results.append({
                        "segment_index": segment_index,
                        "error": "Duration too short",
                        "skipped": True
                    })
                    continue

                # ffmpegでセグメント切り出し
                segment_path = os.path.join(temp_dir, f"segment_{segment_index}.wav")
                ffmpeg_cmd = [
                    "ffmpeg", "-i", input_path,
                    "-ss", str(start_time),
                    "-to", str(end_time),
                    "-ar", "16000",
                    "-ac", "1",
                    "-y", segment_path
                ]

                try:
                    subprocess.run(ffmpeg_cmd, check=True, capture_output=True)
                except subprocess.CalledProcessError as e:
                    print(f"[Segment {segment_index}] FFmpeg error: {e.stderr.decode()}")
                    results.append({
                        "segment_index": segment_index,
                        "error": f"FFmpeg error: {e.stderr.decode()}"
                    })
                    continue

                # 音声読み込みと分析
                try:
                    audio_data, sr = sf.read(segment_path)

                    # モノラル化（念のため）
                    if len(audio_data.shape) > 1:
                        audio_data = np.mean(audio_data, axis=1)

                    # 前処理
                    inputs = processor(
                        audio_data,
                        sampling_rate=16000,
                        return_tensors="pt",
                        padding=True
                    )

                    # 推論
                    with torch.no_grad():
                        input_values = inputs.input_values.to(device)
                        output = model(input_values)
                        output = output.cpu().numpy()

                    result = {
                        "segment_index": segment_index,
                        "arousal": float(output[0]),
                        "valence": float(output[1]),
                        "dominance": float(output[2])
                    }
                    print(f"[Segment {segment_index}] Result: A={output[0]:.3f}, V={output[1]:.3f}, D={output[2]:.3f}")
                    results.append(result)

                except Exception as e:
                    print(f"[Segment {segment_index}] Analysis error: {e}")
                    results.append({
                        "segment_index": segment_index,
                        "error": str(e)
                    })

        return {"results": results}

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Analysis error: {e}")
        return {"error": str(e)}


# モデル重みアップロード用のローカル関数
@app.local_entrypoint()
def main():
    """ローカルからモデル重みをアップロード"""
    import subprocess

    local_model_path = Path(__file__).parent / "model" / "model_20230425_MSPPodcast.pkl"

    if local_model_path.exists():
        print(f"Uploading {local_model_path} to Modal volume...")
        # modal volume put コマンドでアップロード
        result = subprocess.run([
            "/Users/komodatomo/Library/Python/3.9/bin/modal",
            "volume", "put",
            "emotion-model-weights",
            str(local_model_path),
            "model_20230425_MSPPodcast.pkl"
        ], capture_output=True, text=True)
        print(result.stdout)
        if result.returncode != 0:
            print(f"Error: {result.stderr}")
        else:
            print("Upload complete!")
    else:
        print(f"Model file not found at {local_model_path}")
