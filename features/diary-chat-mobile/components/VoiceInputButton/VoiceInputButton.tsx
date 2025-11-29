'use client';

import { Mic } from 'lucide-react';

export function VoiceInputButton() {
  return (
    <div className="flex items-center gap-4">
      <button className="flex grow shrink justify-center items-center pt-4 pb-4 rounded-xl bg-[#C4856B] text-white/92 shadow-[0_4px_12px_rgba(61,51,48,0.08)] hover:bg-[#A86B53] transition-colors">
        <div className="flex items-center gap-2">
          <Mic className="text-xl" size={20} />
          <span className="text-base font-semibold">音声で話す（60秒まで）</span>
        </div>
      </button>
    </div>
  );
}
