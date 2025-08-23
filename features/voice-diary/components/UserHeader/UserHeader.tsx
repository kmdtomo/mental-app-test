'use client';

import { Button } from '@/components/ui/Button';
import { LogOut, User, Mic } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UserHeaderProps {
  user: {
    email?: string;
    user_metadata?: {
      name?: string;
      full_name?: string;
    };
  };
}

export function UserHeader({ user }: UserHeaderProps) {
  const router = useRouter();
  
  const displayName = user.user_metadata?.name || 
                     user.user_metadata?.full_name || 
                     user.email?.split('@')[0] || 
                     'ユーザー';
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
    });
    
    if (response.ok) {
      router.push('/signin');
    }
  };

  return (
    <div className="glass border-b">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* 左側: アイコン + タイトル */}
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Mic className="size-4" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">音声日記</h1>
          </div>

          {/* 右側: ユーザー名 + ログアウト */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-sm">
              <div className="text-right leading-tight">
                <div className="font-medium">{displayName}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
              <div className="flex size-8 items-center justify-center rounded-full bg-muted ml-2 text-foreground/80">
                <span className="text-[11px] font-semibold leading-none">{initials}</span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2 text-muted-foreground hover:text-primary hover:bg-primary/10"
            >
              <LogOut className="h-4 w-4" />
              ログアウト
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}