import { SESSION_CODE_LENGTH } from './types';

/**
 * Generates a random 6-character session code
 */
export function generateSessionCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < SESSION_CODE_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Validates a session code format
 */
export function isValidSessionCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}

/**
 * Validates message content
 */
export function validateMessage(content: string): boolean {
  return content.length > 0 && content.length <= 1000;
}

/**
 * Generates a unique frame ID
 */
export function generateFrameId(sessionId: string, sequenceNumber: number): string {
  return `${sessionId}-frame-${sequenceNumber}`;
}