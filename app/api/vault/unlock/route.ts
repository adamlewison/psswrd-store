import { getAuthedUser, computeHmac, checkLockout } from "@/lib/vault-server";

// In-memory rate limiter: userId → timestamps of unlock attempts in the past hour.
// Limits to 20 calls/hour per user regardless of reported result.
const hourlyAttempts = new Map<string, number[]>();

function enforceHourlyLimit(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - 3_600_000;
  const attempts = (hourlyAttempts.get(userId) ?? []).filter((t) => t > cutoff);
  if (attempts.length >= 20) return false;
  attempts.push(now);
  hourlyAttempts.set(userId, attempts);
  return true;
}

/**
 * POST { pin: string }
 * → { hmac: string (base64), kekSalt: string (base64),
 *     wrappedDek: string (base64), dekIv: string (base64) }
 *
 * Client derives KEK = Argon2id(hmac, kekSalt), decrypts wrapped DEK,
 * then reports success/failure to /api/vault/unlock/result.
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthedUser();

    if (!user.wrappedDek || !user.dekIv || !user.kekSalt) {
      return Response.json({ error: "Vault not set up" }, { status: 404 });
    }

    // Hard hourly rate limit (before lockout check — protects against malicious clients)
    if (!enforceHourlyLimit(user.id)) {
      return Response.json(
        { error: "Too many unlock attempts. Try again later." },
        { status: 429 },
      );
    }

    const lockoutMsg = checkLockout(user);
    if (lockoutMsg) {
      return Response.json(
        { error: lockoutMsg, requiresReauth: user.pinAttempts >= 20 },
        { status: 403 },
      );
    }

    const { pin } = (await request.json()) as { pin?: string };
    if (!pin || typeof pin !== "string") {
      return Response.json({ error: "PIN required" }, { status: 400 });
    }

    const kekSalt = Buffer.from(user.kekSalt as Buffer);
    const hmac = computeHmac(kekSalt, pin);

    return Response.json({
      hmac: hmac.toString("base64"),
      kekSalt: kekSalt.toString("base64"),
      wrappedDek: Buffer.from(user.wrappedDek as Buffer).toString("base64"),
      dekIv: Buffer.from(user.dekIv as Buffer).toString("base64"),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return Response.json({ error: msg }, { status });
  }
}
