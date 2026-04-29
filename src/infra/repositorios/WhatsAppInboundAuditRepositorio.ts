import { AppDataSource } from '../../config/data-source';
import { WhatsAppInboundAudit } from '../../dominio/entidades/WhatsAppInboundAudit';

interface CriarInboundInput {
  providerMessageId: string;
  fromPhone: string;
  toPhone: string | null;
  rawBody: string;
  parsedOption: string | null;
  status: string;
  receivedAt: Date;
}

interface MarcarProcessadoInput {
  id: number;
  status: string;
  responseAction?: string | null;
  reminderId?: number | null;
  treatmentId?: number | null;
  patientId?: number | null;
  contentId?: number | null;
  matchedReminderEntityId?: string | null;
  replyMessageId?: string | null;
  errorMessage?: string | null;
}

export class WhatsAppInboundAuditRepositorio {
  async buscarPorProviderMessageId(providerMessageId: string): Promise<WhatsAppInboundAudit | null> {
    return AppDataSource.getRepository(WhatsAppInboundAudit).findOne({
      where: { providerMessageId }
    });
  }

  async criar(input: CriarInboundInput): Promise<WhatsAppInboundAudit> {
    const repositorio = AppDataSource.getRepository(WhatsAppInboundAudit);
    return repositorio.save(
      repositorio.create({
        ...input,
        processedAt: null,
        reminderId: null,
        treatmentId: null,
        patientId: null,
        contentId: null,
        responseAction: null,
        matchedReminderEntityId: null,
        replyMessageId: null,
        errorMessage: null
      })
    );
  }

  async marcarProcessado(input: MarcarProcessadoInput): Promise<void> {
    await AppDataSource.getRepository(WhatsAppInboundAudit).update(
      { id: input.id },
      {
        status: input.status,
        responseAction: input.responseAction ?? null,
        reminderId: input.reminderId ?? null,
        treatmentId: input.treatmentId ?? null,
        patientId: input.patientId ?? null,
        contentId: input.contentId ?? null,
        matchedReminderEntityId: input.matchedReminderEntityId ?? null,
        replyMessageId: input.replyMessageId ?? null,
        errorMessage: input.errorMessage ?? null,
        processedAt: new Date()
      }
    );
  }
}
