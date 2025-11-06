'use client';

import { Card } from '@/components/ui/Card';
import { Sparkles } from 'lucide-react';

interface AIInsightsCardProps {
  insights: string | null;
}

export function AIInsightsCard({ insights }: AIInsightsCardProps) {
  if (!insights) {
    return null;
  }

  return (
    <Card className="glass soft-shadow rounded-[20px] p-6 bg-gradient-to-br from-primary/5 to-primary/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-full bg-primary/20">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">AIからの気づき</h2>
      </div>

      <div className="prose prose-sm max-w-none">
        <div className="text-foreground leading-relaxed whitespace-pre-wrap">
          {insights}
        </div>
      </div>
    </Card>
  );
}
