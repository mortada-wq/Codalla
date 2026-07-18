import crypto from "crypto";

/**
 * Generate a device fingerprint from browser and device properties.
 * This is computed on the client side and sent to the server for verification.
 */
export function generateDeviceFingerprintPayload(): string {
  // Note: This function is intended to be used on the CLIENT side
  // It returns the JS code to run in the browser
  return `
    (function() {
      const fingerprint = [
        navigator.userAgent,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        navigator.language,
        navigator.hardwareConcurrency || 'unknown',
        navigator.maxTouchPoints || 0,
      ].join('|');
      return fingerprint;
    })()
  `;
}

/**
 * Hash a fingerprint string for secure storage.
 */
export function hashFingerprint(fingerprint: string): string {
  return crypto.createHash("sha256").update(fingerprint).digest("hex");
}

/**
 * Verify if a device fingerprint is unique (not linked to another user).
 */
export async function verifyUniqueFingerprint(
  fingerprint: string,
  userId: string,
  db: any,
  deviceFingerprintsTable: any
): Promise<{ unique: boolean; linkedUserId?: string }> {
  const { eq } = await import("drizzle-orm");

  const fingerprintHash = hashFingerprint(fingerprint);
  const existing = await db.select().from(deviceFingerprintsTable)
    .where(eq(deviceFingerprintsTable.fingerprint, fingerprintHash));

  if (existing.length === 0) {
    return { unique: true };
  }

  if (existing[0].userId === userId) {
    return { unique: true };
  }

  return { unique: false, linkedUserId: existing[0].userId };
}
