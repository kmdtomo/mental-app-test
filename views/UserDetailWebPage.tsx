'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WebSidebar } from '@/components/navigation/WebSidebar';
import { Mail, Calendar, Camera, LogOut } from 'lucide-react';

interface UserDetailWebPageProps {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    createdAt: string;
  };
}

export function UserDetailWebPage({ user }: UserDetailWebPageProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // 登録日をフォーマット
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  // 表示名（名前がなければメールアドレスの@前を使用）
  const displayName = user.name || user.email.split('@')[0] || 'ユーザー';

  // イニシャル
  const initials = displayName.slice(0, 2).toUpperCase();

  // ログアウト処理
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        router.push('/signin');
      }
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="flex w-[1440px] h-screen" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}>
      {/* Sidebar */}
      <WebSidebar activeItem="settings" user={user} />

      {/* Main Content */}
      <main className="overflow-x-hidden overflow-y-auto grow shrink bg-[#FBF7F3] h-full">
        <div className="py-8 px-12">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl mb-2 font-semibold text-[#3D3632]">ユーザー詳細</h1>
            <p className="text-lg text-[#6B5F58]">アカウント情報と設定を管理できます</p>
          </div>

          {/* Profile Card */}
          <div className="mb-8 p-8 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
            <div className="flex items-center gap-6">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="Profile"
                  className="w-20 h-20 object-cover rounded-full shadow-[0_2px_8px_rgba(193,123,104,0.15)]"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#C17B68]/20 flex items-center justify-center shadow-[0_2px_8px_rgba(193,123,104,0.15)]">
                  <span className="text-2xl font-semibold text-[#C17B68]">{initials}</span>
                </div>
              )}
              <div className="grow shrink">
                <h2 className="text-2xl mb-2 font-semibold text-[#3D3632]">{displayName}</h2>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Mail className="text-base text-[#6B5F58]" size={20} />
                    <span className="text-lg text-[#6B5F58]">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="text-base text-[#6B5F58]" size={20} />
                    <span className="text-lg text-[#6B5F58]">登録日: {formatDate(user.createdAt)}</span>
                  </div>
                </div>
              </div>
              <button className="flex justify-center items-center gap-2 py-3 px-6 rounded-full bg-white/70 text-[#C17B68] shadow-[0_2px_6px_rgba(193,123,104,0.12)] hover:shadow-[0_4px_12px_rgba(193,123,104,0.35)] transition-shadow">
                <Camera className="text-lg" size={18} />
                <span className="text-lg whitespace-nowrap font-semibold">写真を変更</span>
              </button>
            </div>
          </div>

          {/* Logout Section */}
          <div className="p-8 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
            <h3 className="text-2xl mb-6 font-semibold text-[#3D3632]">アカウント操作</h3>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex justify-center items-center gap-2 py-3 px-6 rounded-full bg-[#C17B68]/10 text-[#C17B68] hover:bg-[#C17B68]/20 transition-colors disabled:opacity-50"
            >
              <LogOut size={18} />
              <span className="text-lg font-semibold">
                {isLoggingOut ? 'ログアウト中...' : 'ログアウト'}
              </span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
