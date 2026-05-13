import jwt from "jsonwebtoken";

import { AppError } from "./errors.js";

const DEFAULT_LOCAL_UPLOAD_EXPIRES_IN = "10m";
const DEFAULT_LOCAL_DOWNLOAD_EXPIRES_IN = "10m";

interface LocalUploadTokenPayload {
  fileName?: string;
  mimeType?: string;
  storageKey: string;
  type: "local-download" | "local-upload";
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error("Missing required environment variable: JWT_SECRET");
  }

  return secret;
}

function getLocalUploadExpiresIn(): string {
  return (
    process.env.LOCAL_UPLOAD_EXPIRES_IN?.trim() ||
    DEFAULT_LOCAL_UPLOAD_EXPIRES_IN
  );
}

function getLocalDownloadExpiresIn(): string {
  return (
    process.env.LOCAL_DOWNLOAD_EXPIRES_IN?.trim() ||
    DEFAULT_LOCAL_DOWNLOAD_EXPIRES_IN
  );
}

function parseDurationToSeconds(rawValue: string): number {
  if (/^\d+$/.test(rawValue)) {
    return Number(rawValue);
  }

  const match = rawValue.match(/^(\d+)([smhd])$/i);

  if (!match) {
    throw new Error(`Invalid token duration: ${rawValue}`);
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    d: 60 * 60 * 24,
    h: 60 * 60,
    m: 60,
    s: 1,
  };

  return value * multipliers[unit];
}

export function signLocalUploadToken(input: { storageKey: string }): string {
  return jwt.sign(
    {
      storageKey: input.storageKey,
      type: "local-upload",
    },
    getJwtSecret(),
    {
      expiresIn: getLocalUploadExpiresIn() as jwt.SignOptions["expiresIn"],
    },
  );
}

export function signLocalDownloadToken(input: {
  fileName: string;
  mimeType: string;
  storageKey: string;
}): string {
  return jwt.sign(
    {
      fileName: input.fileName,
      mimeType: input.mimeType,
      storageKey: input.storageKey,
      type: "local-download",
    },
    getJwtSecret(),
    {
      expiresIn: getLocalDownloadExpiresIn() as jwt.SignOptions["expiresIn"],
    },
  );
}

export function verifyLocalUploadToken(token: string): { storageKey: string } {
  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (typeof decoded !== "object" || decoded === null) {
      throw new AppError(
        401,
        "INVALID_UPLOAD_TOKEN",
        "Upload token is invalid",
      );
    }

    const { storageKey, type } = decoded as Partial<LocalUploadTokenPayload>;

    if (!storageKey || type !== "local-upload") {
      throw new AppError(
        401,
        "INVALID_UPLOAD_TOKEN",
        "Upload token is invalid",
      );
    }

    return { storageKey };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(401, "INVALID_UPLOAD_TOKEN", "Upload token is invalid");
  }
}

export function verifyLocalDownloadToken(token: string): {
  fileName: string;
  mimeType: string;
  storageKey: string;
} {
  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (typeof decoded !== "object" || decoded === null) {
      throw new AppError(
        401,
        "INVALID_DOWNLOAD_TOKEN",
        "Download token is invalid",
      );
    }

    const { fileName, mimeType, storageKey, type } =
      decoded as Partial<LocalUploadTokenPayload>;

    if (!fileName || !mimeType || !storageKey || type !== "local-download") {
      throw new AppError(
        401,
        "INVALID_DOWNLOAD_TOKEN",
        "Download token is invalid",
      );
    }

    return { fileName, mimeType, storageKey };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      401,
      "INVALID_DOWNLOAD_TOKEN",
      "Download token is invalid",
    );
  }
}

export function getLocalUploadTokenExpiresInSeconds(): number {
  return parseDurationToSeconds(getLocalUploadExpiresIn());
}

export function getLocalDownloadTokenExpiresInSeconds(): number {
  return parseDurationToSeconds(getLocalDownloadExpiresIn());
}
