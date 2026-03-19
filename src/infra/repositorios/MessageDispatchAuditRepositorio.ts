import { AppDataSource } from '../../config/data-source';
import { CanalNotificacao, EntityType, NotificationType, StatusDispatch } from '../../compartilhado/tipos/mensageria';
import { MessageDispatchAudit } from '../../dominio/entidades/MessageDispatchAudit';

interface RegistrarTentativaInput {
  entityType: EntityType;
  entityId: string | number;
  notificationType: NotificationType;
  channel: CanalNotificacao;
  status: StatusDispatch;
  destination: string | null;
  reason: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  attemptedAt: Date;
}

export interface ListarHistoricoInput {
  limit?: number;
  entityType?: EntityType;
  entityId?: string;
  channel?: CanalNotificacao;
  status?: StatusDispatch;
}

export class MessageDispatchAuditRepositorio {
  async existeSucesso(entityType: EntityType, entityId: string | number, notificationType: NotificationType, channel: CanalNotificacao): Promise<boolean> {
    const registro = await AppDataSource.getRepository(MessageDispatchAudit).findOne({
      where: {
        entityType,
        entityId: String(entityId),
        notificationType,
        channel,
        status: 'success'
      },
      order: {
        attemptedAt: 'DESC'
      }
    });

    return Boolean(registro);
  }

  async registrarTentativa(input: RegistrarTentativaInput): Promise<MessageDispatchAudit> {
    const repositorio = AppDataSource.getRepository(MessageDispatchAudit);
    const registro = repositorio.create({
      entityType: input.entityType,
      entityId: String(input.entityId),
      notificationType: input.notificationType,
      channel: input.channel,
      status: input.status,
      destination: input.destination,
      reason: input.reason,
      providerMessageId: input.providerMessageId ?? null,
      errorMessage: input.errorMessage ?? null,
      attemptedAt: input.attemptedAt
    });

    return repositorio.save(registro);
  }

  async listarHistorico(input: ListarHistoricoInput = {}): Promise<MessageDispatchAudit[]> {
    const limit = input.limit ?? 100;
    const queryBuilder = AppDataSource.getRepository(MessageDispatchAudit)
      .createQueryBuilder('audit')
      .orderBy('audit.attemptedAt', 'DESC')
      .addOrderBy('audit.id', 'DESC')
      .take(limit);

    if (input.entityType) {
      queryBuilder.andWhere('audit.entityType = :entityType', { entityType: input.entityType });
    }

    if (input.entityId) {
      queryBuilder.andWhere('audit.entityId = :entityId', { entityId: input.entityId });
    }

    if (input.channel) {
      queryBuilder.andWhere('audit.channel = :channel', { channel: input.channel });
    }

    if (input.status) {
      queryBuilder.andWhere('audit.status = :status', { status: input.status });
    }

    return queryBuilder.getMany();
  }
}
