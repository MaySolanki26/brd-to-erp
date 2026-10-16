import { Router, type Router as RouterType, raw } from 'express';
import { MAX_UPLOAD_BYTES } from '@brd/shared';
import { handleUpload } from './storage.controller.js';

export const storageRouter: RouterType = Router();

storageRouter.post('/upload', raw({ type: '*/*', limit: MAX_UPLOAD_BYTES }), handleUpload);
