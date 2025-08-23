import { Suspense } from 'react';
import { VoiceDiaryPage } from '@/views/VoiceDiaryPage';
import { handleAuthValidation } from '@/utils/server/auth';

export default async function Page() {
  const user = await handleAuthValidation();
  
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VoiceDiaryPage user={user} />
    </Suspense>
  );
}