import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DiaryChatPage } from '@/views/DiaryChatPage';

export const metadata = {
  title: 'AIとの対話 | メンタルアップテスト',
  description: 'AIと対話して今日の気持ちを整理しましょう'
};

export default async function DiaryChatRoute() {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/signin');
  }

  return <DiaryChatPage user={user} />;
}
