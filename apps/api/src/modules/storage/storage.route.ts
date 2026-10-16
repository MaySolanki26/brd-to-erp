import { Router, type Router as RouterType, raw } from 'express';
import { handleUpload, handleDownload } from './storage.controller.js';

export const storageRouter: RouterType = Router();

storageRouter.post('/upload', raw({ type: '*/*', limit: '50mb' }), handleUpload);
storageRouter.get('/download/:fileKey', handleDownload);
