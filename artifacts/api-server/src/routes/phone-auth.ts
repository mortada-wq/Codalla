import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, userPhonesTable, signupAuditTable, usersTable, deviceFingerprintsTable } from "@workspace/db";
import crypto from "crypto";

const router: IRouter = Router();

// Helper: Generate random OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper: Generate device fingerprint hash
function hashFingerprint(fingerprint: string): string {
  return crypto.createHash("sha256").update(fingerprint).digest("hex");
}

// Helper: Send SMS via Twilio (mock implementation — replace with real Twilio)
async function sendSmsOtp(phoneNumber: string, otp: string): Promise<void> {
  // In production, use: const twilio = require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // For now, log it (in development, show in console; in production, send real SMS)
  console.log(`[SMS OTP] ${phoneNumber}: ${otp}`);

  // TODO: Implement real Twilio SMS sending
  // await twilio.messages.create({
  //   body: `Your Codalla verification code is: ${otp}`,
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //   to: phoneNumber,
  // });
}

// POST /phone-auth/request-otp
// Body: { phoneNumber: string, deviceFingerprint: string }
// Send OTP to phone number, check for multi-accounting
router.post("/phone-auth/request-otp", async (req, res): Promise<void> => {
  const { phoneNumber, deviceFingerprint } = req.body ?? {};
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!phoneNumber || typeof phoneNumber !== "string") {
    res.status(400).json({ error: "phoneNumber is required" });
    return;
  }

  if (!deviceFingerprint || typeof deviceFingerprint !== "string") {
    res.status(400).json({ error: "deviceFingerprint is required" });
    return;
  }

  try {
    // Check if phone already registered to different user
    const existingPhone = await db.select().from(userPhonesTable)
      .where(eq(userPhonesTable.phoneNumber, phoneNumber));

    if (existingPhone.length > 0 && existingPhone[0].userId !== userId) {
      res.status(400).json({
        error: "This phone number is already registered to another account",
        code: "PHONE_ALREADY_REGISTERED"
      });
      return;
    }

    // Check if device fingerprint linked to different user
    const fingerprintHash = hashFingerprint(deviceFingerprint);
    const existingDevice = await db.select().from(deviceFingerprintsTable)
      .where(eq(deviceFingerprintsTable.fingerprint, fingerprintHash));

    if (existingDevice.length > 0 && existingDevice[0].userId !== userId) {
      res.status(400).json({
        error: "This device is already linked to another account. For security, each device can only have one account.",
        code: "DEVICE_ALREADY_LINKED"
      });
      return;
    }

    // Generate OTP and store temporarily
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create or update phone record
    const existingUserPhone = await db.select().from(userPhonesTable)
      .where(eq(userPhonesTable.userId, userId));

    if (existingUserPhone.length > 0) {
      await db.update(userPhonesTable)
        .set({
          phoneNumber,
          verificationCode: otp,
          verificationCodeExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(userPhonesTable.userId, userId));
    } else {
      await db.insert(userPhonesTable).values({
        id: uuidv4(),
        userId,
        phoneNumber,
        verificationCode: otp,
        verificationCodeExpiresAt: expiresAt,
      });
    }

    // Send OTP (in dev: logged to console)
    await sendSmsOtp(phoneNumber, otp);

    res.json({
      success: true,
      message: "OTP sent to your phone",
      expiresIn: 600, // seconds
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to send OTP" });
  }
});

// POST /phone-auth/verify-otp
// Body: { otp: string, deviceFingerprint: string }
// Verify OTP and mark phone as verified
router.post("/phone-auth/verify-otp", async (req, res): Promise<void> => {
  const { otp, deviceFingerprint } = req.body ?? {};
  const userId = req.user?.id;
  const ipAddress = req.ip || req.socket.remoteAddress;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!otp || typeof otp !== "string") {
    res.status(400).json({ error: "otp is required" });
    return;
  }

  try {
    // Get user's phone record
    const [userPhone] = await db.select().from(userPhonesTable)
      .where(eq(userPhonesTable.userId, userId));

    if (!userPhone) {
      res.status(404).json({ error: "Phone not found. Request OTP first." });
      return;
    }

    // Check OTP validity
    if (userPhone.verificationCode !== otp) {
      res.status(400).json({ error: "Invalid OTP" });
      return;
    }

    if (userPhone.verificationCodeExpiresAt && userPhone.verificationCodeExpiresAt < new Date()) {
      res.status(400).json({ error: "OTP expired. Request a new one." });
      return;
    }

    // Mark phone as verified
    await db.update(userPhonesTable)
      .set({
        verifiedAt: new Date(),
        verificationCode: null,
        verificationCodeExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(userPhonesTable.userId, userId));

    // Register device fingerprint
    if (deviceFingerprint) {
      const fingerprintHash = hashFingerprint(deviceFingerprint);
      const existingDevice = await db.select().from(deviceFingerprintsTable)
        .where(eq(deviceFingerprintsTable.fingerprint, fingerprintHash));

      if (existingDevice.length === 0) {
        await db.insert(deviceFingerprintsTable).values({
          id: uuidv4(),
          userId,
          fingerprint: fingerprintHash,
          userAgent: req.get("user-agent") || undefined,
          lastSeenAt: new Date(),
        });
      } else {
        await db.update(deviceFingerprintsTable)
          .set({ lastSeenAt: new Date() })
          .where(eq(deviceFingerprintsTable.fingerprint, fingerprintHash));
      }
    }

    // Log signup audit
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.id, userId));

    if (user) {
      await db.insert(signupAuditTable).values({
        id: uuidv4(),
        userId,
        email: user.email,
        phoneNumber: userPhone.phoneNumber,
        ipAddress: ipAddress as string,
        deviceFingerprint: deviceFingerprint ? hashFingerprint(deviceFingerprint) : undefined,
      });
    }

    res.json({ success: true, message: "Phone verified successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to verify OTP" });
  }
});

// GET /phone-auth/status
// Check if user's phone is verified
router.get("/phone-auth/status", async (req, res): Promise<void> => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [userPhone] = await db.select().from(userPhonesTable)
      .where(eq(userPhonesTable.userId, userId));

    res.json({
      phoneVerified: userPhone?.verifiedAt ? true : false,
      phoneNumber: userPhone?.phoneNumber,
      verifiedAt: userPhone?.verifiedAt?.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to check phone status" });
  }
});

export default router;
