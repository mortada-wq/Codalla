/**
 * Generate a device fingerprint from browser and device properties.
 * This is computed locally and sent to the backend for verification.
 */
export function generateDeviceFingerprint(): string {
  const fingerprint = [
    navigator.userAgent,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.language,
    navigator.hardwareConcurrency || 'unknown',
    navigator.maxTouchPoints || 0,
  ].join('|');

  return fingerprint;
}

/**
 * Format phone number to E.164 format (e.g., +1234567890)
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');

  // Add + prefix if not present
  if (!phoneNumber.startsWith('+')) {
    return '+' + digits;
  }

  return '+' + digits;
}

/**
 * Validate phone number format (basic validation)
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const digits = phoneNumber.replace(/\D/g, '');
  // Most countries have 10-15 digit phone numbers
  return digits.length >= 10 && digits.length <= 15;
}
