import { z } from 'zod';
import { MAX_UPLOAD_BYTES } from '../constants/sources.js';
import { uuidSchema } from './project.js';

export const documentParamsSchema = z.object({ id: uuidSchema, docId: uuidSchema });
export type DocumentParams = z.infer<typeof documentParamsSchema>;

export const documentVersionParamsSchema = z.object({
  id: uuidSchema,
  docId: uuidSchema,
  versionId: uuidSchema,
});
export type DocumentVersionParams = z.infer<typeof documentVersionParamsSchema>;

export const uploadUrlRequestSchema = z.object({
  fileName: z.string().trim().min(1, 'File name is required').max(255),
  mimeType: z.string().trim().min(1).max(200),
  sizeBytes: z
    .number()
    .int()
    .positive('File is empty')
    .max(MAX_UPLOAD_BYTES, `File is larger than ${String(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`),
  /** Set to upload a new version of an existing document. */
  documentId: uuidSchema.optional(),
});
export type UploadUrlRequest = z.infer<typeof uploadUrlRequestSchema>;

export const confirmUploadSchema = z.object({
  ticket: z.string().min(1).max(4000),
});
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

export const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;

export const documentDetailQuerySchema = z.object({
  versionId: uuidSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type DocumentDetailQuery = z.infer<typeof documentDetailQuerySchema>;
