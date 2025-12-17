import modal
import io
import base64
from pathlib import Path

# Modal アプリ定義
app = modal.App("emotion-analysis")

# カスタムイメージ定義
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("libsndfile1")
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
    cpu=2,  # CPU only (cheaper)
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
