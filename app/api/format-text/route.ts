import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  console.log('=== Format Text API Called ===');
  
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transcriptionId, originalText } = await request.json();
    
    if (!transcriptionId || !originalText) {
      return NextResponse.json({ error: 'Missing transcriptionId or originalText' }, { status: 400 });
    }
    
    console.log('Processing transcription:', { 
      transcriptionId, 
      textLength: originalText.length 
    });

    // Call Claude 3.5 Sonnet for text formatting
    console.log('Calling Claude 3.5 Sonnet...');
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `以下の音声文字起こしテキストを整形してください。

整形ルール：
1. フィラー除去：「えー」「えーっと」「あのー」「うーん」「まあ」などの言いよどみを削除
2. 句読点の追加：適切な位置に句読点を追加（ただし過剰にならないよう注意）
3. 音声認識の誤りを文脈から推測して修正：
   - 例：「解く」→「説く」（説明の文脈なら）
   - 例：「超す」→「越す」（期限を超えるの文脈なら）
   - 例：「以外」→「意外」（予想外の文脈なら）
4. 保持すべき要素：
   - 敬語・丁寧語（です・ます調）はそのまま維持
   - 話者の感情や個性が現れる表現は残す
   - 時系列や論理的な流れは変えない
5. 改行について：
   - 話題が大きく変わる箇所で改行を入れる
   - ただし、短い文章（3文以下）の場合は改行不要
   - 過剰な改行は避け、読みやすさを重視

テキスト：
${originalText}

整形後のテキストのみを返してください。`
      }],
    });

    const formattedText = message.content[0].type === 'text' 
      ? message.content[0].text.trim() 
      : '';
    
    console.log('Formatting completed:', formattedText.substring(0, 100) + '...');

    // Update transcriptions table
    const { error: updateError } = await supabase
      .from('transcriptions')
      .update({ formatted_text: formattedText })
      .eq('id', transcriptionId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log('Formatted text saved');

    // Get token usage from the response
    const inputTokens = message.usage?.input_tokens || 0;
    const outputTokens = message.usage?.output_tokens || 0;
    const totalTokens = inputTokens + outputTokens;

    return NextResponse.json({
      success: true,
      formattedText,
      claudeTokens: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens,
      },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}