import { access, mkdir, writeFile } from "fs/promises";
import path from "path";

import { loadEnv } from "../lib/env.js";
import { AppError } from "../lib/errors.js";
import {
  verifyLocalDownloadToken,
  verifyLocalUploadToken,
} from "../lib/upload-token.js";

interface UploadLocalAttachmentBinaryInput {
  body: Buffer;
  mimeType?: string;
  token: string;
}

export interface UploadedBinaryResult {
  fileSizeBytes: number;
  mimeType: string;
  storageKey: string;
  uploaded: true;
}

export interface DownloadBinaryResult {
  absolutePath: string;
  fileName: string;
  mimeType: string;
}

function resolveStoragePath(uploadsDir: string, storageKey: string): string {
  const rootPath = path.resolve(uploadsDir);
  const filePath = path.resolve(rootPath, storageKey);

  if (!filePath.startsWith(`${rootPath}${path.sep}`)) {
    throw new AppError(400, "INVALID_STORAGE_KEY", "Storage key is invalid");
  }

  return filePath;
}

export async function uploadLocalAttachmentBinary(
  input: UploadLocalAttachmentBinaryInput,
): Promise<UploadedBinaryResult> {
  if (!input.body.length) {
    throw new AppError(400, "EMPTY_UPLOAD", "Upload body must not be empty");
  }

  const env = loadEnv();

  if (env.storageProvider !== "local") {
    throw new AppError(
      404,
      "UPLOAD_ROUTE_NOT_AVAILABLE",
      "Local upload route is only available when STORAGE_PROVIDER=local",
    );
  }

  const { storageKey } = verifyLocalUploadToken(input.token);
  const filePath = resolveStoragePath(env.uploadsDir, storageKey);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, input.body);

  return {
    fileSizeBytes: input.body.length,
    mimeType: input.mimeType?.trim() || "application/octet-stream",
    storageKey,
    uploaded: true,
  };
}

export async function getLocalAttachmentBinary(input: {
  token: string;
}): Promise<DownloadBinaryResult> {
  const env = loadEnv();

  if (env.storageProvider !== "local") {
    throw new AppError(
      404,
      "DOWNLOAD_ROUTE_NOT_AVAILABLE",
      "Local download route is only available when STORAGE_PROVIDER=local",
    );
  }

  const { fileName, mimeType, storageKey } = verifyLocalDownloadToken(
    input.token,
  );
  const absolutePath = resolveStoragePath(env.uploadsDir, storageKey);

  try {
    await access(absolutePath);
  } catch {
    throw new AppError(
      404,
      "ATTACHMENT_BINARY_NOT_FOUND",
      "Attachment binary not found",
    );
  }

  return {
    absolutePath,
    fileName,
    mimeType,
  };
}
