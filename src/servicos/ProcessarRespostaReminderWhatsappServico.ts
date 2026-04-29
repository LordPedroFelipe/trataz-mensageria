import { CanalNotificacao, NotificationType } from '../compartilhado/tipos/mensageria';
import { ReminderRepositorio } from '../infra/repositorios/ReminderRepositorio';
import { MessageDispatchAuditRepositorio } from '../infra/repositorios/MessageDispatchAuditRepositorio';
import { WhatsAppInboundAuditRepositorio } from '../infra/repositorios/WhatsAppInboundAuditRepositorio';
import { TreatmentContentRepositorio } from '../infra/repositorios/TreatmentContentRepositorio';
import { ChatRepositorio } from '../infra/repositorios/ChatRepositorio';
import { WhatsappServico } from './WhatsappServico';
import { logger } from '../config/logger';
import { Reminder } from '../dominio/entidades/Reminder';

interface ProcessarRespostaInput {
  providerMessageId: string;
  fromPhone: string;
  toPhone: string | null;
  rawBody: string;
  body: string;
}

type ReminderResponseOption = '1' | '2' | '3';

export class ProcessarRespostaReminderWhatsappServico {
  private reminderRepo = new ReminderRepositorio();
  private auditRepo = new MessageDispatchAuditRepositorio();
  private inboundRepo = new WhatsAppInboundAuditRepositorio();
  private treatmentContentRepo = new TreatmentContentRepositorio();
  private chatRepo = new ChatRepositorio();
  private whatsappServico = new WhatsappServico();

  async executar(input: ProcessarRespostaInput): Promise<{ duplicate: boolean }> {
    const fromPhone = this.whatsappServico.normalizarDestinoWhatsApp(input.fromPhone);
    const toPhone = input.toPhone ? this.whatsappServico.normalizarDestinoWhatsApp(input.toPhone) : null;
    const existente = await this.inboundRepo.buscarPorProviderMessageId(input.providerMessageId);
    if (existente) {
      logger.info({ providerMessageId: input.providerMessageId }, 'Webhook inbound de WhatsApp duplicado ignorado');
      return { duplicate: true };
    }

    const opcao = this.extrairOpcao(input.body);
    const inbound = await this.inboundRepo.criar({
      providerMessageId: input.providerMessageId,
      fromPhone,
      toPhone,
      rawBody: input.rawBody,
      parsedOption: opcao,
      status: opcao ? 'received' : 'invalid_option',
      receivedAt: new Date()
    });

    if (!opcao) {
      const replyMessageId = await this.enviarRespostaAoPaciente({
        inboundId: inbound.id,
        destination: fromPhone,
        notificationType: 'reminder_response_invalid',
        reason: 'Resposta invalida para reminder por WhatsApp',
        message: 'Nao entendi sua resposta. Responda com 1 para "ok fiz o tratamento", 2 para "nao consegui" ou 3 para "tenho duvidas".'
      });

      await this.inboundRepo.marcarProcessado({
        id: inbound.id,
        status: 'invalid_option',
        responseAction: 'reply_invalid_option',
        replyMessageId,
        errorMessage: 'Opcao nao reconhecida'
      });

      return { duplicate: false };
    }

    const ultimoReminder = await this.auditRepo.buscarUltimoSucessoPorDestino(
      'recurring_treatment_reminder',
      'whatsapp',
      fromPhone,
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    if (!ultimoReminder) {
      const replyMessageId = await this.enviarRespostaAoPaciente({
        inboundId: inbound.id,
        destination: fromPhone,
        notificationType: 'reminder_response_invalid',
        reason: 'Resposta inbound sem reminder correspondente',
        message: 'Recebemos sua resposta, mas nao encontramos um lembrete recente para vincular. Aguarde o proximo lembrete ou fale com sua equipe.'
      });

      await this.inboundRepo.marcarProcessado({
        id: inbound.id,
        status: 'unmatched_reminder',
        responseAction: 'reply_unmatched_reminder',
        replyMessageId,
        errorMessage: 'Nenhum reminder recorrente recente encontrado para o telefone'
      });

      return { duplicate: false };
    }

    const reminderId = this.extrairReminderId(ultimoReminder.entityId);
    if (!reminderId) {
      const replyMessageId = await this.enviarRespostaAoPaciente({
        inboundId: inbound.id,
        destination: fromPhone,
        notificationType: 'reminder_response_invalid',
        reason: 'EntityId de reminder invalido na auditoria',
        message: 'Recebemos sua resposta, mas nao conseguimos identificar o lembrete correspondente. Tente novamente mais tarde.'
      });

      await this.inboundRepo.marcarProcessado({
        id: inbound.id,
        status: 'invalid_reminder_entity',
        responseAction: 'reply_invalid_reminder_entity',
        matchedReminderEntityId: ultimoReminder.entityId,
        replyMessageId,
        errorMessage: 'EntityId do reminder nao pode ser interpretado'
      });

      return { duplicate: false };
    }

    const reminder = await this.reminderRepo.buscarPorId(reminderId);
    if (!reminder) {
      const replyMessageId = await this.enviarRespostaAoPaciente({
        inboundId: inbound.id,
        destination: fromPhone,
        notificationType: 'reminder_response_invalid',
        reason: 'Reminder correspondente nao encontrado',
        message: 'Recebemos sua resposta, mas o lembrete correspondente nao foi encontrado. Tente novamente mais tarde.'
      });

      await this.inboundRepo.marcarProcessado({
        id: inbound.id,
        status: 'reminder_not_found',
        responseAction: 'reply_reminder_not_found',
        matchedReminderEntityId: ultimoReminder.entityId,
        replyMessageId,
        errorMessage: `Reminder ${reminderId} nao encontrado`
      });

      return { duplicate: false };
    }

    const resultado = await this.processarOpcao(opcao, reminder, fromPhone, inbound.id);

    await this.inboundRepo.marcarProcessado({
      id: inbound.id,
      status: resultado.status,
      responseAction: resultado.responseAction,
      reminderId: reminder.id,
      treatmentId: reminder.tratamento.id,
      patientId: reminder.paciente.id,
      contentId: reminder.conteudo?.id ?? null,
      matchedReminderEntityId: ultimoReminder.entityId,
      replyMessageId: resultado.replyMessageId,
      errorMessage: resultado.errorMessage ?? null
    });

    return { duplicate: false };
  }

  private extrairOpcao(body: string): ReminderResponseOption | null {
    const normalized = String(body || '').trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const firstDigit = normalized.match(/[123]/)?.[0] ?? null;
    if (firstDigit === '1' || firstDigit === '2' || firstDigit === '3') {
      return firstDigit;
    }

    if (normalized.includes('nao consegui')) {
      return '2';
    }

    if (normalized.includes('duvida') || normalized.includes('dúvida')) {
      return '3';
    }

    return null;
  }

  private extrairReminderId(entityId: string): number | null {
    const [reminderId] = String(entityId || '').split(':');
    const parsed = Number(reminderId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private async processarOpcao(
    opcao: ReminderResponseOption,
    reminder: Reminder,
    fromPhone: string,
    inboundId: number
  ): Promise<{ status: string; responseAction: string; replyMessageId: string | null; errorMessage?: string | null }> {
    if (opcao === '1') {
      if (reminder.conteudo?.id) {
        const treatmentContent = await this.treatmentContentRepo.buscarPorTratamentoEConteudo(
          reminder.tratamento.id,
          reminder.conteudo.id
        );

        if (treatmentContent) {
          await this.treatmentContentRepo.marcarComoConcluido(treatmentContent.id);
          const replyMessageId = await this.enviarRespostaAoPaciente({
            inboundId,
            destination: fromPhone,
            notificationType: 'reminder_response_ack',
            reason: 'Confirmacao de tratamento realizado por WhatsApp',
            message: 'Recebemos sua confirmacao. Obrigado por atualizar seu tratamento.'
          });

          return {
            status: 'processed',
            responseAction: 'completed_treatment_content',
            replyMessageId
          };
        }
      }

      const replyMessageId = await this.enviarRespostaAoPaciente({
        inboundId,
        destination: fromPhone,
        notificationType: 'reminder_response_ack',
        reason: 'Confirmacao recebida sem conteudo vinculavel',
        message: 'Recebemos sua confirmacao. Obrigado por atualizar seu tratamento.'
      });

      return {
        status: 'processed',
        responseAction: 'acknowledged_without_treatment_content',
        replyMessageId
      };
    }

    if (opcao === '2') {
      const replyMessageId = await this.enviarRespostaAoPaciente({
        inboundId,
        destination: fromPhone,
        notificationType: 'reminder_response_ack',
        reason: 'Paciente informou que nao conseguiu realizar o tratamento',
        message: 'Tudo bem. Registramos que voce nao conseguiu realizar o tratamento agora.'
      });

      return {
        status: 'processed',
        responseAction: 'reported_could_not_complete',
        replyMessageId
      };
    }

    const conversation = await this.chatRepo.buscarOuCriarConversaPacienteProfissional(
      reminder.paciente.id,
      reminder.tratamento.profissional.id
    );
    await this.chatRepo.criarMensagemPaciente(
      conversation.id,
      reminder.paciente.id,
      `Paciente respondeu ao lembrete via WhatsApp: "Tenho duvidas" sobre ${reminder.conteudo?.titulo ?? reminder.tratamento.nome}.`
    );

    const replyMessageId = await this.enviarRespostaAoPaciente({
      inboundId,
      destination: fromPhone,
      notificationType: 'reminder_response_ack',
      reason: 'Paciente informou que possui duvidas sobre o tratamento',
      message: 'Entendido. Registramos sua duvida para acompanhamento.'
    });

    return {
      status: 'processed',
      responseAction: 'created_or_reused_chat_conversation',
      replyMessageId
    };
  }

  private async enviarRespostaAoPaciente(input: {
    inboundId: number;
    destination: string;
    notificationType: NotificationType;
    reason: string;
    message: string;
  }): Promise<string | null> {
    const attemptedAt = new Date();
    const resultado = await this.whatsappServico.enviarMensagemSessao(input.destination, input.message);

    await this.auditRepo.registrarTentativa({
      entityType: 'reminder_response',
      entityId: input.inboundId,
      notificationType: input.notificationType,
      channel: 'whatsapp' as CanalNotificacao,
      status: resultado.status,
      destination: input.destination,
      reason: input.reason,
      providerMessageId: resultado.providerMessageId ?? null,
      errorMessage: resultado.errorMessage ?? null,
      attemptedAt
    });

    return resultado.providerMessageId ?? null;
  }
}
