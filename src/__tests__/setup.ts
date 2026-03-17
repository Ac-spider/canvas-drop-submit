/**
 * Jest Test Setup
 * Configures the testing environment
 */

import '@testing-library/jest-dom';

// Extend window interface for Electron APIs
declare global {
  interface Window {
    electronAPI?: {
      storeToken?: (token: string) => Promise<void>;
      readFile?: jest.Mock;
    };
    electronApi?: {
      getPathForFile?: (file: File) => string;
    };
  }
}

// Setup Electron API mocks
beforeEach(() => {
  window.electronAPI = {
    storeToken: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn(),
  };
  window.electronApi = {
    getPathForFile: jest.fn().mockReturnValue('/mock/path/file.pdf'),
  };
});

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Suppress console errors during tests (optional)
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  // Filter out React warnings that are expected in tests
  const message = String(args[0]);
  if (
    message.includes('Warning: ReactDOM.render') ||
    message.includes('Warning: act') ||
    message.includes('not wrapped in act') ||
    message.includes('Attempted to synchronously unmount')
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};
