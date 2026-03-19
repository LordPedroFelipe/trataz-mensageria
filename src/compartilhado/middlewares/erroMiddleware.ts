
import { NextFunction, Request, Response } from 'express';
import { logger } from '../../config/logger';

export function erroMiddleware(erro: unknown, _req: Request, res: Response, _next: NextFunction) {
  logger.error({ erro }, 'Erro não tratado');
  res.status(500).json({ erro: 'erro_interno' });
}
