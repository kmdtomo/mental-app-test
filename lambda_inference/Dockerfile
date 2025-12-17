# AWS Lambda用のPythonベースイメージを使用
FROM public.ecr.aws/lambda/python:3.10

# 作業ディレクトリ
WORKDIR ${LAMBDA_TASK_ROOT}

# システム依存パッケージのインストール（libsndfile等）
RUN yum install -y libsndfile

# Pythonパッケージのインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# モデルファイルとコードをコピー
COPY models.py .
COPY app.py .

# カスタム重みファイルをコピー
COPY model/ model/

# Hugging Faceモデルを事前ダウンロード（コールドスタート対策）
# Lambda実行時と同じキャッシュディレクトリを使用
ENV HF_HOME=/var/task/hf_cache
ENV TRANSFORMERS_CACHE=/var/task/hf_cache
RUN mkdir -p /var/task/hf_cache
# ビルド時にモデルをダウンロード
RUN python -c "from transformers import Wav2Vec2Processor; Wav2Vec2Processor.from_pretrained('audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim')"
RUN python -c "from models import CustomWav2Vec2Model; CustomWav2Vec2Model.from_pretrained('audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim')"
# ダウンロード後にオフラインモードを有効化（Lambda実行時用）
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1

# Lambdaハンドラーを指定
CMD ["app.handler"]
