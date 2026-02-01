## 2024-05-22 - Path Traversal in Electron IPC Handlers
**Vulnerability:** IPC handlers (`deleteRecording`) accepted arbitrary file paths from the renderer, allowing deletion of any file the user had permission to access via path traversal (`../`).
**Learning:** Electron IPC handlers that accept file paths are a critical boundary. Input must never be trusted.
**Prevention:** Always resolve paths using `path.resolve` and verify they are children of a strictly allowed directory using `startsWith(allowedDir + path.sep)`.
