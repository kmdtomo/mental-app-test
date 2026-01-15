# 音声感情認識ModalのGPU化計画

## 現状確認
- `modal_inference/app.py` に Modal.com 用の音声感情認識アプリケーションが実装されています。
- 現在の設定では `cpu=2` となっており、CPUのみで動作する設定です。
- コード内部では `torch.cuda.is_available()` をチェックしてデバイスを選択するロジック(`device = "cuda" if ... else "cpu"`)が既に実装されています。

## 変更内容
`modal_inference/app.py` の `analyze_emotion` および `analyze_emotion_segments` 関数のデコレータ設定を変更し、GPUを割り当てます。

### 変更前
```python
@app.function(
    image=image,
    cpu=2,  # CPU only (cheaper)
    memory=4096,
    ...
)
```

### 変更後
```python
@app.function(
    image=image,
    gpu="T4",  # GPUを使用 (NVIDIA T4)
    memory=4096,
    ...
)
```

## 採用するGPUについて
- **NVIDIA T4**: コストパフォーマンスが良く、推論タスク（特に音声処理や軽量なモデル）に適しています。
- 必要に応じて `A10G` や `A100` などに変更可能ですが、まずは `T4` で十分な高速化が見込めます。

## 検証
変更後、Modal上にデプロイ (`modal deploy modal_inference/app.py`) することで、推論時に自動的にCUDAが有効になり、GPUでの高速処理が行われます。
