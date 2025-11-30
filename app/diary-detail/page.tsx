'use client';

import { DiaryDetailPage } from '@/views/DiaryDetailPage';

export default function Page() {
  // Mock data for demonstration
  const mockUser = {
    id: 'mock-user-id',
    email: 'tanaka.taro@example.com',
    user_metadata: {
      name: '田中 太郎',
      full_name: '田中 太郎'
    }
  };

  const mockDate = '2025-01-15';

  const mockSummary = {
    transcription_text: '今日は本当に充実した一日でした。朝から気分が良く、新しいプロジェクトの企画会議では自分のアイデアが採用されて嬉しかったです。',
    formatted_text: '今日は本当に充実した一日でした。\n\n朝から気分が良く、新しいプロジェクトの企画会議では自分のアイデアが採用されて嬉しかったです。チームのみんなも前向きで、これから始まる挑戦にワクワクしています。\n\n午後は久しぶりに友人とカフェで話しました。最近の出来事や将来の夢について語り合い、改めて自分の目標が明確になった気がします。こういう時間を大切にしたいと思いました。\n\n夜は家でゆっくり読書をして、心が落ち着きました。明日も頑張れそうです。',
    avg_arousal: 0.65,
    avg_valence: 0.78,
    avg_dominance: 0.72,
    emotion_distribution: {
      joy: 0.45,
      excitement: 0.30,
      calm: 0.15,
      satisfaction: 0.10
    },
    total_recordings: 3,
    total_duration_seconds: 420,
    ai_insights: 'ポジティブな感情が多く、特に喜びと興奮が際立っています。新しいプロジェクトへの期待感と、友人との交流による充実感が感じられます。全体的に前向きで安定した心理状態が伺えます。'
  };

  const mockDialogueTurns = [
    {
      role: 'assistant' as const,
      content: 'こんにちは。今日はどんな一日でしたか？',
      created_at: '2025-01-15T09:00:00Z',
      input_type: 'text'
    },
    {
      role: 'user' as const,
      content: '今日は本当に充実した一日でした。朝から気分が良く、新しいプロジェクトの企画会議では自分のアイデアが採用されて嬉しかったです。',
      created_at: '2025-01-15T09:02:30Z',
      input_type: 'voice'
    },
    {
      role: 'assistant' as const,
      content: 'アイデアが採用されたんですね！おめでとうございます。どんなプロジェクトなんですか？',
      created_at: '2025-01-15T09:03:00Z',
      input_type: 'text'
    },
    {
      role: 'user' as const,
      content: '新しいモバイルアプリの開発プロジェクトです。ユーザー体験を向上させるための機能を提案しました。',
      created_at: '2025-01-15T09:05:15Z',
      input_type: 'voice'
    }
  ];

  const mockTranscriptionSegments = [
    {
      id: 'segment-1',
      user_id: 'mock-user-id',
      recording_id: 'recording-1',
      segment_index: 0,
      text: '今日は本当に充実した一日でした。',
      arousal: 0.68,
      valence: 0.82,
      dominance: 0.75,
      emotion_label: 'joy',
      start_time: 0.0,
      end_time: 3.2,
      created_at: '2025-01-15T09:02:30Z',
      updated_at: '2025-01-15T09:02:30Z'
    },
    {
      id: 'segment-2',
      user_id: 'mock-user-id',
      recording_id: 'recording-1',
      segment_index: 1,
      text: '朝から気分が良く、新しいプロジェクトの企画会議では自分のアイデアが採用されて嬉しかったです。',
      arousal: 0.72,
      valence: 0.85,
      dominance: 0.78,
      emotion_label: 'excitement',
      start_time: 3.2,
      end_time: 8.5,
      created_at: '2025-01-15T09:02:45Z',
      updated_at: '2025-01-15T09:02:45Z'
    },
    {
      id: 'segment-3',
      user_id: 'mock-user-id',
      recording_id: 'recording-2',
      segment_index: 0,
      text: '午後は久しぶりに友人とカフェで話しました。',
      arousal: 0.55,
      valence: 0.70,
      dominance: 0.68,
      emotion_label: 'calm',
      start_time: 0.0,
      end_time: 4.1,
      created_at: '2025-01-15T14:30:00Z',
      updated_at: '2025-01-15T14:30:00Z'
    },
    {
      id: 'segment-4',
      user_id: 'mock-user-id',
      recording_id: 'recording-2',
      segment_index: 1,
      text: '最近の出来事や将来の夢について語り合い、改めて自分の目標が明確になった気がします。',
      arousal: 0.62,
      valence: 0.76,
      dominance: 0.70,
      emotion_label: 'satisfaction',
      start_time: 4.1,
      end_time: 9.8,
      created_at: '2025-01-15T14:30:30Z',
      updated_at: '2025-01-15T14:30:30Z'
    }
  ];

  return (
    <DiaryDetailPage
      user={mockUser}
      date={mockDate}
      summary={mockSummary}
      dialogueTurns={mockDialogueTurns}
      transcriptionSegments={mockTranscriptionSegments}
    />
  );
}
