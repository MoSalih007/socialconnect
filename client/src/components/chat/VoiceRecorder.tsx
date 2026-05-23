import { useState, useRef, useEffect } from 'react';
import { Mic, Square, X } from 'lucide-react';

interface VoiceRecorderProps {
    onSend: (audioBase64: string) => void;
    disabled?: boolean;
}

export function VoiceRecorder({ onSend, disabled }: VoiceRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [isSending, setIsSending] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                    ? 'audio/webm;codecs=opus'
                    : 'audio/webm',
            });

            chunksRef.current = [];
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                // Stop all tracks to release the microphone
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setDuration(0);

            // Start timer
            timerRef.current = setInterval(() => {
                setDuration((prev) => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Microphone access denied:', error);
            alert('Please allow microphone access to send voice messages.');
        }
    };

    const stopAndSend = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;

        const recorder = mediaRecorderRef.current;

        // Override the onstop to include the send logic
        recorder.onstop = () => {
            // Stop all tracks
            recorder.stream.getTracks().forEach((track) => track.stop());

            // Create blob and convert to base64
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                setIsSending(true);
                try {
                    await onSend(base64);
                } finally {
                    setIsSending(false);
                }
            };
            reader.readAsDataURL(blob);
        };

        recorder.stop();
        setIsRecording(false);
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            const recorder = mediaRecorderRef.current;
            recorder.onstop = () => {
                recorder.stream.getTracks().forEach((track) => track.stop());
            };
            recorder.stop();
        }
        setIsRecording(false);
        setDuration(0);
        chunksRef.current = [];
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Recording State UI
    if (isRecording) {
        return (
            <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 rounded-full px-4 py-2 animate-pulse">
                {/* Recording indicator */}
                <div className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {formatTime(duration)}
                </span>

                {/* Animated waveform bars */}
                <div className="flex items-center gap-0.5">
                    {[...Array(12)].map((_, i) => (
                        <div
                            key={i}
                            className="w-1 bg-red-400 dark:bg-red-500 rounded-full"
                            style={{
                                height: `${Math.random() * 16 + 6}px`,
                                animation: `waveform 0.5s ease-in-out ${i * 0.05}s infinite alternate`,
                            }}
                        />
                    ))}
                </div>

                {/* Cancel button */}
                <button
                    type="button"
                    onClick={cancelRecording}
                    className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-800/40 transition"
                    title="Cancel recording"
                >
                    <X className="w-4 h-4 text-red-500" />
                </button>

                {/* Stop & Send button */}
                <button
                    type="button"
                    onClick={stopAndSend}
                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition"
                    title="Stop and send"
                >
                    <Square className="w-4 h-4" />
                </button>

                {/* Waveform animation keyframes */}
                <style>{`
          @keyframes waveform {
            from { height: 6px; }
            to { height: 22px; }
          }
        `}</style>
            </div>
        );
    }

    // Default (idle) UI
    return (
        <button
            type="button"
            onClick={startRecording}
            disabled={disabled || isSending}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-50"
            title="Record voice message"
        >
            {isSending ? (
                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            ) : (
                <Mic className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            )}
        </button>
    );
}
