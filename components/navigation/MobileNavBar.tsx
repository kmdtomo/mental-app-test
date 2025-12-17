'use client';

import { LayoutDashboard, MessageCircle, Settings } from 'lucide-react';
import Link from 'next/link';

interface MobileNavBarProps {
    activeItem?: 'dashboard' | 'dialogue' | 'settings';
}

export function MobileNavBar({ activeItem }: MobileNavBarProps) {
    const navigationItems = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'ホーム', href: '/dashboard-web', active: activeItem === 'dashboard' },
        { id: 'dialogue', icon: MessageCircle, label: '対話', href: '/ai-dialogue-web', active: activeItem === 'dialogue' },
        { id: 'settings', icon: Settings, label: '設定', href: '/user-detail-web', active: activeItem === 'settings' },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#F5EBE0] z-50 md:hidden pb-safe">
            <div className="flex justify-around items-center h-16">
                {navigationItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.active;

                    return (
                        <Link key={item.id} href={item.href} className="w-full">
                            <div className="flex flex-col items-center justify-center py-2 gap-1">
                                <Icon
                                    size={24}
                                    className={`transition-colors ${isActive ? 'text-[#C17B68]' : 'text-[#9A8D85]'}`}
                                />
                                <span className={`text-[10px] ${isActive ? 'font-semibold text-[#C17B68]' : 'text-[#9A8D85]'}`}>
                                    {item.label}
                                </span>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
