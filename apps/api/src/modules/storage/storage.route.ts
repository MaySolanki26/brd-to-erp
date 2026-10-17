import { Router, type Router as RouterType, raw } from 'express';
import { MAX_UPLOAD_BYTES } from '@brd/shared';
import { handleUpload } from './storage.controller.js';

export const storageRouter: RouterType = Router();

const rawBody = raw({ type: '*/*', limit: MAX_UPLOAD_BYTES });

// PUT is the documented upload verb; POST stays for the existing web client.
storageRouter.put('/upload', rawBody, handleUpload);
storageRouter.post('/upload', rawBody, handleUpload);
