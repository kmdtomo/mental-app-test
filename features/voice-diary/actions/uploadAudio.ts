'use client';

export async function uploadAudio(
  audioBlob: Blob,
  turnNumber: number = 1,
  dialogueId?: string
): Promise<{
  recordingId: string;
  filePath: string;
  publicUrl: string;
}> {
  console.log('Uploading audio:', { 
    size: audioBlob.size, 
    type: audioBlob.type,
    turnNumber 
  });

  const formData = new FormData();
  formData.append('audio', audioBlob, `recording_${turnNumber}.wav`);
  formData.append('turnNumber', turnNumber.toString());
  if (dialogueId) {
    formData.append('dialogueId', dialogueId);
  }

  const response = await fetch('/api/upload-audio', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload audio');
  }

  const data = await response.json();
  console.log('Upload successful:', data);
  return data;
}