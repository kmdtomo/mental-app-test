// Database types for Supabase tables

export interface VoiceRecording {
  id: string;
  user_id: string;
  file_path: string;
  duration: number;
  created_at: string;
}

// ❌ Transcription削除（dialogue_turnsに統合）

export interface DialogueTurn {
  id: string;
  user_id: string;
  date: string;
  role: 'user' | 'assistant';
  content: string;
  input_type: 'text' | 'voice' | null;
  recording_id: string | null;
  order_index: number;
  created_at: string;
}

export interface EmotionSegment {
  segment_id: number;
  start: number;
  end: number;
  duration: number;
  arousal: number;
  valence: number;
  dominance: number;
  emotion: string;
}

export interface EmotionAnalysisResult {
  id: string;
  recording_id: string;
  user_id: string;
  segments: EmotionSegment[];
  // 総評データ（カラムに展開）
  total_segments: number;
  avg_arousal: number;
  avg_valence: number;
  avg_dominance: number;
  dominant_emotion: string;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface EmotionDistribution {
  happy?: number;
  sad?: number;
  angry?: number;
  calm?: number;
  neutral?: number;
  excited?: number;
  relaxed?: number;
  stressed?: number;
  tired?: number;
}

export interface DailySummary {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  transcription_text: string | null;
  formatted_text: string | null;
  avg_arousal: number | null;
  avg_valence: number | null;
  avg_dominance: number | null;
  dominant_emotion: string | null;
  emotion_distribution: EmotionDistribution;
  total_recordings: number;
  total_duration_seconds: number;
  ai_insights: string | null;
  created_at: string;
  updated_at: string;
}

// Insert types (without auto-generated fields)
export type DialogueTurnInsert = Omit<DialogueTurn, 'id' | 'created_at'>;
export type EmotionAnalysisResultInsert = Omit<EmotionAnalysisResult, 'id' | 'created_at' | 'updated_at'>;
export type DailySummaryInsert = Omit<DailySummary, 'id' | 'created_at' | 'updated_at'>;

// Update types (partial)
export type EmotionAnalysisResultUpdate = Partial<Omit<EmotionAnalysisResult, 'id' | 'created_at' | 'updated_at'>>;
export type DailySummaryUpdate = Partial<Omit<DailySummary, 'id' | 'user_id' | 'date' | 'created_at' | 'updated_at'>>;
