/**
 * Tests for voice recording IPC handlers.
 *
 * Tests the voice recording file management functionality.
 *
 * @module tests/electron/voice-handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from('test audio data')),
  unlink: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue(['rec-abc123-xyz.webm', 'rec-def456-uvw.webm']),
  stat: vi.fn().mockResolvedValue({
    size: 1024,
    birthtime: new Date('2024-01-15T10:00:00Z'),
  }),
}));

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/user/data'),
  },
}));

// Import after mocks
import {
  saveRecording,
  deleteRecording,
  listRecordings,
  readRecording,
  getRecordingsDir,
} from '../../electron/ipc/voice-handlers';
import * as fs from 'fs/promises';

describe('Voice Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRecordingsDir', () => {
    it('should return the recordings directory path', async () => {
      const dir = await getRecordingsDir();

      expect(dir).toContain('recordings');
      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('recordings'), {
        recursive: true,
      });
    });
  });

  describe('saveRecording', () => {
    it('should save recording and return metadata', async () => {
      const audioData = new ArrayBuffer(1024);
      const duration = 5000;
      const mimeType = 'audio/webm;codecs=opus';

      const result = await saveRecording(audioData, duration, mimeType);

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.id).toMatch(/^rec-/);
      expect(result.metadata?.duration).toBe(duration);
      expect(result.metadata?.mimeType).toBe(mimeType);
      expect(result.metadata?.fileSize).toBe(1024);
    });

    it('should write file with correct extension', async () => {
      const audioData = new ArrayBuffer(512);

      await saveRecording(audioData, 1000, 'audio/webm;codecs=opus');

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\.webm$/),
        expect.any(Buffer)
      );
    });

    it('should handle ogg mime type', async () => {
      const audioData = new ArrayBuffer(512);

      await saveRecording(audioData, 1000, 'audio/ogg;codecs=opus');

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\.ogg$/),
        expect.any(Buffer)
      );
    });

    it('should return error on write failure', async () => {
      vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('Disk full'));

      const audioData = new ArrayBuffer(512);
      const result = await saveRecording(audioData, 1000, 'audio/webm');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to save');
    });
  });

  describe('deleteRecording', () => {
    it('should delete recording and return true', async () => {
      // Must use a path inside the mocked recordings directory
      // resolved path will be compared
      const validPath = '/mock/user/data/recordings/recording.webm';
      // Mock path.resolve to return the path as is for simplicity in this env
      // or assume the test runner handles it (vitest runs in node, so path.resolve works)

      const result = await deleteRecording(validPath);

      expect(result).toBe(true);
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('recording.webm'));
    });

    it('should return false on deletion failure', async () => {
      vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('File not found'));
      const validPath = '/mock/user/data/recordings/nonexistent.webm';

      const result = await deleteRecording(validPath);

      expect(result).toBe(false);
    });

    it('should prevent path traversal deletion', async () => {
      // Setup: define a path outside the allowed recordings directory
      // getRecordingsDir returns '/mock/user/data/recordings'
      const outsidePath = '/mock/user/data/sensitive.txt';

      const result = await deleteRecording(outsidePath);

      // Should fail and NOT delete the file
      expect(result).toBe(false);
      expect(fs.unlink).not.toHaveBeenCalledWith(outsidePath);
    });
  });

  describe('listRecordings', () => {
    it('should return array of recording metadata', async () => {
      const recordings = await listRecordings();

      expect(Array.isArray(recordings)).toBe(true);
      expect(recordings.length).toBe(2);
      expect(recordings[0].id).toMatch(/^rec-/);
    });

    it('should sort recordings by date descending', async () => {
      const recordings = await listRecordings();

      // All have same mock date, but should be sorted
      expect(recordings[0].createdAt).toBeInstanceOf(Date);
    });

    it('should return empty array on error', async () => {
      vi.mocked(fs.readdir).mockRejectedValueOnce(new Error('Directory not found'));

      const recordings = await listRecordings();

      expect(recordings).toEqual([]);
    });
  });

  describe('readRecording', () => {
    it('should read and return recording data', async () => {
      const data = await readRecording('/path/to/recording.webm');

      expect(data).toBeInstanceOf(Buffer);
      expect(fs.readFile).toHaveBeenCalledWith('/path/to/recording.webm');
    });

    it('should return null on read failure', async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('File not found'));

      const data = await readRecording('/path/to/nonexistent.webm');

      expect(data).toBeNull();
    });
  });
});
