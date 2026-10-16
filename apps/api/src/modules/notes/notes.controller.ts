import type { Request, Response } from 'express';
import type { CreateNoteInput, ListNotesQuery, UpdateNoteInput } from '@brd/shared';
import { getAuthUser } from '../../middleware/require-auth.js';
import * as service from './notes.service.js';

const projectIdOf = (req: Request): string => req.params['id'] as string;

export async function listNotesController(req: Request, res: Response): Promise<void> {
  res.json(
    await service.listNotes(
      getAuthUser(res),
      projectIdOf(req),
      req.query as unknown as ListNotesQuery,
    ),
  );
}

export async function createNoteController(req: Request, res: Response): Promise<void> {
  const note = await service.createNote(
    getAuthUser(res),
    projectIdOf(req),
    req.body as CreateNoteInput,
  );
  res.status(201).json({ note });
}

export async function updateNoteController(req: Request, res: Response): Promise<void> {
  const note = await service.updateNote(
    getAuthUser(res),
    projectIdOf(req),
    req.params['noteId'] as string,
    req.body as UpdateNoteInput,
  );
  res.json({ note });
}
