import { PacienteRepositorio } from '../infra/repositorios/PacienteRepositorio';
import { ProfissionalRepositorio } from '../infra/repositorios/ProfissionalRepositorio';
import { TratamentoRepositorio } from '../infra/repositorios/TratamentoRepositorio';
import { ListarHistoricoInput, MessageDispatchAuditRepositorio } from '../infra/repositorios/MessageDispatchAuditRepositorio';
import { EmailServico } from './EmailServico';
import { WhatsappServico } from './WhatsappServico';
import { logger } from '../config/logger';
import { CanalNotificacao, EnvioResultado, EntityType, NotificationType } from '../compartilhado/tipos/mensageria';
import { MessageDispatchAudit } from '../dominio/entidades/MessageDispatchAudit';

interface ItemDryRun {
  tipo: EntityType;
  id: string | number;
  nomeReferencia: string;
  canais: CanalNotificacao[];
  destinos: {
    email: string | null;
    telefone: string | null;
  };
  motivo: string;
}

export interface ResultadoDryRunMensageria {
  watermarkISO: string;
  geradoEm: string;
  totais: {
    pacientes: number;
    profissionais: number;
    tratamentos: number;
    itens: number;
  };
  itens: ItemDryRun[];
}

interface ProcessarCanalInput {
  entityType: EntityType;
  entityId: string | number;
  notificationType: NotificationType;
  channel: CanalNotificacao;
  destination: string;
  reason: string;
  contextoLog: Record<string, string | number | null>;
  executarEnvio: () => Promise<EnvioResultado>;
}

export class MensageriaServico {
  private pacienteRepo = new PacienteRepositorio();
  private profissionalRepo = new ProfissionalRepositorio();
  private tratamentoRepo = new TratamentoRepositorio();
  private auditRepo = new MessageDispatchAuditRepositorio();
  private emailServico = new EmailServico();
  private whatsappServico = new WhatsappServico();

  private watermarkISO: string = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  async dryRun(): Promise<ResultadoDryRunMensageria> {
    const geradoEm = new Date().toISOString();
    const pacientes = await this.pacienteRepo.buscarNovosApos(this.watermarkISO);
    const profissionais = await this.profissionalRepo.buscarNovosApos(this.watermarkISO);
    const tratamentos = await this.tratamentoRepo.buscarNovosApos(this.watermarkISO);

    const itens: ItemDryRun[] = [];

    for (const paciente of pacientes) {
      const canais = await this.obterCanaisPendentes('patient', paciente.id, 'welcome_patient', paciente.email, paciente.telefone);
      if (canais.length === 0) {
        continue;
      }

      itens.push({
        tipo: 'patient' as const,
        id: paciente.id,
        nomeReferencia: [paciente.primeiroNome, paciente.sobrenome].filter(Boolean).join(' ').trim() || 'Paciente',
        canais,
        destinos: {
          email: paciente.email,
          telefone: paciente.telefone
        },
        motivo: 'Boas-vindas de paciente pendente'
      });
    }

    for (const profissional of profissionais) {
      const canais = await this.obterCanaisPendentes('professional', profissional.id, 'welcome_professional', profissional.email, profissional.telefone);
      if (canais.length === 0) {
        continue;
      }

      itens.push({
        tipo: 'professional' as const,
        id: profissional.id,
        nomeReferencia: profissional.nomeCompleto || 'Profissional',
        canais,
        destinos: {
          email: profissional.email,
          telefone: profissional.telefone
        },
        motivo: 'Boas-vindas de profissional pendente'
      });
    }

    for (const tratamento of tratamentos) {
      const canais = await this.obterCanaisPendentes('treatment', tratamento.id, 'treatment_reminder', tratamento.paciente.email, tratamento.paciente.telefone);
      if (canais.length === 0) {
        continue;
      }

      itens.push({
        tipo: 'treatment' as const,
        id: tratamento.id,
        nomeReferencia: tratamento.nome,
        canais,
        destinos: {
          email: tratamento.paciente.email,
          telefone: tratamento.paciente.telefone
        },
        motivo: `Lembrete de tratamento para ${tratamento.paciente.primeiroNome}`
      });
    }

    const resultado: ResultadoDryRunMensageria = {
      watermarkISO: this.watermarkISO,
      geradoEm,
      totais: {
        pacientes: itens.filter((item) => item.tipo === 'patient').length,
        profissionais: itens.filter((item) => item.tipo === 'professional').length,
        tratamentos: itens.filter((item) => item.tipo === 'treatment').length,
        itens: itens.length
      },
      itens
    };

    logger.info({
      watermarkISO: resultado.watermarkISO,
      totais: resultado.totais
    }, 'Dry-run de mensageria gerado');

    return resultado;
  }

  async listarHistorico(filtros: ListarHistoricoInput = {}): Promise<{ total: number; itens: MessageDispatchAudit[] }> {
    const itens = await this.auditRepo.listarHistorico(filtros);
    return {
      total: itens.length,
      itens
    };
  }

  private async obterCanaisPendentes(entityType: EntityType, entityId: string | number, notificationType: NotificationType, email: string | null, telefone: string | null): Promise<CanalNotificacao[]> {
    const canais: CanalNotificacao[] = [];

    if (email) {
      const possuiSucessoEmail = await this.auditRepo.existeSucesso(entityType, entityId, notificationType, 'email');
      if (!possuiSucessoEmail) {
        canais.push('email');
      }
    }

    if (telefone) {
      const possuiSucessoWhatsapp = await this.auditRepo.existeSucesso(entityType, entityId, notificationType, 'whatsapp');
      if (!possuiSucessoWhatsapp) {
        canais.push('whatsapp');
      }
    }

    return canais;
  }

  private async processarCanal(input: ProcessarCanalInput): Promise<boolean> {
    const attemptedAt = new Date();
    const jaEnviadoComSucesso = await this.auditRepo.existeSucesso(input.entityType, input.entityId, input.notificationType, input.channel);

    if (jaEnviadoComSucesso) {
      const motivo = `${input.reason} bloqueado por sucesso anterior`;
      await this.auditRepo.registrarTentativa({
        entityType: input.entityType,
        entityId: input.entityId,
        notificationType: input.notificationType,
        channel: input.channel,
        status: 'skipped',
        destination: input.destination,
        reason: motivo,
        errorMessage: 'Ja existe tentativa com status success para esta chave de envio',
        attemptedAt
      });

      logger.info({ ...input.contextoLog, channel: input.channel, destination: input.destination }, 'Envio bloqueado por sucesso anterior na auditoria');
      return false;
    }

    const resultado = await input.executarEnvio();

    await this.auditRepo.registrarTentativa({
      entityType: input.entityType,
      entityId: input.entityId,
      notificationType: input.notificationType,
      channel: input.channel,
      status: resultado.status,
      destination: input.destination,
      reason: resultado.reason,
      providerMessageId: resultado.providerMessageId ?? null,
      errorMessage: resultado.errorMessage ?? null,
      attemptedAt
    });

    this.logarResultadoCanal(input, resultado);
    return resultado.status === 'success';
  }

  private logarResultadoCanal(input: ProcessarCanalInput, resultado: EnvioResultado): void {
    const contexto = {
      ...input.contextoLog,
      channel: input.channel,
      destination: input.destination,
      providerMessageId: resultado.providerMessageId ?? null,
      status: resultado.status
    };

    if (resultado.status === 'success') {
      logger.info(contexto, 'Canal processado com sucesso e auditoria registrada');
      return;
    }

    if (resultado.status === 'failed') {
      logger.error({ ...contexto, errorMessage: resultado.errorMessage ?? null }, 'Canal processado com falha e auditoria registrada');
      return;
    }

    logger.warn({ ...contexto, errorMessage: resultado.errorMessage ?? null }, 'Canal ignorado e auditoria registrada');
  }

  private async registrarMarcacaoLog(entidade: 'paciente' | 'profissional' | 'tratamento', id: number, marcado: boolean): Promise<void> {
    if (marcado) {
      logger.info({ entidade, id }, 'Registro marcado como notificado na tabela de origem');
      return;
    }

    logger.info({ entidade, id }, 'Tabela de auditoria passou a ser a fonte de verdade do envio');
  }

  async ciclo(): Promise<void> {
    const inicioCiclo = new Date();

    try {
      logger.info({ watermarkISO: this.watermarkISO, executadoEm: inicioCiclo.toISOString() }, 'Iniciando ciclo de mensageria');

      const pacientes = await this.pacienteRepo.buscarNovosApos(this.watermarkISO);
      logger.info({ total: pacientes.length }, 'Pacientes encontrados para notificacao');

      for (const paciente of pacientes) {
        const primeiroNome = paciente.primeiroNome ?? 'Paciente';
        let notificacaoEnviada = false;

        logger.info({
          entidade: 'paciente',
          pacienteId: paciente.id,
          email: paciente.email,
          telefone: paciente.telefone
        }, 'Processando notificacao de boas-vindas para paciente');

        if (paciente.email) {
          notificacaoEnviada = await this.processarCanal({
            entityType: 'patient',
            entityId: paciente.id,
            notificationType: 'welcome_patient',
            channel: 'email',
            destination: paciente.email,
            reason: 'Boas-vindas de paciente por email',
            contextoLog: { entidade: 'paciente', pacienteId: paciente.id },
            executarEnvio: () => this.emailServico.enviarBoasVindasPaciente(
              paciente.email as string,
              primeiroNome,
              paciente.sobrenome,
              paciente.senhaTemporaria
            )
          }) || notificacaoEnviada;
        }

        if (paciente.telefone) {
          notificacaoEnviada = await this.processarCanal({
            entityType: 'patient',
            entityId: paciente.id,
            notificationType: 'welcome_patient',
            channel: 'whatsapp',
            destination: paciente.telefone,
            reason: 'Boas-vindas de paciente por WhatsApp',
            contextoLog: { entidade: 'paciente', pacienteId: paciente.id },
            executarEnvio: () => this.whatsappServico.enviarBoasVindasWhatsApp(
              `whatsapp:${paciente.telefone as string}`,
              paciente.email ?? '',
              primeiroNome,
              paciente.senhaTemporaria ?? undefined
            )
          }) || notificacaoEnviada;
        }

        if (notificacaoEnviada) {
          const marcado = await this.pacienteRepo.marcarBoasVindasEnviado(paciente.id);
          await this.registrarMarcacaoLog('paciente', paciente.id, marcado);
        } else {
          logger.warn({ entidade: 'paciente', pacienteId: paciente.id }, 'Paciente encontrado, mas nenhum canal enviou com sucesso');
        }
      }

      const profissionais = await this.profissionalRepo.buscarNovosApos(this.watermarkISO);
      logger.info({ total: profissionais.length }, 'Profissionais encontrados para notificacao');

      for (const profissional of profissionais) {
        const primeiroNome = profissional.nomeCompleto?.split(' ')[0] || 'Profissional';
        let notificacaoEnviada = false;

        logger.info({
          entidade: 'profissional',
          profissionalId: profissional.id,
          email: profissional.email,
          telefone: profissional.telefone
        }, 'Processando notificacao de boas-vindas para profissional');

        if (profissional.email) {
          notificacaoEnviada = await this.processarCanal({
            entityType: 'professional',
            entityId: profissional.id,
            notificationType: 'welcome_professional',
            channel: 'email',
            destination: profissional.email,
            reason: 'Boas-vindas de profissional por email',
            contextoLog: { entidade: 'profissional', profissionalId: profissional.id },
            executarEnvio: () => this.emailServico.enviarBoasVindasProfissional(
              profissional.email as string,
              primeiroNome,
              profissional.senhaTemporaria
            )
          }) || notificacaoEnviada;
        }

        if (profissional.telefone) {
          notificacaoEnviada = await this.processarCanal({
            entityType: 'professional',
            entityId: profissional.id,
            notificationType: 'welcome_professional',
            channel: 'whatsapp',
            destination: profissional.telefone,
            reason: 'Boas-vindas de profissional por WhatsApp',
            contextoLog: { entidade: 'profissional', profissionalId: profissional.id },
            executarEnvio: () => this.whatsappServico.enviarBoasVindasWhatsApp(
              `whatsapp:${profissional.telefone as string}`,
              profissional.email ?? '',
              primeiroNome,
              profissional.senhaTemporaria ?? undefined
            )
          }) || notificacaoEnviada;
        }

        if (notificacaoEnviada) {
          const marcado = await this.profissionalRepo.marcarBoasVindasEnviado(profissional.id);
          await this.registrarMarcacaoLog('profissional', profissional.id, marcado);
        } else {
          logger.warn({ entidade: 'profissional', profissionalId: profissional.id }, 'Profissional encontrado, mas nenhum canal enviou com sucesso');
        }
      }

      const tratamentos = await this.tratamentoRepo.buscarNovosApos(this.watermarkISO);
      logger.info({ total: tratamentos.length }, 'Tratamentos encontrados para notificacao');

      for (const tratamento of tratamentos) {
        const nomePaciente = tratamento.paciente.primeiroNome;
        const nomeProfissional = tratamento.profissional.nomeCompleto;
        const emailPaciente = tratamento.paciente.email;
        const telefonePaciente = tratamento.paciente.telefone;
        let notificacaoEnviada = false;

        logger.info({
          entidade: 'tratamento',
          tratamentoId: tratamento.id,
          pacienteId: tratamento.paciente.id,
          profissionalId: tratamento.profissional.id,
          emailPaciente,
          telefonePaciente
        }, 'Processando lembrete de tratamento');

        if (emailPaciente) {
          notificacaoEnviada = await this.processarCanal({
            entityType: 'treatment',
            entityId: tratamento.id,
            notificationType: 'treatment_reminder',
            channel: 'email',
            destination: emailPaciente,
            reason: 'Lembrete de tratamento por email',
            contextoLog: { entidade: 'tratamento', tratamentoId: tratamento.id },
            executarEnvio: () => this.emailServico.enviarLembreteTratamento(
              emailPaciente,
              nomePaciente,
              tratamento.nome,
              nomeProfissional
            )
          }) || notificacaoEnviada;
        }

        if (telefonePaciente) {
          notificacaoEnviada = await this.processarCanal({
            entityType: 'treatment',
            entityId: tratamento.id,
            notificationType: 'treatment_reminder',
            channel: 'whatsapp',
            destination: telefonePaciente,
            reason: 'Lembrete de tratamento por WhatsApp',
            contextoLog: { entidade: 'tratamento', tratamentoId: tratamento.id },
            executarEnvio: () => this.whatsappServico.enviarLembreteTratamento(
              `whatsapp:${telefonePaciente}`,
              nomePaciente,
              tratamento.nome,
              nomeProfissional
            )
          }) || notificacaoEnviada;
        }

        if (notificacaoEnviada) {
          const marcado = await this.tratamentoRepo.marcarTratamentoNotificado(tratamento.id);
          await this.registrarMarcacaoLog('tratamento', tratamento.id, marcado);
        } else {
          logger.warn({ entidade: 'tratamento', tratamentoId: tratamento.id }, 'Tratamento encontrado, mas nenhum canal enviou com sucesso');
        }
      }

      this.watermarkISO = new Date().toISOString();
      logger.info({ proximoWatermarkISO: this.watermarkISO }, 'Ciclo de mensageria finalizado');
    } catch (erro: unknown) {
      logger.error({ erro }, 'Erro no ciclo da mensageria');
    }
  }
}
