import { Suspense } from 'react';
import { VoiceDiaryPage } from '@/views/VoiceDiaryPage';
import { handleAuthValidation } from '@/utils/server/auth';
import { getTodayRecordingCount, DAILY_RECORDING_LIMIT } from '@/lib/db/recordings';

export default async function Page() {
  const user = await handleAuthValidation();

  // 今日の録音回数を取得
  const usedCount = await getTodayRecordingCount(user.id);
  const remaining = Math.max(0, DAILY_RECORDING_LIMIT - usedCount);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VoiceDiaryPage
        user={user}
        recordingLimit={{
          used: usedCount,
          remaining: remaining,
          total: DAILY_RECORDING_LIMIT
        }}
      />
    </Suspense>
  );
}