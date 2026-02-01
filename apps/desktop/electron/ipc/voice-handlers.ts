/**
 * IPC handlers for voice recording operations.
 *
 * Handles saving recordings to disk and managing recording metadata.
 *
 * @module electron/ipc/voice-handlers
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

/**
 * Voice recording metadata.
 */
export interface RecordingMetadata {
  /** Unique recording ID */
  id: string;

  /** File path to the audio file */
  filePath: string;

  /** Recording duration in milliseconds */
  duration: number;

  /** MIME type of the recording */
  mimeType: string;

  /** Timestamp when recording was created */
  createdAt: Date;

  /** File size in bytes */
  fileSize: number;
}

/**
 * Result of saving a recording.
 */
export interface SaveRecordingResult {
  success: boolean;
  metadata?: RecordingMetadata;
  error?: string;
}

/**
 * Gets the recordings directory path.
 *
 * Creates the directory if it doesn't exist.
 *
 * @returns {Promise<string>} Path to recordings directory
 */
export async function getRecordingsDir(): Promise<string> {
  const userDataPath = app.getPath('userData');
  const recordingsPath = path.join(userDataPath, 'recordings');

  // Ensure directory exists
  await fs.mkdir(recordingsPath, { recursive: true });

  return recordingsPath;
}

/**
 * Generates a unique recording ID.
 *
 * @returns {string} Unique ID
 */
function generateRecordingId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `rec-${timestamp}-${random}`;
}

/**
 * Gets the file extension for a MIME type.
 *
 * @param {string} mimeType - MIME type
 * @returns {string} File extension
 */
function getExtensionForMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    'audio/webm': '.webm',
    'audio/webm;codecs=opus': '.webm',
    'audio/ogg': '.ogg',
    'audio/ogg;codecs=opus': '.ogg',
    'audio/mp4': '.m4a',
    'audio/wav': '.wav',
  };

  return extensions[mimeType] || '.audio';
}

/**
 * Saves a recording to disk.
 *
 * @param {ArrayBuffer} audioData - Audio data as ArrayBuffer
 * @param {number} duration - Recording duration in milliseconds
 * @param {string} mimeType - MIME type of the recording
 * @returns {Promise<SaveRecordingResult>} Save result with metadata
 */
export async function saveRecording(
  audioData: ArrayBuffer,
  duration: number,
  mimeType: string
): Promise<SaveRecordingResult> {
  try {
    const recordingsDir = await getRecordingsDir();
    const id = generateRecordingId();
    const extension = getExtensionForMimeType(mimeType);
    const fileName = `${id}${extension}`;
    const filePath = path.join(recordingsDir, fileName);

    // Write audio data to file
    const buffer = Buffer.from(audioData);
    await fs.writeFile(filePath, buffer);

    const metadata: RecordingMetadata = {
      id,
      filePath,
      duration,
      mimeType,
      createdAt: new Date(),
      fileSize: buffer.length,
    };

    return {
      success: true,
      metadata,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to save recording: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Deletes a recording from disk.
 *
 * @param {string} filePath - Path to the recording file
 * @returns {Promise<boolean>} True if deleted successfully
 */
export async function deleteRecording(filePath: string): Promise<boolean> {
  try {
    const recordingsDir = await getRecordingsDir();
    const resolvedPath = path.resolve(filePath);

    // Prevent path traversal
    if (!resolvedPath.startsWith(path.join(recordingsDir, path.sep))) {
      console.warn('[Security] Attempted to delete file outside recordings directory:', filePath);
      return false;
    }

    await fs.unlink(resolvedPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lists all recordings in the recordings directory.
 *
 * @returns {Promise<RecordingMetadata[]>} Array of recording metadata
 */
export async function listRecordings(): Promise<RecordingMetadata[]> {
  try {
    const recordingsDir = await getRecordingsDir();
    const files = await fs.readdir(recordingsDir);

    const processingPromises = files
      .filter((file) => file.startsWith('rec-'))
      .map(async (file) => {
        const filePath = path.join(recordingsDir, file);
        const stats = await fs.stat(filePath);

        // Extract ID from filename
        const id = file.replace(/\.[^.]+$/, '');

        return {
          id,
          filePath,
          duration: 0, // Would need metadata storage for accurate duration
          mimeType: 'audio/webm', // Default, would need metadata storage
          createdAt: stats.birthtime,
          fileSize: stats.size,
        };
      });

    const recordings = await Promise.all(processingPromises);

    return recordings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
    return [];
  }
}

/**
 * Reads a recording file.
 *
 * @param {string} filePath - Path to the recording file
 * @returns {Promise<Buffer | null>} Recording data or null if not found
 */
export async function readRecording(filePath: string): Promise<Buffer | null> {
  try {
    const recordingsDir = await getRecordingsDir();
    const resolvedPath = path.resolve(filePath);

    // Prevent path traversal
    if (!resolvedPath.startsWith(path.join(recordingsDir, path.sep))) {
      console.warn('[Security] Attempted to read file outside recordings directory:', filePath);
      return null;
    }

    return await fs.readFile(resolvedPath);
  } catch {
    return null;
  }
}
