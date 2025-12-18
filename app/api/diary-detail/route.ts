import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getDailySummary } from '@/lib/db/dailySummary';

export async function GET(request: NextRequest) {
    try {
        const cookieStore = cookies();
        const supabase = createClient(cookieStore);

        // Auth check
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get date from query params
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        if (!date) {
            return NextResponse.json({ error: 'Date is required' }, { status: 400 });
        }

        // 1. Fetch summary
        const summary = await getDailySummary(user.id, date);

        // 2. Fetch dialogue turns
        const { data: dialogueTurns, error: dialogueError } = await supabase
            .from('dialogue_turns')
            .select('role, content, created_at, input_type, recording_id')
            .eq('user_id', user.id)
            .eq('date', date)
            .order('order_index', { ascending: true });

        if (dialogueError) throw dialogueError;

        // 3. Fetch transcription segments
        const recordingIds = (dialogueTurns || [])
            .filter(turn => turn.recording_id)
            .map(turn => turn.recording_id);

        let transcriptionSegments: any[] = [];
        if (recordingIds.length > 0) {
            const { data: segments, error: segmentsError } = await supabase
                .from('transcription_segments')
                .select('id, recording_id, segment_index, text, start_time, end_time, arousal, valence, dominance, emotion_label, created_at')
                .in('recording_id', recordingIds)
                .order('created_at', { ascending: true })
                .order('segment_index', { ascending: true });

            if (segmentsError) throw segmentsError;
            transcriptionSegments = segments || [];
        }

        return NextResponse.json({
            summary,
            dialogueTurns: dialogueTurns || [],
            transcriptionSegments
        });

    } catch (error) {
        console.error('Error fetching diary detail:', error);
        return NextResponse.json(
            { error: 'Failed to fetch diary details' },
            { status: 500 }
        );
    }
}
