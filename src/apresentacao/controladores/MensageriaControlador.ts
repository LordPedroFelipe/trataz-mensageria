import { Request, Response } from 'express';
import { MensageriaServico } from '../../servicos/MensageriaServico';
import { CanalNotificacao, EntityType, StatusDispatch } from '../../compartilhado/tipos/mensageria';

export class MensageriaControlador {
  private mensageriaServico = new MensageriaServico();
  private entityTypes: EntityType[] = ['patient', 'professional', 'treatment', 'clinic', 'password_reset', 'reminder'];
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

  async processarCiclo(_req: Request, res: Response) {
    await this.mensageriaServico.executarCicloManual();
    res.status(202).json({ ok: true, message: 'Ciclo de mensageria executado' });
  }

  async enviarPasswordReset(req: Request, res: Response) {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!id) {
      res.status(400).json({ ok: false, message: 'Id de password reset obrigatorio' });
      return;
    }

    const enviado = await this.mensageriaServico.processarPasswordResetPorId(id);
    if (!enviado) {
      res.status(404).json({ ok: false, message: 'Password reset nao encontrado ou nao enviado' });
      return;
    }

    res.status(202).json({ ok: true, message: 'Email de recuperacao processado' });
  }

  async enviarSenhaTemporaria(req: Request, res: Response) {
    const entityType = req.params.entityType;
    const permitidos = ['patient', 'professional', 'clinic'] as const;
    if (!permitidos.includes(entityType as typeof permitidos[number])) {
      res.status(400).json({ ok: false, message: 'entityType invalido' });
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, message: 'Id invalido' });
      return;
    }

    const enviado = await this.mensageriaServico.processarSenhaTemporariaPorEntidade(entityType as 'patient' | 'professional' | 'clinic', id);
    if (!enviado) {
      res.status(404).json({ ok: false, message: 'Entidade nao encontrada ou sem email/senha temporaria para envio' });
      return;
    }

    res.status(202).json({ ok: true, message: 'Senha temporaria processada' });
  }
}
