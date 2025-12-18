import { useState, useMemo } from 'react';
import { BookOpen, Sparkles, Activity, ChevronDown, ChevronUp, User, Pencil, Check, X, Mic, Calendar as CalendarIcon } from 'lucide-react';
import { EmotionChart, SummaryRadar } from '@/features/diary-detail-web/components';
import { getEmotionHexColorForUI } from '@/lib/emotionLabeling';
import { DailySummary } from '@/lib/db/dailySummary';

interface EmotionPoint {
    id: string;
    timestamp: number;
    formattedTime: string;
    arousal: number;
    valence: number;
    dominance?: number;
    speaker: 'user' | 'model';
    text: string;
    emotionLabel?: string;
}

interface DialogueTurn {
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
    input_type: string | null;
    recording_id: string | null;
}

interface TranscriptionSegment {
    id: string;
    recording_id: string;
    segment_index: number;
    text: string;
    start_time: number;
    end_time: number;
    arousal: number | null;
    valence: number | null;
    dominance: number | null;
    emotion_label: string | null;
    created_at: string;
}

interface DiaryDetailViewProps {
    date: string;
    summary: DailySummary | null;
    dialogueTurns: DialogueTurn[];
    transcriptionSegments: TranscriptionSegment[];
    onClose?: () => void;
    onUpdateDiary?: (date: string, text: string) => Promise<void>;
}

function ColoredTranscript({ segments }: { segments: TranscriptionSegment[] }) {
    return (
        <p className="text-base text-[#3D3632] leading-relaxed">
            {segments.map((segment, index) => {
                const emotionColor = getEmotionHexColorForUI(segment.emotion_label || '中立');
                const isNeutral = emotionColor === 'transparent';
                return (
                    <span
                        key={segment.id || index}
                        style={isNeutral ? {} : {
                            backgroundColor: `${emotionColor}20`,
                            borderBottom: `2px solid ${emotionColor}`,
                            paddingBottom: '2px',
                        }}
                        title={segment.emotion_label || '中立'}
                    >
                        {segment.text}
                    </span>
                );
            })}
        </p>
    );
}

function EmotionChartToggle({ segments }: { segments: TranscriptionSegment[] }) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Simple optimization: prevent heavy calculation if not expanded? 
    // No, we need to know if data exists. But segments length check is cheap.
    if (segments.length === 0) return null;

    const emotionData: EmotionPoint[] = segments
        .filter(s => s.arousal !== null && s.valence !== null)
        .map((segment, index) => ({
            id: segment.id || `seg-${index}`,
            timestamp: Date.now() - (segments.length - index) * 5000,
            formattedTime: `0:${String(index * 5).padStart(2, '0')}`,
            arousal: segment.arousal || 4,
            valence: segment.valence || 4,
            dominance: segment.dominance ?? undefined,
            speaker: 'user' as const,
            text: segment.text,
            emotionLabel: segment.emotion_label || '中立',
        }));

    if (emotionData.length === 0) return null;

    return (
        <div className="mt-2">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FBF7F3] hover:bg-[#F5EBE0] transition-colors border border-[#F5EBE0]"
            >
                <Activity className="w-3.5 h-3.5 text-[#C17B68]" />
                <span className="text-[11px] font-semibold text-[#C17B68]">感情の推移</span>
                {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[#C17B68]" />
                ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#C17B68]" />
                )}
            </button>

            {isExpanded && (
                <div className="mt-2 p-4 rounded-[16px] bg-white shadow-[0_2px_8px_rgba(193,123,104,0.1)] border border-[#F5EBE0] w-full">
                    <div className="h-[140px] w-full">
                        <EmotionChart data={emotionData} compact />
                    </div>
                </div>
            )}
        </div>
    );
}

export function DiaryDetailView({
    date,
    summary,
    dialogueTurns,
    transcriptionSegments,
    onClose,
    onUpdateDiary
}: DiaryDetailViewProps) {
    const [isEditingDiary, setIsEditingDiary] = useState(false);
    const [editedDiaryText, setEditedDiaryText] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleEditClick = () => {
        setEditedDiaryText(summary?.formatted_text || summary?.transcription_text || '');
        setIsEditingDiary(true);
    };

    const handleSave = async () => {
        if (!onUpdateDiary) return;
        setIsSaving(true);
        try {
            await onUpdateDiary(date, editedDiaryText);
            setIsEditingDiary(false);
        } catch (error) {
            console.error('Failed to save diary', error);
            alert('保存に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    const formatDateJP = (dateStr: string) => {
        const d = new Date(dateStr);
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${days[d.getDay()]})`;
    };

    const emotionData: EmotionPoint[] = useMemo(() => {
        const points: EmotionPoint[] = [];
        dialogueTurns.forEach((turn) => {
            const turnTimestamp = new Date(turn.created_at).getTime();
            if (turn.role === 'user' && turn.recording_id) {
                const segments = transcriptionSegments
                    .filter(s => s.recording_id === turn.recording_id)
                    .sort((a, b) => a.segment_index - b.segment_index);

                segments.forEach((segment) => {
                    const startTimeMs = (segment.start_time ?? segment.segment_index * 3) * 1000;
                    const segmentTimestamp = turnTimestamp + startTimeMs;
                    const segmentDate = new Date(turnTimestamp + startTimeMs);
                    const segmentFormattedTime = `${segmentDate.getHours().toString().padStart(2, '0')}:${segmentDate.getMinutes().toString().padStart(2, '0')}:${segmentDate.getSeconds().toString().padStart(2, '0')}`;

                    points.push({
                        id: segment.id,
                        timestamp: segmentTimestamp,
                        formattedTime: segmentFormattedTime,
                        arousal: segment.arousal ?? 0.5,
                        valence: segment.valence ?? 0.5,
                        dominance: segment.dominance ?? undefined,
                        speaker: 'user',
                        text: segment.text,
                        emotionLabel: segment.emotion_label || undefined
                    });
                });
            }
        });
        return points.sort((a, b) => a.timestamp - b.timestamp);
    }, [dialogueTurns, transcriptionSegments]);

    const hasData = dialogueTurns.length > 0 || summary !== null;

    if (!hasData) {
        const todayStr = new Date().toISOString().split('T')[0];
        const isToday = date === todayStr;

        return (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-[#F5EBE0] rounded-[32px] mx-auto max-w-2xl mt-8">
                <div className="w-20 h-20 rounded-full bg-[#FAF6F1] flex items-center justify-center mb-6">
                    <BookOpen className="w-10 h-10 text-[#C17B68]/40" />
                </div>
                <h3 className="text-xl font-bold text-[#3D3632] mb-2">{formatDateJP(date)}</h3>
                <p className="text-[#6B5F58] mb-6">まだ記録がありません。</p>

                {isToday && (
                    <a href="/ai-dialogue-web" className="flex items-center gap-2 bg-[#3D3632] hover:bg-[#2A2522] text-[#FBF7F3] px-6 py-3 rounded-full transition-all shadow-md hover:shadow-lg">
                        <Mic className="w-5 h-5" />
                        <span className="font-semibold text-sm">日記を記録</span>
                    </a>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Date Header for Detail View */}
            <div className="flex items-center gap-3 border-b border-[#F5EBE0] pb-4">
                <CalendarIcon className="text-[#C17B68]" size={24} />
                <h2 className="text-2xl font-bold text-[#3D3632]">{formatDateJP(date)}</h2>
            </div>

            {/* Top Section: Summary & Insights (Side-by-side on Desktop) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Diary Summary */}
                <div className="bg-[#FAF5F0] rounded-[24px] p-6 border border-[#C17B68]/10 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-[#C17B68]" />
                            <h3 className="font-bold text-[#3D3632]">日記</h3>
                        </div>
                        {!isEditingDiary ? (
                            <button onClick={handleEditClick} className="p-2 rounded-full hover:bg-[#C17B68]/10 transition-colors">
                                <Pencil className="w-4 h-4 text-[#C17B68]" />
                            </button>
                        ) : (
                            <div className="flex gap-1">
                                <button onClick={() => setIsEditingDiary(false)} className="p-2 hover:bg-black/5 rounded-full"><X size={16} /></button>
                                <button onClick={handleSave} className="p-2 hover:bg-green-100 text-green-600 rounded-full"><Check size={16} /></button>
                            </div>
                        )}
                    </div>
                    {isEditingDiary ? (
                        <textarea
                            value={editedDiaryText}
                            onChange={(e) => setEditedDiaryText(e.target.value)}
                            className="w-full flex-1 min-h-[150px] p-3 rounded-xl border border-[#C17B68]/20 bg-white text-base leading-relaxed focus:ring-2 focus:ring-[#C17B68]/30 outline-none resize-none"
                            disabled={isSaving}
                        />
                    ) : (
                        <p className="text-[#3D3632] leading-relaxed whitespace-pre-wrap text-base font-medium">
                            {summary?.formatted_text || summary?.transcription_text || '要約なし'}
                        </p>
                    )}
                </div>

                {/* AI Insights & Radar Stack */}
                <div className="flex flex-col gap-6">
                    {/* AI Message */}
                    <div className="bg-gradient-to-br from-[#C17B68] to-[#A66250] rounded-[24px] p-6 text-white shadow-[0_8px_20px_rgba(193,123,104,0.2)] relative overflow-hidden flex-1">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                        <div className="flex items-center gap-2 mb-3 relative z-10">
                            <Sparkles className="w-5 h-5" />
                            <h3 className="font-bold">AIからのメッセージ</h3>
                        </div>
                        <p className="text-white/95 leading-relaxed text-base relative z-10">
                            {summary?.ai_insights || 'メッセージなし'}
                        </p>
                    </div>

                    {/* Mini Radar */}
                    {/* Mini Radar */}
                    <div className="bg-white rounded-[24px] p-6 shadow-sm border border-[#F5EBE0] flex flex-col items-center">
                        <div className="w-full text-left mb-2">
                            <h4 className="font-bold text-[#3D3632] text-sm">感情バランス</h4>
                            <p className="text-xs text-[#6B5F58] leading-tight mt-1">
                                会話全体の感情傾向
                            </p>
                        </div>
                        <div className="w-full h-[180px] flex items-center justify-center">
                            {emotionData.length > 0 ? (
                                <SummaryRadar data={emotionData} />
                            ) : (
                                <div className="text-xs text-[#6B5F58]">データがありません</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Conversation Log */}
            <div className="md:bg-white md:rounded-[32px] md:p-8 md:shadow-sm md:border md:border-[#F5EBE0]">
                <h3 className="font-bold text-[#3D3632] mb-4 md:mb-6 flex items-center gap-2 text-xl">
                    <Mic className="text-[#C17B68]" />
                    対話履歴
                </h3>
                <div className="space-y-4 md:space-y-8">
                    {dialogueTurns.map((turn, index) => {
                        const segments = turn.role === 'user' && turn.recording_id
                            ? transcriptionSegments
                                .filter(s => s.recording_id === turn.recording_id)
                                .sort((a, b) => a.segment_index - b.segment_index)
                            : [];

                        return (
                            <div key={index} className={`flex flex-col ${turn.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`flex items-start gap-3 md:gap-4 max-w-[100%] md:max-w-[70%] ${turn.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    {/* Avatar */}
                                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white shadow-sm ring-2 ring-white ${turn.role === 'user' ? 'bg-[#C17B68]' : 'bg-gradient-to-br from-[#8C837C] to-[#6B5F58]'}`}>
                                        {turn.role === 'user' ? <User size={16} className="md:w-[18px] md:h-[18px]" /> : <Sparkles size={16} className="md:w-[18px] md:h-[18px]" />}
                                    </div>

                                    {/* Bubble */}
                                    <div className="flex flex-col min-w-0">
                                        <div className={`p-5 text-base shadow-sm ${turn.role === 'user' ? 'rounded-[24px] rounded-tr-none bg-[#FAF8F5] border border-[#E8DFD6]' : 'rounded-[24px] rounded-tl-none bg-[#F5EBE0]/50'}`}>
                                            {turn.role === 'user' && segments.length > 0 ? (
                                                <ColoredTranscript segments={segments} />
                                            ) : (
                                                <p className="text-[#3D3632] leading-relaxed">{turn.content}</p>
                                            )}
                                        </div>

                                        {/* ユーザー発話の場合、感情グラフトグルを表示 */}
                                        {turn.role === 'user' && segments.length > 0 && (
                                            <EmotionChartToggle segments={segments} />
                                        )}

                                        <span className={`text-xs text-[#9A8D85] mt-2 px-2 font-medium ${turn.role === 'user' ? 'text-right' : 'text-left'}`}>{formatTime(turn.created_at)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
