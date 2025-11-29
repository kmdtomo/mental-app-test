'use client';

import { Heart, LayoutDashboard, MessageCircle, Settings } from 'lucide-react';
import Link from 'next/link';

type NavigationItem = {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  href: string;
  active?: boolean;
};

interface WebSidebarProps {
  activeItem?: 'dashboard' | 'dialogue' | 'settings';
}

export function WebSidebar({ activeItem }: WebSidebarProps) {
  const navigationItems: NavigationItem[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'ダッシュボード', href: '/dashboard-web', active: activeItem === 'dashboard' },
    { id: 'dialogue', icon: MessageCircle, label: '対話', href: '/ai-dialogue-web', active: activeItem === 'dialogue' },
    { id: 'settings', icon: Settings, label: '設定', href: '/user-detail-web', active: activeItem === 'settings' },
  ];

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
          <div className="flex items-center gap-3 p-4 rounded-[20px] bg-white/70 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
            <img
              src="https://static.paraflowcontent.com/public/resource/image/5fe13763-0225-4a8c-966e-680486fc79aa.jpeg"
              alt="User profile"
              className="w-10 h-10 object-cover rounded-full shadow-[0_2px_6px_rgba(193,123,104,0.15)]"
            />
            <div className="grow shrink">
              <div className="text-lg font-semibold text-[#3D3632]">田中 太郎</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
