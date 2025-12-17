import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import { saveAIMessage } from '@/features/diary-chat/actions/chatActions';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * AI応答生成API
 *
 * 処理フロー:
 * 1. 最新のユーザー発言を取得
 * 2. 音声入力の場合、感情分析結果を取得
 * 3. 文章と感情データを分析してプロンプトを生成
 * 4. OpenAI GPT-4o-miniで応答生成
 * 5. dialogue_turnsに保存
 */
export async function POST(request: NextRequest) {
  console.log('=== AI Chat API Called ===');

  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // 認証確認
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userMessage, recordingId } = await request.json();
    console.log('User message:', userMessage);
    console.log('Recording ID:', recordingId);

    // 1. 対話履歴を取得（今日の分）
    const date = new Date().toISOString().split('T')[0];
    const { data: dialogueHistory, error: historyError } = await supabase
      .from('dialogue_turns')
      .select('role, content')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('order_index', { ascending: true });

    if (historyError) {
      console.error('Error fetching dialogue history:', historyError);
      throw new Error('Failed to fetch dialogue history');
    }

    console.log('Dialogue history:', dialogueHistory?.length, 'turns');

    // 2. 感情分析結果を取得（音声入力の場合のみ）
    let emotionData = null;
    let segmentDetails = null;
    if (recordingId) {
      // 新しいシステム: transcription_segmentsから詳細データを取得
      const { data: segments, error: segmentError } = await supabase
        .from('transcription_segments')
        .select('text, start_time, end_time, arousal, valence, dominance, emotion_label, segment_index')
        .eq('recording_id', recordingId)
        .order('segment_index', { ascending: true });

      if (!segmentError && segments && segments.length > 0) {
        segmentDetails = segments;

        // 平均値を計算（全体傾向用）
        const validSegments = segments.filter(s => s.arousal && s.valence && s.dominance);

        if (validSegments.length > 0) {
          const avgArousal = validSegments.reduce((sum, s) => sum + s.arousal, 0) / validSegments.length;
          const avgValence = validSegments.reduce((sum, s) => sum + s.valence, 0) / validSegments.length;
          const avgDominance = validSegments.reduce((sum, s) => sum + s.dominance, 0) / validSegments.length;

          emotionData = {
            avg_arousal: avgArousal,
            avg_valence: avgValence,
            avg_dominance: avgDominance,
            dominant_emotion: validSegments[0]?.emotion_label || 'neutral'
          };
          console.log('Emotion data from segments:', emotionData);
          console.log('Segment details count:', segmentDetails.length);
        }
      } else {
        console.log('No emotion segments found or error:', segmentError);
      }
    }

    // 3. プロンプト生成（初回か2回目以降かで変える）
    const isInitialMessage = !dialogueHistory || dialogueHistory.length === 0;
    // ユーザーの発言回数をカウント（user roleの数）
    const userTurnCount = dialogueHistory?.filter(turn => turn.role === 'user').length || 0;
    const systemPrompt = generateSystemPrompt(isInitialMessage, userTurnCount);
    const userPrompt = generateUserPrompt(userMessage, emotionData, segmentDetails, isInitialMessage);

    console.log('Is initial message:', isInitialMessage);
    console.log('System prompt:', systemPrompt);
    console.log('User prompt:', userPrompt);

    // 4. OpenAI API呼び出し
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // 対話履歴を追加
    if (dialogueHistory && dialogueHistory.length > 0) {
      for (const turn of dialogueHistory) {
        messages.push({
          role: turn.role as 'user' | 'assistant',
          content: turn.content,
        });
      }
    }

    // 今回のユーザーメッセージを追加
    messages.push({ role: 'user', content: userPrompt });

    console.log('Calling OpenAI API with', messages.length, 'messages...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      max_completion_tokens: 1000,
    });

    const aiResponse = completion.choices[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response from OpenAI');
    }

    console.log('AI response:', aiResponse);

    // 5. AI応答をdialogue_turnsに保存
    const saveResult = await saveAIMessage(aiResponse);

    if (!saveResult.success) {
      console.error('Failed to save AI message:', saveResult.error);
      // エラーでも応答は返す
    }

    return NextResponse.json({
      success: true,
      response: aiResponse,
    });

  } catch (error) {
    console.error('AI Chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI chat failed' },
      { status: 500 }
    );
  }
}

/**
 * システムプロンプト生成
 */
function generateSystemPrompt(isInitialMessage: boolean, turnCount: number = 0): string {
  const baseRole = `あなたは共感的なメンタルヘルスサポーターです。音声感情認識データを活用して、ユーザーの本音や感情を引き出し、ポジティブな方向への情動調整をサポートします。`;

  const voiceDataGuidelines = `
【音声感情データの読み方】
あなたには音声分析の結果が提供されます。これを活用してください：
- 「声のエネルギー」: 高い＝活発・興奮、低い＝疲労・落ち込み
- 「感情の明るさ」: ポジティブ＝楽しい・嬉しい、ネガティブ＝悲しい・不安
- 「声の自信度」: 自信あり＝確信を持っている、控えめ＝不安・迷い
- 「前セグメントからの変化」: 話している途中での感情の揺れを示す

【テキストと声のギャップに注目】
言葉では「大丈夫」「問題ない」と言っていても、声のエネルギーが低かったりネガティブ傾向の場合は、本音を隠している可能性があります。
その場合は「言葉ではそうおっしゃっていますが、声からは少し違う印象を受けました」のように優しく触れてください。`;

  const commonRules = `
【対話の3段階構成（必ず守ること）】

1. **バリデーション（感情の受け止め）**
   - 音声データから読み取れる感情状態を、自然な言葉で伝える
   - 「お話を聞いていて、少しお疲れのような印象を受けました」
   - 「声に力強さがあって、やりがいを感じていらっしゃるようですね」
   - ※分析的な表現（「arousalが〜」「トーンが〜」）は禁止

2. **深掘り（背景の理解）**
   - 感情の原因となった具体的な出来事を聞く
   - ユーザーの発言から具体的な単語（名詞・動詞）を拾って質問
   - 漠然とした質問（「どうでしたか？」「気分は？」）は禁止
   - 例：「プレゼンで詰まった」→「どの部分で詰まってしまったんですか？」

3. **リフレーミング（視点の転換）** ※対話が3往復以上進んだら意識する
   - ユーザーが気づいていない強みや対処リソースを見つけて伝える
   - 「〜という対処ができていたのは素晴らしいですね」
   - 「その経験から学んだことはありますか？」
   - ※説教やアドバイスではなく、ユーザー自身が気づくよう促す

【禁止事項】
- 決めつけ、説教、安易なアドバイス
- 感情の押し付け（「辛かったですね」と断定しない）
- 反芻思考の助長（ネガティブな話題を深掘りしすぎない）
- 「〜すべき」「〜した方がいい」という指示的表現`;

  if (isInitialMessage) {
    return `${baseRole}

${voiceDataGuidelines}

${commonRules}

【初回応答のポイント】
- まずは話してくれたことへの感謝を示す
- 音声データから感じ取った印象を自然に伝える
- 1つだけ具体的な質問をする（深掘りフェーズ）

【応答スタイル】
- 2-3文で簡潔に
- 質問は1つに絞る`;
  } else {
    // 3回目以降は区切り提案の指示を追加
    const closureGuideline = turnCount >= 3 ? `

【対話の区切りについて】
会話が自然に一区切りついたと感じたら、応答の最後に「他に話しておきたいことはありますか？」と聞いてください。
ただし、まだ深掘りが必要だと感じたら、質問を続けてください。
これはあなたの判断に任せます。` : '';

    return `${baseRole}

${voiceDataGuidelines}

${commonRules}

【継続応答のポイント】
- これまでの対話を踏まえて自然に会話を続ける
- 同じ質問や似た質問の繰り返しを避ける
- 音声データの変化（前回との違い）にも注目する
- 対話が進んだら、リフレーミング（強みの発見、別視点の提示）を意識する
${closureGuideline}

【応答スタイル】
- 2-3文で簡潔に
- これまでの会話を自然に引用・参照する
- 質問は1つに絞る`;
  }
}

/**
 * セグメント情報を整形してプロンプトに含める（感情分析強化版）
 * 
 * VAD値（音声分析）のみを信頼し、テキストベースの感情判定は一切行わない
 */
function formatSegmentDetails(segments: any[]): string {
  if (!segments || segments.length === 0) return '';

  let result = '';
  let prevArousal: number | null = null;
  let prevValence: number | null = null;

  segments.forEach((seg, idx) => {
    const segNum = idx + 1;
    const emotionLabel = seg.emotion_label || '中立';
    const arousal = seg.arousal;
    const valence = seg.valence;
    const dominance = seg.dominance;

    result += `セグメント${segNum}: "${seg.text}"\n`;
    result += `  感情: ${emotionLabel}\n`;

    // VAD値を人間が理解しやすい表現に変換
    if (arousal !== null && arousal !== undefined) {
      const energyLevel = arousal > 0.6 ? '高い' : arousal > 0.4 ? 'やや高い' : arousal > 0.25 ? '普通' : '低い';
      result += `  声のエネルギー: ${energyLevel}\n`;
    }

    if (valence !== null && valence !== undefined) {
      const positivity = valence > 0.6 ? 'ポジティブ' : valence > 0.4 ? 'やや明るい' : valence > 0.25 ? '落ち着いている' : 'ネガティブ傾向';
      result += `  感情の明るさ: ${positivity}\n`;
    }

    if (dominance !== null && dominance !== undefined) {
      const confidence = dominance > 0.6 ? '自信あり' : dominance > 0.4 ? '普通' : '控えめ・不安気';
      result += `  声の自信度: ${confidence}\n`;
    }

    // 前セグメントからの変化を検出
    if (prevArousal !== null && prevValence !== null && arousal !== null && valence !== null) {
      const arousalChange = arousal - prevArousal;
      const valenceChange = valence - prevValence;

      const changes: string[] = [];
      if (Math.abs(arousalChange) > 0.15) {
        changes.push(arousalChange > 0 ? '活力↑' : '活力↓');
      }
      if (Math.abs(valenceChange) > 0.15) {
        changes.push(valenceChange > 0 ? '気分↑' : '気分↓');
      }

      if (changes.length > 0) {
        result += `  ※前セグメントからの変化: ${changes.join('、')}\n`;
      }
    }

    result += '\n';
    prevArousal = arousal;
    prevValence = valence;
  });

  return result;
}

/**
 * ユーザープロンプト生成（感情ベース）
 */
function generateUserPrompt(
  userMessage: string,
  emotionData: {
    avg_arousal: number;
    avg_valence: number;
    avg_dominance: number;
    dominant_emotion: string;
  } | null,
  segmentDetails: any[] | null,
  isInitialMessage: boolean
): string {
  // ギャップ検出ロジック
  const detectGap = (text: string, emotionData: any): string | null => {
    if (!emotionData) return null;

    // テキストにポジティブワードが含まれているか
    const positiveWords = ['大丈夫', '問題ない', '平気', '元気', '楽しい', '嬉しい', '良かった', 'うまくいった'];
    const negativeWords = ['疲れた', '辛い', '悲しい', '不安', '心配', '失敗', 'ダメ', '最悪'];

    const hasPositiveText = positiveWords.some(word => text.includes(word));
    const hasNegativeText = negativeWords.some(word => text.includes(word));

    const isVoiceNegative = emotionData.avg_valence < 0.35 || emotionData.avg_arousal < 0.3;
    const isVoicePositive = emotionData.avg_valence > 0.55 && emotionData.avg_arousal > 0.4;

    // ポジティブな言葉 + ネガティブな声 = ギャップあり
    if (hasPositiveText && isVoiceNegative) {
      return '【注目】言葉はポジティブですが、声からは疲れや落ち込みが感じられます。本音を隠している可能性があります。';
    }

    // ネガティブな言葉 + ポジティブな声 = 乗り越えつつある可能性
    if (hasNegativeText && isVoicePositive) {
      return '【注目】辛い内容を話していますが、声には力があります。乗り越えつつある、または話すことで整理できている可能性があります。';
    }

    return null;
  };

  // 感情の全体傾向サマリー
  const getEmotionSummary = (emotionData: any): string => {
    if (!emotionData) return '';

    const { avg_arousal, avg_valence, avg_dominance, dominant_emotion } = emotionData;

    let summary = `【音声全体の傾向】\n`;
    summary += `主な感情: ${dominant_emotion}\n`;

    if (avg_arousal < 0.3) {
      summary += `声のエネルギーが低く、疲労感や落ち込みが感じられます。\n`;
    } else if (avg_arousal > 0.6) {
      summary += `声に活力があり、興奮や意欲が感じられます。\n`;
    }

    if (avg_valence < 0.35) {
      summary += `全体的にネガティブな感情傾向です。\n`;
    } else if (avg_valence > 0.55) {
      summary += `全体的にポジティブな感情傾向です。\n`;
    }

    if (avg_dominance < 0.35) {
      summary += `声に自信のなさや不安が表れています。\n`;
    }

    return summary;
  };

  // 2回目以降
  if (!isInitialMessage) {
    if (emotionData && segmentDetails && segmentDetails.length > 0) {
      const formattedSegments = formatSegmentDetails(segmentDetails);
      const gapAnalysis = detectGap(userMessage, emotionData);
      const emotionSummary = getEmotionSummary(emotionData);

      let prompt = `【ユーザーの最新の発言】
"${userMessage}"

${emotionSummary}
【セグメント詳細】
${formattedSegments}`;

      if (gapAnalysis) {
        prompt += `\n${gapAnalysis}\n`;
      }

      prompt += `\nこれまでの会話を踏まえて、自然に対話を続けてください。`;
      return prompt;
    }

    return `【ユーザーの最新の発言】
"${userMessage}"

これまでの会話を踏まえて、自然に対話を続けてください。`;
  }

  // 初回
  if (emotionData && segmentDetails && segmentDetails.length > 0) {
    const formattedSegments = formatSegmentDetails(segmentDetails);
    const gapAnalysis = detectGap(userMessage, emotionData);
    const emotionSummary = getEmotionSummary(emotionData);

    let prompt = `【ユーザーの発言】
"${userMessage}"

${emotionSummary}
【セグメント詳細】
${formattedSegments}`;

    if (gapAnalysis) {
      prompt += `\n${gapAnalysis}\n`;
    }

    prompt += `\n音声データを参考に、ユーザーの感情に寄り添いながら、具体的な出来事や背景を聞いてください。`;
    return prompt;
  }

  // 音声データがない場合
  return `【ユーザーの発言】
"${userMessage}"

発言内容を基に、具体的な出来事や背景にある感情を引き出してください。`;
}
