/**
 * useSpeechSynthesis Hook - Text-to-Speech with Google Cloud TTS
 *
 * Provides high-quality German TTS functionality via Google Cloud Text-to-Speech API.
 * Falls back to browser Web Speech API if Google TTS is unavailable.
 *
 * @module hooks/useSpeechSynthesis
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Return type for useSpeechSynthesis hook.
 */
export interface UseSpeechSynthesisReturn {
  /**
   * Speaks the given text using TTS.
   */
  speak: (text: string) => Promise<void>;

  /**
   * Stops current speech playback.
   */
  stop: () => void;

  /**
   * Whether TTS is currently speaking.
   */
  speaking: boolean;

  /**
   * Whether TTS request is loading.
   */
  loading: boolean;

  /**
   * Error message if TTS failed.
   */
  error: string | null;

  /**
   * Whether to use Google Cloud TTS (true) or Web Speech API (false).
   */
  useGoogleTTS: boolean;

  /**
   * Toggle between Google TTS and Web Speech API.
   */
  setUseGoogleTTS: (value: boolean) => void;

  /**
   * Speaking rate (0.5 - 2.0, default: 1.0).
   */
  speakingRate: number;

  /**
   * Set speaking rate.
   */
  setSpeakingRate: (rate: number) => void;
}

/**
 * Hook for Text-to-Speech functionality.
 *
 * Provides German TTS with Google Cloud TTS as primary source
 * and browser Web Speech API as fallback.
 *
 * @returns {UseSpeechSynthesisReturn} TTS controls and state
 *
 * @example
 * ```tsx
 * const { speak, stop, speaking } = useSpeechSynthesis();
 *
 * // Speak assistant response
 * await speak("Ihre offenen Rechnungen betragen 5.432 Euro");
 *
 * // Stop speaking
 * stop();
 * ```
 */
export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useGoogleTTS, setUseGoogleTTS] = useState(true); // Default: Google Cloud TTS (high quality)
  const [speakingRate, setSpeakingRate] = useState(1.0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Speak using Google Cloud TTS.
   */
  const speakWithGoogleTTS = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        // Abort any previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const response = await fetch('/api/speech/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            languageCode: 'de-DE',
            speakingRate,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'TTS request failed');
        }

        const data = await response.json();

        if (!data.audioContent) {
          throw new Error('No audio content received');
        }

        // Create audio element and play
        const mimeType = data.mimeType || 'audio/wav';
        const audioBlob = base64ToBlob(data.audioContent, mimeType);
        const audioUrl = URL.createObjectURL(audioBlob);

        // Stop any existing audio
        if (audioRef.current) {
          audioRef.current.pause();
          URL.revokeObjectURL(audioRef.current.src);
        }

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        return new Promise((resolve) => {
          audio.onended = (): void => {
            setSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            resolve(true);
          };

          audio.onerror = (): void => {
            setSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            resolve(false);
          };

          audio.play().catch(() => {
            setSpeaking(false);
            resolve(false);
          });
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return false;
        }
        console.error('[useSpeechSynthesis] Google TTS error:', err);
        return false;
      }
    },
    [speakingRate]
  );

  /**
   * Speak using browser Web Speech API (fallback).
   */
  const speakWithWebSpeech = useCallback(
    (text: string): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!('speechSynthesis' in window)) {
          resolve(false);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'de-DE';
        utterance.rate = speakingRate;

        // Try to find German voice
        const voices = window.speechSynthesis.getVoices();
        const germanVoice = voices.find((v) => v.lang.startsWith('de'));
        if (germanVoice) {
          utterance.voice = germanVoice;
        }

        utterance.onend = (): void => {
          setSpeaking(false);
          resolve(true);
        };

        utterance.onerror = (): void => {
          setSpeaking(false);
          resolve(false);
        };

        window.speechSynthesis.speak(utterance);
      });
    },
    [speakingRate]
  );

  /**
   * Main speak function with automatic fallback.
   */
  const speak = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim()) return;

      setLoading(true);
      setError(null);
      setSpeaking(true);

      try {
        let success = false;

        // Try Google TTS first (if enabled)
        if (useGoogleTTS) {
          try {
            success = await speakWithGoogleTTS(text);
          } catch {
            console.log('[useSpeechSynthesis] Google TTS failed, trying fallback');
            success = false;
          }
        }

        // Fallback to Web Speech API
        if (!success) {
          console.log('[useSpeechSynthesis] Using Web Speech API');
          success = await speakWithWebSpeech(text);
        }

        if (!success) {
          setError('TTS nicht verfügbar');
          setSpeaking(false);
        }
      } catch (err) {
        console.error('[useSpeechSynthesis] Error:', err);
        setError(err instanceof Error ? err.message : 'TTS fehlgeschlagen');
        setSpeaking(false);
      } finally {
        setLoading(false);
      }
    },
    [useGoogleTTS, speakWithGoogleTTS, speakWithWebSpeech]
  );

  /**
   * Stop all speech playback.
   */
  const stop = useCallback((): void => {
    // Stop Google TTS audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Abort pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Stop Web Speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setSpeaking(false);
  }, []);

  return {
    speak,
    stop,
    speaking,
    loading,
    error,
    useGoogleTTS,
    setUseGoogleTTS,
    speakingRate,
    setSpeakingRate,
  };
}

/**
 * Convert base64 string to Blob for audio playback.
 *
 * @param {string} base64 - Base64 encoded audio data
 * @param {string} mimeType - MIME type (e.g., 'audio/wav')
 * @returns {Blob} Audio blob
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
