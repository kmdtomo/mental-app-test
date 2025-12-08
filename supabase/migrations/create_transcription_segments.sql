-- transcription_segments テーブル作成
-- Whisperのセグメント単位で文字起こしと感情データを保存

CREATE TABLE IF NOT EXISTS transcription_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_id UUID NOT NULL REFERENCES voice_recordings(id) ON DELETE CASCADE,

  -- セグメント情報
  segment_index INT NOT NULL,
  text TEXT NOT NULL,
  start_time FLOAT NOT NULL,  -- 秒単位
  end_time FLOAT NOT NULL,    -- 秒単位

  -- 感情分析結果
  arousal FLOAT,              -- 覚醒度 (1-5)
  valence FLOAT,              -- 快度 (1-5)
  dominance FLOAT,            -- 優位性 (1-5)
  emotion_label TEXT,         -- 感情ラベル（喜び、悲しみ、怒り、中立など）

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_transcription_segments_recording ON transcription_segments(recording_id);
CREATE INDEX IF NOT EXISTS idx_transcription_segments_user ON transcription_segments(user_id);
CREATE INDEX IF NOT EXISTS idx_transcription_segments_segment_index ON transcription_segments(recording_id, segment_index);

-- RLS (Row Level Security) 設定
ALTER TABLE transcription_segments ENABLE ROW LEVEL SECURITY;

-- ポリシー: ユーザーは自分のセグメントのみ閲覧可能
CREATE POLICY "Users can view their own segments"
  ON transcription_segments
  FOR SELECT
  USING (auth.uid() = user_id);

-- ポリシー: ユーザーは自分のセグメントのみ挿入可能
CREATE POLICY "Users can insert their own segments"
  ON transcription_segments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ポリシー: ユーザーは自分のセグメントのみ更新可能
CREATE POLICY "Users can update their own segments"
  ON transcription_segments
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ポリシー: ユーザーは自分のセグメントのみ削除可能
CREATE POLICY "Users can delete their own segments"
  ON transcription_segments
  FOR DELETE
  USING (auth.uid() = user_id);

-- 更新日時を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_transcription_segments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_transcription_segments_updated_at
  BEFORE UPDATE ON transcription_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_transcription_segments_updated_at();
