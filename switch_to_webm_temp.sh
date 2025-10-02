#!/bin/bash
# 一時的にWebM形式に戻すスクリプト

echo "一時的にWebM形式に戻します..."

# useVoiceRecorderでMp3Recorderに戻す
sed -i '' "s/import { WavRecorder/import { Mp3Recorder/g" features/voice-diary/hooks/useVoiceRecorder.ts
sed -i '' "s/useRef<WavRecorder/useRef<Mp3Recorder/g" features/voice-diary/hooks/useVoiceRecorder.ts
sed -i '' "s/new WavRecorder/new Mp3Recorder/g" features/voice-diary/hooks/useVoiceRecorder.ts

# ファイル拡張子を.webmに戻す
sed -i '' "s/\.wav/\.webm/g" app/api/upload-audio/route.ts
sed -i '' "s/\.wav/\.webm/g" features/voice-diary/actions/uploadAudio.ts

echo "完了！WebM形式に戻しました。"
echo "WAV形式に戻すには、前の変更を再適用してください。"