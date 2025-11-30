'use client';

import { Heart, LayoutDashboard, MessageCircle, Settings, LucideIcon } from 'lucide-react';
import Link from 'next/link';

type NavigationItem = {
  id: string;
  icon: LucideIcon;
  label: string;
  href: string;
  active?: boolean;
};

interface WebSidebarProps {
  activeItem?: 'dashboard' | 'dialogue' | 'settings';
  user?: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    createdAt?: string;
  };
}

export function WebSidebar({ activeItem, user }: WebSidebarProps) {
  const navigationItems: NavigationItem[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'ダッシュボード', href: '/dashboard-web', active: activeItem === 'dashboard' },
    { id: 'dialogue', icon: MessageCircle, label: '対話', href: '/ai-dialogue-web', active: activeItem === 'dialogue' },
    { id: 'settings', icon: Settings, label: '設定', href: '/user-detail-web', active: activeItem === 'settings' },
  ];

  // 表示名（名前がなければメールアドレスの@前を使用）
  const displayName = user?.name || user?.email?.split('@')[0] || 'ユーザー';

  // イニシャル
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <aside className="shrink-0 min-w-fit bg-[#FAF5F0] relative">
      <div className="flex flex-col w-64 h-screen">
        {/* Logo */}
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="flex justify-center items-center w-10 h-10 rounded-full bg-[#C17B68] shadow-[0_2px_8px_rgba(193,123,104,0.25)]">
              <Heart className="text-lg text-white/85" size={18} />
            </div>
            <span className="text-xl font-semibold text-[#3D3632]">Mental-Test</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-6 grow shrink overflow-y-auto">
          <div className="flex flex-col gap-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.active;

              return (
                <Link key={item.id} href={item.href}>
                  <div
                    className={`flex items-center gap-3 py-3 px-4 rounded-full cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#C17B68]/15 text-[#C17B68]'
                        : 'text-[#6B5F58] hover:bg-[#C17B68]/8'
                    }`}
                  >
                    <Icon className="text-base" size={20} />
                    <span className={`text-lg ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Profile Card - Fixed at Bottom */}
        <div className="px-6 pb-8">
          <Link href="/user-detail-web">
            <div className="flex items-center gap-3 p-4 rounded-[20px] bg-white/70 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)] hover:shadow-[0_4px_12px_rgba(193,123,104,0.18)] transition-shadow cursor-pointer">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="User profile"
                  className="w-10 h-10 object-cover rounded-full shadow-[0_2px_6px_rgba(193,123,104,0.15)]"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#C17B68]/20 flex items-center justify-center shadow-[0_2px_6px_rgba(193,123,104,0.15)]">
                  <span className="text-sm font-semibold text-[#C17B68]">{initials}</span>
                </div>
              )}
              <div className="grow shrink">
                <div className="text-lg font-semibold text-[#3D3632]">{displayName}</div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </aside>
  );
}
