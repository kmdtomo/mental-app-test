'use client';

import { Home, Calendar, MessageCircle, BarChart3, User, LucideIcon } from 'lucide-react';

type NavigationItem = {
  id: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
};

const navigationItems: NavigationItem[] = [
  { id: 'home', icon: Home, label: 'ホーム' },
  { id: 'calendar', icon: Calendar, label: 'カレンダー' },
  { id: 'chat', icon: MessageCircle, label: 'チャット', active: true },
  { id: 'analytics', icon: BarChart3, label: '分析' },
  { id: 'profile', icon: User, label: 'プロフィール' },
];

export function MobileBottomNavigation() {
  return (
    <div className="flex fixed bottom-0 flex-col w-full z-10">
      <div className="bg-[#FFFDFB] shadow-[0_-2px_8px_rgba(61,51,48,0.06)]">
        <nav className="flex justify-around py-4 px-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.active;

            return (
              <button
                key={item.id}
                className="flex flex-col grow shrink items-center gap-1 hover:bg-[#C4856B]/5 rounded-lg px-2 py-1 transition-colors"
              >
                <Icon
                  className={isActive ? 'text-[#C4856B]' : 'text-[#9A8D88]'}
                  size={24}
                />
                <span
                  className={`text-xs font-normal ${
                    isActive ? 'text-[#C4856B]' : 'text-[#9A8D88]'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div style={{ height: 'env(safe-area-inset-bottom)' }}></div>
      </div>
    </div>
  );
}
