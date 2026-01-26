## 2024-05-23 - Path Traversal in Electron IPC
**Vulnerability:** Path Traversal in `deleteRecording` IPC handler.
**Learning:** Even in local Electron apps, IPC handlers must validate file paths strictly to prevent arbitrary file deletion by compromised renderer processes.
**Prevention:** Always resolve paths and check against a strict allowed base directory using `startsWith` with a trailing separator.
