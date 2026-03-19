import { Request, Response } from 'express';
import { MensageriaServico } from '../../servicos/MensageriaServico';
import { CanalNotificacao, EntityType, StatusDispatch } from '../../compartilhado/tipos/mensageria';

export class MensageriaControlador {
  private mensageriaServico = new MensageriaServico();
  private entityTypes: EntityType[] = ['patient', 'professional', 'treatment'];
  private canais: CanalNotificacao[] = ['email', 'whatsapp'];
  private statuses: StatusDispatch[] = ['success', 'failed', 'skipped'];

  async dryRun(_req: Request, res: Response) {
    const resultado = await this.mensageriaServico.dryRun();
    res.json(resultado);
  }

  async historico(req: Request, res: Response) {
    const limitParam = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 100;
    const entityType = typeof req.query.entityType === 'string' && this.entityTypes.includes(req.query.entityType as EntityType)
      ? req.query.entityType as EntityType
      : undefined;
    const entityId = typeof req.query.entityId === 'string' && req.query.entityId.trim().length > 0
      ? req.query.entityId.trim()
      : undefined;
    const channel = typeof req.query.channel === 'string' && this.canais.includes(req.query.channel as CanalNotificacao)
      ? req.query.channel as CanalNotificacao
      : undefined;
    const status = typeof req.query.status === 'string' && this.statuses.includes(req.query.status as StatusDispatch)
      ? req.query.status as StatusDispatch
      : undefined;

    const resultado = await this.mensageriaServico.listarHistorico({
      limit,
      entityType,
      entityId,
      channel,
      status
    });
    res.json(resultado);
  }
}
