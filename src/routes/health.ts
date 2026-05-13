import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ data: { status: 'healthy' } });
});

export default router;
