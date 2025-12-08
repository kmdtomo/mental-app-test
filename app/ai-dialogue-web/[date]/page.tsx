import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AIDialogueWebPage } from '@/views/AIDialogueWebPage';
import { getDialogueByDate } from '@/features/diary-chat/actions/chatActions';

interface PageProps {
  params: { date: string };
}

export async function generateMetadata({ params }: PageProps) {
  const date = params.date;
  const formattedDate = new Date(date).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return {
    title: `${formattedDate}の対話履歴 | メンタルアップテスト`,
    description: `${formattedDate}のAIとの対話履歴を確認します`
  };
}

export default async function Page({ params }: PageProps) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/signin');
  }

  // 日付のバリデーション（YYYY-MM-DD形式）
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(params.date)) {
    redirect('/ai-dialogue-web');
  }

  // プロフィール情報を取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // 指定日の対話履歴を取得
  const dialogueResult = await getDialogueByDate(params.date);

  // ユーザー情報を整形
  const userData = {
    id: user.id,
    email: user.email || '',
    name: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || '',
    avatarUrl: profile?.avatar_url || null,
    createdAt: user.created_at || '',
  };

  return (
    <AIDialogueWebPage
      user={userData}
      recordingLimit={{ used: 0, remaining: 0, total: 0 }}
      initialDate={params.date}
      initialMessages={dialogueResult.success ? dialogueResult.messages || [] : []}
    />
  );
}
