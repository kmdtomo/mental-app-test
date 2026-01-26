'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WebSidebar } from '@/components/navigation/WebSidebar';
import { MobileNavBar } from '@/components/navigation/MobileNavBar';
import { Mail, Calendar, LogOut, Flame, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useEmotionWarmup } from '@/hooks/useEmotionWarmup';

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
  const warmup = useEmotionWarmup();

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
    <div className="flex flex-col md:flex-row w-full h-screen" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}>
      {/* Sidebar */}
      <WebSidebar activeItem="settings" user={user} />
      <MobileNavBar activeItem="settings" />

      {/* Main Content */}
      <main className="overflow-x-hidden overflow-y-auto grow shrink bg-[#FBF7F3] h-full pb-20 md:pb-0">
        <div className="py-4 px-4 md:py-8 md:px-12">
          {/* Page Header */}
          <div className="mb-4 md:mb-8">
            <h1 className="text-2xl md:text-4xl mb-1 md:mb-2 font-semibold text-[#3D3632]">ユーザー詳細</h1>
            <p className="text-sm md:text-lg text-[#6B5F58]">アカウント情報と設定を管理できます</p>
          </div>

          {/* Profile Card */}
          <div className="mb-4 md:mb-8 p-4 md:p-8 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="Profile"
                  className="w-24 h-24 md:w-20 md:h-20 object-cover rounded-full shadow-[0_2px_8px_rgba(193,123,104,0.15)] mb-2 md:mb-0"
                />
              ) : (
                <div className="w-24 h-24 md:w-20 md:h-20 rounded-full bg-[#C17B68]/20 flex items-center justify-center shadow-[0_2px_8px_rgba(193,123,104,0.15)] mb-2 md:mb-0">
                  <span className="text-3xl md:text-2xl font-semibold text-[#C17B68]">{initials}</span>
                </div>
              )}
              <div className="grow shrink min-w-0 flex flex-col items-center md:items-start text-center md:text-left w-full">
                <h2 className="text-xl md:text-2xl mb-2 md:mb-2 font-semibold text-[#3D3632] truncate w-full">{displayName}</h2>
                <div className="flex flex-col gap-2 items-center md:items-start w-full">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 md:w-5 md:h-5 text-[#6B5F58]" />
                    <span className="text-sm md:text-lg text-[#6B5F58] truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 md:w-5 md:h-5 text-[#6B5F58]" />
                    <span className="text-sm md:text-lg text-[#6B5F58]">登録日: {formatDate(user.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Emotion Engine Warmup Section */}
          <div className="mb-4 md:mb-8 p-4 md:p-8 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
            <h3 className="text-lg md:text-2xl mb-4 md:mb-6 font-semibold text-[#3D3632]">感情認識エンジン設定</h3>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#C17B68]/20 flex items-center justify-center shrink-0">
                  <Flame className="w-6 h-6 text-[#C17B68]" />
                </div>
                <div>
                  <h4 className="text-base md:text-xl font-semibold text-[#3D3632]">ウォームアップモード</h4>
                  <p className="text-sm md:text-base text-[#6B5F58] mt-1">
                    感情認識エンジンを常に起動状態に保ち、応答速度を向上させます。<br />
                    <span className="text-xs text-[#6B5F58]/70">※1分ごとに軽量リクエストを送信します</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 ml-16 md:ml-0">
                {/* Status indicator */}
                <div className="flex items-center gap-2 text-sm">
                  {warmup.lastStatus === 'warming' && (
                    <>
                      <Loader2 className="w-4 h-4 text-[#C17B68] animate-spin" />
                      <span className="text-[#6B5F58]">ウォームアップ中...</span>
                    </>
                  )}
                  {warmup.lastStatus === 'warm' && warmup.isEnabled && (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-green-600">稼働中</span>
                    </>
                  )}
                  {warmup.lastStatus === 'error' && (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-red-500">エラー</span>
                    </>
                  )}
                </div>

                {/* Toggle switch */}
                <button
                  onClick={warmup.toggleWarmup}
                  className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${
                    warmup.isEnabled ? 'bg-[#C17B68]' : 'bg-gray-300'
                  }`}
                  aria-label="ウォームアップモードを切り替え"
                >
                  <div
                    className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                      warmup.isEnabled ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Last warmup time */}
            {warmup.lastWarmupTime && warmup.isEnabled && (
              <div className="mt-4 ml-16 text-xs text-[#6B5F58]/70">
                最終ウォームアップ: {warmup.lastWarmupTime.toLocaleTimeString('ja-JP')}
              </div>
            )}

            {/* Error message */}
            {warmup.errorMessage && (
              <div className="mt-4 ml-16 p-3 rounded-lg bg-red-50 text-sm text-red-600">
                エラー: {warmup.errorMessage}
              </div>
            )}
          </div>

          {/* Logout Section */}
          <div className="p-4 md:p-8 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
            <h3 className="text-lg md:text-2xl mb-4 md:mb-6 font-semibold text-[#3D3632]">アカウント操作</h3>
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
