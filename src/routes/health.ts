import { Router } from 'express';

import { asyncHandler } from '../lib/async-handler.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    let dbStatus = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    const status = dbStatus === 'ok' ? 'healthy' : 'degraded';
    const httpStatus = dbStatus === 'ok' ? 200 : 503;

    res.status(httpStatus).json({ data: { db: dbStatus, status } });
  }),
);

export default router;
