import { z } from 'zod';
import { MAX_NOTE_CHARS } from '../constants/sources.js';
import { uuidSchema } from './project.js';

export const noteParamsSchema = z.object({ id: uuidSchema, noteId: uuidSchema });
export type NoteParams = z.infer<typeof noteParamsSchema>;

export const createNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  body: z
    .string()
    .trim()
    .min(1, 'Note is empty')
    .max(MAX_NOTE_CHARS, `Notes are limited to ${String(MAX_NOTE_CHARS)} characters`),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = createNoteSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export const listNotesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListNotesQuery = z.infer<typeof listNotesQuerySchema>;
