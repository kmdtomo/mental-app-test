import RealtimeRecordingDemo from '@/components/RealtimeRecordingDemo';

export default function RealtimeDemoPage() {
    return (
        <div className="container mx-auto p-4 min-h-screen">
            <h1 className="text-3xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
                Alpha-G リアルタイム感情分析デモ
            </h1>
            <RealtimeRecordingDemo />
        </div>
    );
}
