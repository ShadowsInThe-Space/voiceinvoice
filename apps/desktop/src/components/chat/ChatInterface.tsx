/**
 * Chat Interface Component for Voice Invoice Enterprise
 *
 * Provides a voice-enabled chat interface for RAG-based document analysis.
 * Users can ask questions about their invoices and documents through text or voice input.
 *
 * @module components/chat/ChatInterface
 */

import React, { useState, useEffect, useRef } from 'react';
import { MessageBubble, MessageBubbleProps } from './MessageBubble';
import { DocumentUpload } from './DocumentUpload';
import { VoiceRecorderButton } from '../VoiceRecorderButton';
import { GeminiClient, GeminiClientConfig } from '../../lib/ai/gemini-client';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { Send, Loader2, Volume2, VolumeX } from 'lucide-react';

/**
 * RAG-based chat interface component with voice support.
 *
 * Integrates with n8n workflow for RAG queries against Supabase Vector DB.
 * Supports both text and voice input via Google Gemini transcription.
 *
 * @returns {React.ReactElement} The chat interface component
 */
export function ChatInterface(): React.ReactElement {
  const [messages, setMessages] = useState<MessageBubbleProps[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [geminiClient, setGeminiClient] = useState<GeminiClient | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // TTS Hook
  const {
    speak,
    stop: stopSpeaking,
    speaking,
    setUseGoogleTTS,
    setSpeakingRate,
  } = useSpeechSynthesis();

  // Load Gemini client
  useEffect(() => {
    // Try to get key from storage first, then fallback to Demo Key, then legacy env var
    const storedApiKey = localStorage.getItem('voiceinvoice_google_api_key');
    const apiKey =
      storedApiKey ||
      process.env.NEXT_PUBLIC_DEMO_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

    // Chirp 3 requires Google Cloud project credentials (NEXT_PUBLIC_ for browser access)
    const projectId = process.env.NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT;
    const location = process.env.NEXT_PUBLIC_GOOGLE_CLOUD_LOCATION;
    const recognizer = process.env.NEXT_PUBLIC_CHIRP3_RECOGNIZER;

    if (apiKey) {
      // Build config object, only including defined properties
      // (exactOptionalPropertyTypes requires this approach)
      const config: GeminiClientConfig = { apiKey };
      if (projectId) config.projectId = projectId;
      if (location) config.location = location;
      if (recognizer) config.recognizer = recognizer;

      setGeminiClient(new GeminiClient(config));
    } else {
      console.error(
        'Missing API Key (Checked: localStorage, NEXT_PUBLIC_DEMO_API_KEY, NEXT_PUBLIC_GOOGLE_API_KEY)'
      );
    }
  }, []);

  // Load TTS settings from localStorage
  useEffect(() => {
    const savedProvider = localStorage.getItem('voiceinvoice_tts_provider');
    const savedRate = localStorage.getItem('voiceinvoice_tts_rate');
    const savedAutoSpeak = localStorage.getItem('voiceinvoice_auto_speak');

    // Default to Google Cloud TTS (high quality), fallback to Browser TTS automatically
    if (savedProvider) {
      setUseGoogleTTS(savedProvider === 'google');
    } else {
      setUseGoogleTTS(true); // Default: Google Cloud TTS
    }

    if (savedRate) {
      setSpeakingRate(parseFloat(savedRate));
    }

    // Restore auto-speak preference (default: true)
    if (savedAutoSpeak !== null) {
      setAutoSpeak(savedAutoSpeak === 'true');
    }
  }, [setUseGoogleTTS, setSpeakingRate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (text: string): Promise<void> => {
    if (!text.trim()) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Call RAG Mock API (uses local SQLite for offline/demo mode)
      const response = await fetch('/api/chat/rag-mock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: text }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Chat failed: ${response.statusText}`);
      }

      const data = await response.json();
      const answer = data.answer || 'Keine Antwort erhalten.';

      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);

      // Auto-speak assistant response if enabled
      if (autoSpeak && answer) {
        await speak(answer);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg = 'Entschuldigung, es ist ein Fehler aufgetreten.';
      setMessages((prev) => [...prev, { role: 'assistant', content: errorMsg }]);

      // Also speak error message if auto-speak enabled
      if (autoSpeak) {
        await speak(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceRecordingComplete = async (blob: Blob): Promise<void> => {
    if (!geminiClient) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Fehler: Gemini Client nicht initialisiert.' },
      ]);
      return;
    }

    setIsLoading(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async (): Promise<void> => {
        const base64Data = reader.result as string;
        const base64 = base64Data.split(',')[1]; // Remove data URL prefix

        const transcription = await geminiClient.transcribe(base64, blob.type);

        if (transcription.success && transcription.text) {
          handleSendMessage(transcription.text);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: 'Konnte Audio nicht verstehen.' },
          ]);
          setIsLoading(false);
        }
      };
    } catch (error) {
      console.error('Transcription error:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 md:p-8 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Finanz-Assistent</h1>

          {/* Auto-Speak Toggle */}
          <button
            onClick={() => {
              if (speaking) stopSpeaking();
              setAutoSpeak((prev) => {
                const newValue = !prev;
                localStorage.setItem('voiceinvoice_auto_speak', String(newValue));
                return newValue;
              });
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              autoSpeak
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
            title={autoSpeak ? 'Voice Output: Ein' : 'Voice Output: Aus'}
          >
            {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="hidden sm:inline">{autoSpeak ? 'Voice On' : 'Voice Off'}</span>
          </button>
        </div>

        <DocumentUpload />
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 rounded-xl border bg-card p-4 shadow-sm">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground opacity-50">
            <p>Stellen Sie eine Frage zu Ihren Finanzen oder Dokumenten.</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} role={msg.role} content={msg.content} />
        ))}
        {isLoading && (
          <div className="flex w-full flex-row gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-muted">
              <BotIcon className="h-6 w-6 animate-pulse" />
            </div>
            <div className="flex items-center">
              <span className="text-sm text-muted-foreground">Analysiere...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
              placeholder="Nachricht eingeben..."
              disabled={isLoading}
              className="w-full rounded-full border border-input bg-background px-4 py-3 pr-12 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <button
              onClick={() => handleSendMessage(inputValue)}
              disabled={isLoading || !inputValue.trim()}
              className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex justify-center">
          <VoiceRecorderButton
            onRecordingComplete={handleVoiceRecordingComplete}
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Bot icon component for chat interface.
 *
 * @param {React.SVGProps<SVGSVGElement>} props - SVG element props
 * @returns {React.ReactElement} The bot icon SVG element
 */
function BotIcon(props: React.SVGProps<SVGSVGElement>): React.ReactElement {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}
