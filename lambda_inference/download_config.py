from transformers import Wav2Vec2Processor, Wav2Vec2Config
import os

# 保存先ディレクトリ
OUTPUT_DIR = "model"
BASE_MODEL = "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"

print(f"Downloading configuration files from {BASE_MODEL} to {OUTPUT_DIR}...")

# ディレクトリがない場合は作成
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Configのダウンロードと保存
config = Wav2Vec2Config.from_pretrained(BASE_MODEL)
config.save_pretrained(OUTPUT_DIR)
print("Saved config.json")

# Processor (Tokenizer等含む) のダウンロードと保存
processor = Wav2Vec2Processor.from_pretrained(BASE_MODEL)
processor.save_pretrained(OUTPUT_DIR)
print("Saved processor files")

print("Download complete!")
