import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { UserDetailWebPage } from '@/views/UserDetailWebPage';

export const metadata = {
  title: 'ユーザー詳細 | メンタルアップテスト',
  description: 'アカウント情報と設定を管理'
};

export default async function Page() {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/signin');
  }

  // プロフィール情報を取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // ユーザー情報を整形
  const userData = {
    id: user.id,
    email: user.email || '',
    name: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || '',
    avatarUrl: profile?.avatar_url || null,
    createdAt: user.created_at || '',
  };

  return (
    <UserDetailWebPage
      user={userData}
    />
  );
}
