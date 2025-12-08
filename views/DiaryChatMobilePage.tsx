'use client';

import {
  MobileHeader,
  EmotionChart,
  ChatMessageList,
  VoiceInputButton,
  RecordingLimitIndicator,
  DiaryActionButtons,
  MobileBottomNavigation,
} from '@/features/diary-chat-mobile/components';

export function DiaryChatMobilePage() {
  return (
    <div className="w-[390px] h-screen bg-[#FAF6F1] overflow-y-auto" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}>
      {/* Fixed Header */}
      <MobileHeader />

      {/* Header Spacer */}
      <div>
        <div style={{ height: 'env(safe-area-inset-top)' }}></div>
        <div className="h-14"></div>
      </div>

      {/* Main Content */}
      <main className="pt-4 pb-4">
        {/* Emotion Chart Section */}
        <EmotionChart />

        {/* AI Dialogue Section */}
        <section className="mb-4 px-4">
          <div className="bg-[#FFFDFB] p-5 rounded-2xl shadow-[0_4px_12px_rgba(61,51,48,0.08)]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold text-[#3D3330]">AIとの対話</h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#A8B394]"></div>
                <span className="text-sm text-[#6B5F5A]">オンライン</span>
              </div>
            </div>

            <ChatMessageList />

            <div className="mt-6">
              <VoiceInputButton />
              <RecordingLimitIndicator />
            </div>
          </div>
        </section>

        {/* Action Buttons Section */}
        <section className="px-4">
          <DiaryActionButtons />
        </section>
      </main>

      {/* Bottom Spacer */}
      <div>
        <div className="h-[72px] mt-[16px]"></div>
        <div style={{ height: 'env(safe-area-inset-bottom)' }}></div>
      </div>

      {/* Fixed Bottom Navigation */}
      <MobileBottomNavigation />
    </div>
  );
}
