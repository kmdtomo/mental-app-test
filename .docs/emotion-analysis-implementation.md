# 音声感情認識機能の実装手順

## 概要
音声日記アプリに感情分析機能を追加し、ユーザーの感情状態（怒り・喜び・悲しみ）をリアルタイムで分析します。

## Phase 1-A: 最小構成での実装

### アーキテクチャ
```
音声録音（WebM形式）
    ↓
/api/upload-audio（既存）
    ↓
並列処理 ━━━━━━━━━━━━━━━━━━━┓
    ↓                        ↓
/api/whisper（既存）    /api/analyze-emotion（新規）
    ↓                        ↓
文字起こし              感情分析
    ↓                        ↓
Supabase DB に保存
```

## 実装手順

### 1. データベーススキーマの拡張

dialogue_turnsテーブルに感情データカラムを追加：

```sql
-- Supabase SQLエディタで実行
ALTER TABLE dialogue_turns
ADD COLUMN emotion_ang FLOAT,
ADD COLUMN emotion_hap FLOAT,
ADD COLUMN emotion_sad FLOAT,
ADD COLUMN emotion_primary VARCHAR(10);

-- インデックスを追加（オプション）
CREATE INDEX idx_dialogue_turns_emotion ON dialogue_turns(emotion_primary);
```

### 2. 感情分析APIの作成

`/app/api/analyze-emotion/route.ts`を新規作成：

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  console.log('=== Emotion Analysis API Called ===');
  
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    
    // 認証確認
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recordingId, filePath } = await request.json();
    
    // Supabaseから音声ファイルの公開URLを取得
    const { data: { publicUrl } } = supabase.storage
      .from('voice-recordings')
      .getPublicUrl(filePath);
    
    // 一時ファイルにダウンロード
    const tempPath = `/tmp/${recordingId}.webm`;
    await execAsync(`curl -o ${tempPath} "${publicUrl}"`);
    
    // Python感情分析実行
    const pythonPath = '/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning';
    const { stdout } = await execAsync(
      `cd ${pythonPath} && python3 -c "
import sys
sys.path.append('.')
from inference import inference_core
result = inference_core('${tempPath}')
import json
print(json.dumps(result))
"`
    );
    
    const emotionResult = JSON.parse(stdout);
    
    // dialogue_turnsテーブルを更新
    const { error: updateError } = await supabase
      .from('dialogue_turns')
      .update({
        emotion_ang: emotionResult.ang,
        emotion_hap: emotionResult.hap,
        emotion_sad: emotionResult.sad,
        emotion_primary: emotionResult.emo
      })
      .eq('recording_id', recordingId);
    
    if (updateError) {
      console.error('DB update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    
    // 一時ファイルを削除
    await execAsync(`rm ${tempPath}`);
    
    return NextResponse.json({
      success: true,
      emotion: {
        ang: emotionResult.ang,
        hap: emotionResult.hap,
        sad: emotionResult.sad,
        primary: emotionResult.emo
      }
    });
    
  } catch (error) {
    console.error('Emotion analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
```

### 3. VoiceDiaryPageの更新

`/views/VoiceDiaryPage.tsx`に並列処理を追加：

```typescript
// 既存のimportに追加
interface EmotionResult {
  ang: number;
  hap: number;
  sad: number;
  primary: string;
}

// stateに追加
const [emotionResult, setEmotionResult] = useState<EmotionResult | null>(null);

// handleRecordingComplete関数内で並列処理
try {
  // ... 既存のアップロード処理 ...

  // 2. WhisperとEmotion分析を並列実行
  console.log('Step 2: Parallel processing - Whisper & Emotion Analysis...');
  
  const [whisperResponse, emotionResponse] = await Promise.all([
    // Whisper API（既存）
    fetch('/api/whisper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        recordingId: uploadResult.recordingId,
        filePath: uploadResult.filePath,
        duration: duration,
      }),
    }),
    // Emotion Analysis API（新規）
    fetch('/api/analyze-emotion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        recordingId: uploadResult.recordingId,
        filePath: uploadResult.filePath,
      }),
    })
  ]);
  
  if (!whisperResponse.ok) throw new Error('Whisper API failed');
  if (!emotionResponse.ok) throw new Error('Emotion API failed');
  
  const whisperData = await whisperResponse.json();
  const emotionData = await emotionResponse.json();
  
  setTranscription(whisperData.originalText);
  setEmotionResult(emotionData.emotion);
  
  // ... 続きの処理 ...
```

### 4. UI表示の追加

感情結果を表示するコンポーネントを追加：

```tsx
// VoiceDiaryPage内に追加
{emotionResult && (
  <Card className="p-4 mt-4">
    <h3 className="text-sm font-semibold mb-2">感情分析結果</h3>
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span>😠 怒り</span>
        <span className="font-mono">{emotionResult.ang.toFixed(3)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>😊 喜び</span>
        <span className="font-mono">{emotionResult.hap.toFixed(3)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>😢 悲しみ</span>
        <span className="font-mono">{emotionResult.sad.toFixed(3)}</span>
      </div>
      <div className="mt-2 pt-2 border-t">
        <span className="text-sm text-gray-600">主要感情: </span>
        <span className="font-semibold">
          {emotionResult.primary === 'ang' && '😠 怒り'}
          {emotionResult.primary === 'hap' && '😊 喜び'}
          {emotionResult.primary === 'sad' && '😢 悲しみ'}
          {emotionResult.primary === 'other' && '😐 その他'}
        </span>
      </div>
    </div>
  </Card>
)}
```

## テスト手順

1. **データベースの準備**
   ```bash
   # Supabase Dashboardでスキーマを更新
   ```

2. **依存関係の確認**
   ```bash
   # vad_deeplearningディレクトリで
   cd /Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning
   pip3 install -r requirements.txt
   ```

3. **ローカルサーバー起動**
   ```bash
   pnpm run dev
   ```

4. **動作確認**
   - 音声を録音
   - 並列処理の確認（ネットワークタブ）
   - 感情分析結果の表示確認
   - Supabaseでデータ保存確認

## トラブルシューティング

### Python実行エラーの場合
```bash
# パスを確認
which python3
# 必要なパッケージを確認
pip3 list | grep -E "torch|transformers|librosa"
```

### 権限エラーの場合
```bash
# 一時ディレクトリの権限確認
ls -la /tmp/
```

### デバッグ用ログ
```typescript
// API Route内に追加
console.log('Public URL:', publicUrl);
console.log('Python stdout:', stdout);
console.log('Emotion result:', emotionResult);
```

## 次のステップ（Phase 1-B）

データ取得が成功したら：
1. Claudeプロンプトに感情情報を追加
2. 感情に基づいた共感的な応答を実装
3. 感情履歴の可視化機能

## Phase 2: Lambda移行

ローカル動作確認後：
1. Lambda関数の作成
2. モデルファイルのEFS配置
3. API Gatewayの設定
4. 環境変数の移行