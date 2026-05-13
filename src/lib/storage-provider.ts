import { randomUUID } from "crypto";

import { createClient } from "@supabase/supabase-js";

import type { AppEnv, StorageProvider as StorageProviderName } from "./env.js";
import { loadEnv } from "./env.js";
import { AppError } from "./errors.js";
import {
  getLocalDownloadTokenExpiresInSeconds,
  getLocalUploadTokenExpiresInSeconds,
  signLocalDownloadToken,
  signLocalUploadToken,
} from "./upload-token.js";

export interface CreateAttachmentDownloadIntentInput {
  fileName: string;
  mimeType: string;
  storageKey: string;
}

export interface CreateAttachmentUploadIntentInput {
  fileName: string;
  inspectionId: string;
}

export interface StorageDownloadIntent {
  downloadMethod: "GET";
  downloadPath?: string;
  downloadStrategy: "api_binary_download" | "supabase_signed_url";
  downloadUrl?: string;
  expiresInSeconds?: number;
  provider: StorageProviderName;
}

export interface StorageUploadIntent {
  expiresInSeconds?: number;
  provider: StorageProviderName;
  requiresMetadataCreate: boolean;
  storageKey: string;
  uploadHeaders: Record<string, string>;
  uploadMethod: "PUT";
  uploadPath?: string;
  uploadStrategy: "api_binary_upload" | "supabase_signed_url";
  uploadToken?: string;
  uploadUrl?: string;
}

export interface AttachmentStorageProvider {
  createDownloadIntent(
    input: CreateAttachmentDownloadIntentInput,
  ): Promise<StorageDownloadIntent>;
  createUploadIntent(
    input: CreateAttachmentUploadIntentInput,
  ): Promise<StorageUploadIntent>;
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function createStorageKey(input: CreateAttachmentUploadIntentInput): string {
  const datePrefix = new Date().toISOString().slice(0, 10);
  const safeFileName = sanitizeFileName(input.fileName) || "attachment";

  return `inspections/${input.inspectionId}/${datePrefix}/${randomUUID()}-${safeFileName}`;
}

class LocalAttachmentStorageProvider implements AttachmentStorageProvider {
  constructor(private readonly env: AppEnv) {}

  async createDownloadIntent(
    input: CreateAttachmentDownloadIntentInput,
  ): Promise<StorageDownloadIntent> {
    const downloadToken = signLocalDownloadToken({
      fileName: input.fileName,
      mimeType: input.mimeType,
      storageKey: input.storageKey,
    });
    const downloadPath = `/api/v1/uploads/local/${downloadToken}`;

    return {
      downloadMethod: "GET",
      downloadPath,
      downloadStrategy: "api_binary_download",
      downloadUrl: `${this.env.publicApiUrl}${downloadPath}`,
      expiresInSeconds: getLocalDownloadTokenExpiresInSeconds(),
      provider: "local",
    };
  }

  async createUploadIntent(
    input: CreateAttachmentUploadIntentInput,
  ): Promise<StorageUploadIntent> {
    const storageKey = createStorageKey(input);
    const uploadToken = signLocalUploadToken({ storageKey });
    const uploadPath = `/api/v1/uploads/local/${uploadToken}`;

    return {
      expiresInSeconds: getLocalUploadTokenExpiresInSeconds(),
      provider: "local",
      requiresMetadataCreate: true,
      storageKey,
      uploadHeaders: {},
      uploadMethod: "PUT",
      uploadPath,
      uploadStrategy: "api_binary_upload",
      uploadToken,
      uploadUrl: `${this.env.publicApiUrl}${uploadPath}`,
    };
  }
}

class SupabaseAttachmentStorageProvider implements AttachmentStorageProvider {
  constructor(private readonly env: AppEnv) {}

  async createDownloadIntent(
    input: CreateAttachmentDownloadIntentInput,
  ): Promise<StorageDownloadIntent> {
    if (
      !this.env.supabaseUrl ||
      !this.env.supabaseServiceRoleKey ||
      !this.env.supabaseStorageBucket
    ) {
      throw new AppError(
        500,
        "SUPABASE_STORAGE_NOT_CONFIGURED",
        "Supabase storage is not configured",
      );
    }

    const supabase = createClient(
      this.env.supabaseUrl,
      this.env.supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const { data, error } = await supabase.storage
      .from(this.env.supabaseStorageBucket)
      .createSignedUrl(input.storageKey, 7200);

    if (error || !data) {
      throw new AppError(
        500,
        "ATTACHMENT_DOWNLOAD_INTENT_FAILED",
        error?.message || "Failed to create download intent",
      );
    }

    return {
      downloadMethod: "GET",
      downloadPath: input.storageKey,
      downloadStrategy: "supabase_signed_url",
      downloadUrl: data.signedUrl,
      expiresInSeconds: 7200,
      provider: "supabase",
    };
  }

  async createUploadIntent(
    input: CreateAttachmentUploadIntentInput,
  ): Promise<StorageUploadIntent> {
    if (
      !this.env.supabaseUrl ||
      !this.env.supabaseServiceRoleKey ||
      !this.env.supabaseStorageBucket
    ) {
      throw new AppError(
        500,
        "SUPABASE_STORAGE_NOT_CONFIGURED",
        "Supabase storage is not configured",
      );
    }

    const storageKey = createStorageKey(input);
    const supabase = createClient(
      this.env.supabaseUrl,
      this.env.supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const { data, error } = await supabase.storage
      .from(this.env.supabaseStorageBucket)
      .createSignedUploadUrl(storageKey);

    if (error || !data) {
      throw new AppError(
        500,
        "ATTACHMENT_UPLOAD_INTENT_FAILED",
        error?.message || "Failed to create upload intent",
      );
    }

    return {
      expiresInSeconds: 7200,
      provider: "supabase",
      requiresMetadataCreate: true,
      storageKey,
      uploadHeaders: {},
      uploadMethod: "PUT",
      uploadPath: data.path,
      uploadStrategy: "supabase_signed_url",
      uploadToken: data.token,
      uploadUrl: data.signedUrl,
    };
  }
}

export function getAttachmentStorageProvider(
  env: AppEnv = loadEnv(),
): AttachmentStorageProvider {
  if (env.storageProvider === "supabase") {
    return new SupabaseAttachmentStorageProvider(env);
  }

  return new LocalAttachmentStorageProvider(env);
}
