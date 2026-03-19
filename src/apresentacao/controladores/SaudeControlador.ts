import { Request, Response } from 'express';
import { ambiente } from '../../config/ambiente';
import { AppDataSource } from '../../config/data-source';

export class SaudeControlador {
  async obter(_req: Request, res: Response) {
    res.json({
      status: AppDataSource.isInitialized ? 'ok' : 'degradado',
      banco: {
        conectado: AppDataSource.isInitialized
      },
      worker: {
        ativo: ambiente.worker.ativo,
        intervaloMs: ambiente.worker.intervaloMs
      }
    });
  }
}
