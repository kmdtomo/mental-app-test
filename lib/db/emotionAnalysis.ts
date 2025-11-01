import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

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
  total_segments: number;
  avg_arousal: number;
  avg_valence: number;
  avg_dominance: number;
  dominant_emotion: string;
  created_at: string;
  updated_at: string;
}

export type EmotionAnalysisResultInsert = Omit<EmotionAnalysisResult, 'id' | 'created_at' | 'updated_at'>;

/**
 * 感情分析結果を保存
 */
export async function saveEmotionAnalysis(
  recordingId: string,
  userId: string,
  segments: EmotionSegment[],
  summary: {
    total_segments: number;
    avg_arousal: number;
    avg_valence: number;
    avg_dominance: number;
    dominant_emotion?: string;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from('emotion_analysis_results')
    .insert({
      recording_id: recordingId,
      user_id: userId,
      segments: segments,
      total_segments: summary.total_segments,
      avg_arousal: summary.avg_arousal,
      avg_valence: summary.avg_valence,
      avg_dominance: summary.avg_dominance,
      dominant_emotion: summary.dominant_emotion
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving emotion analysis:', error);
    return { success: false, error: error.message };
  }

  return { success: true, id: data.id };
}

/**
 * 録音IDから感情分析結果を取得
 */
export async function getEmotionAnalysisByRecordingId(
  recordingId: string
): Promise<EmotionAnalysisResult | null> {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from('emotion_analysis_results')
    .select('*')
    .eq('recording_id', recordingId)
    .maybeSingle();

  if (error) {
    console.error('Error getting emotion analysis:', error);
    return null;
  }

  return data;
}

/**
 * その日の全感情分析結果を取得
 */
export async function getDailyEmotionAnalyses(
  userId: string,
  date: string
): Promise<EmotionAnalysisResult[]> {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  // その日の全voice_recordingsを取得して、それに紐付く感情分析を取得
  const { data, error } = await supabase
    .from('emotion_analysis_results')
    .select(`
      *,
      voice_recordings!inner(created_at)
    `)
    .eq('user_id', userId)
    .gte('voice_recordings.created_at', `${date}T00:00:00`)
    .lte('voice_recordings.created_at', `${date}T23:59:59`);

  if (error) {
    console.error('Error getting daily emotion analyses:', error);
    return [];
  }

  return data || [];
}

/**
 * その日の感情統計を計算
 */
export async function calculateDailyEmotionStats(
  userId: string,
  date: string
): Promise<{
  avgArousal: number;
  avgValence: number;
  avgDominance: number;
  dominantEmotion: string;
  emotionDistribution: { [key: string]: number };
  totalRecordings: number;
} | null> {
  const analyses = await getDailyEmotionAnalyses(userId, date);

  if (analyses.length === 0) {
    return null;
  }

  // 平均値計算（カラムから直接取得）
  const avgArousal = analyses.reduce((sum, a) => sum + (a.avg_arousal || 0), 0) / analyses.length;
  const avgValence = analyses.reduce((sum, a) => sum + (a.avg_valence || 0), 0) / analyses.length;
  const avgDominance = analyses.reduce((sum, a) => sum + (a.avg_dominance || 0), 0) / analyses.length;

  // 感情分布を全セグメントから集計
  const emotionDistribution: { [key: string]: number } = {};
  analyses.forEach(analysis => {
    if (Array.isArray(analysis.segments)) {
      analysis.segments.forEach(segment => {
        const emotion = segment.emotion;
        emotionDistribution[emotion] = (emotionDistribution[emotion] || 0) + 1;
      });
    }
  });

  // 最も多い感情を取得
  const dominantEmotion = Object.entries(emotionDistribution)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

  return {
    avgArousal,
    avgValence,
    avgDominance,
    dominantEmotion,
    emotionDistribution,
    totalRecordings: analyses.length
  };
}
