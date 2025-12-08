'use client';

import { Heart, Settings } from 'lucide-react';

export function MobileHeader() {
  return (
    <div className="fixed top-0 w-full z-10 bg-[#FFFDFB] shadow-[0_2px_8px_rgba(61,51,48,0.06)]">
      <div style={{ height: 'env(safe-area-inset-top)' }}></div>

      <header className="flex justify-between items-center h-14 px-6">
        <div className="flex items-center gap-3">
          <div className="flex justify-center items-center w-8 h-8 rounded-full bg-[#C4856B]">
            <Heart className="text-lg text-white/92" size={18} />
          </div>
          <span className="text-xl font-semibold text-[#3D3330]">Mental-Test</span>
        </div>
        <button className="flex justify-center items-center w-10 h-10 rounded-full hover:bg-[#C4856B]/8 transition-colors">
          <Settings className="text-xl text-[#6B5F5A]" size={20} />
        </button>
      </header>
    </div>
  );
}
