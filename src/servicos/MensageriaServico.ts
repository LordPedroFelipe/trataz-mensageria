import { Clinica } from '../dominio/entidades/Clinica';
import { PacienteRepositorio } from '../infra/repositorios/PacienteRepositorio';
import { ClinicaRepositorio } from '../infra/repositorios/ClinicaRepositorio';
import { PasswordResetRepositorio } from '../infra/repositorios/PasswordResetRepositorio';
import { ProfissionalRepositorio } from '../infra/repositorios/ProfissionalRepositorio';
import { ReminderRepositorio } from '../infra/repositorios/ReminderRepositorio';
import { TratamentoRepositorio } from '../infra/repositorios/TratamentoRepositorio';
import { ListarHistoricoInput, MessageDispatchAuditRepositorio } from '../infra/repositorios/MessageDispatchAuditRepositorio';
import { EmailServico } from './EmailServico';
import { WhatsappServico } from './WhatsappServico';
import { logger } from '../config/logger';
import { ambiente } from '../config/ambiente';
import { CanalNotificacao, EnvioResultado, EntityType, NotificationType } from '../compartilhado/tipos/mensageria';
import { MessageDispatchAudit } from '../dominio/entidades/MessageDispatchAudit';
import { Paciente } from '../dominio/entidades/Paciente';
import { PasswordReset } from '../dominio/entidades/PasswordReset';
import { Profissional } from '../dominio/entidades/Profissional';
import { Reminder } from '../dominio/entidades/Reminder';

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
    clinicas: number;
    passwordResets: number;
    reminders: number;
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

interface ReminderOcorrencia {
  reminderId: number;
  entityId: string;
  dateKey: string;
  horario: string;
  destination: string;
  nomePaciente: string;
  nomeTratamento: string;
  nomeProfissional: string;
  nomeConteudo: string | null;
}

interface DestinatarioPasswordSetup {
  entityType: 'patient' | 'professional' | 'clinic';
  entityId: number;
  email: string | null;
  telefone: string | null;
  primeiroNome: string;
  nomeCompleto: string;
}

interface ZonedParts {
  dateKey: string;
  timeKey: string;
  weekdayIndex: number;
}

export class MensageriaServico {
  private pacienteRepo = new PacienteRepositorio();
  private profissionalRepo = new ProfissionalRepositorio();
  private clinicaRepo = new ClinicaRepositorio();
  private tratamentoRepo = new TratamentoRepositorio();
  private passwordResetRepo = new PasswordResetRepositorio();
  private reminderRepo = new ReminderRepositorio();
  private auditRepo = new MessageDispatchAuditRepositorio();
  private emailServico = new EmailServico();
  private whatsappServico = new WhatsappServico();

  private watermarkISO: string = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  async dryRun(): Promise<ResultadoDryRunMensageria> {
    const geradoEm = new Date().toISOString();
    const itens = await this.gerarItensDryRun();
    const resultado: ResultadoDryRunMensageria = {
      watermarkISO: this.watermarkISO,
      geradoEm,
      totais: {
        pacientes: itens.filter((item) => item.tipo === 'patient').length,
        profissionais: itens.filter((item) => item.tipo === 'professional').length,
        tratamentos: itens.filter((item) => item.tipo === 'treatment').length,
        clinicas: itens.filter((item) => item.tipo === 'clinic').length,
        passwordResets: itens.filter((item) => item.tipo === 'password_reset').length,
        reminders: itens.filter((item) => item.tipo === 'reminder').length,
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

  async processarPasswordResetPorId(id: string): Promise<boolean> {
    const reset = await this.passwordResetRepo.buscarPasswordResetValidoPorId(id);
    return reset ? this.processarPasswordReset(reset) : false;
  }

  async processarPasswordSetupPorEntidade(entityType: 'patient' | 'professional' | 'clinic', id: number, passwordResetId: string): Promise<boolean> {
    const destinatario = await this.buscarDestinatarioPasswordSetup(entityType, id);
    if (!destinatario) {
      return false;
    }

    const passwordSetup = await this.passwordResetRepo.buscarPasswordSetupValidoPorId(passwordResetId);
    if (!passwordSetup?.token || passwordSetup.entityId !== destinatario.entityId) {
      return false;
    }

    return this.processarPasswordSetup(destinatario, passwordSetup);
  }

  async processarSenhaTemporariaPorEntidade(entityType: 'patient' | 'professional' | 'clinic', id: number): Promise<boolean> {
    if (entityType === 'patient') {
      const paciente = await this.pacienteRepo.buscarPorId(id);
      return paciente ? this.processarSenhaTemporariaPaciente(paciente) : false;
    }

    if (entityType === 'professional') {
      const profissional = await this.profissionalRepo.buscarPorId(id);
      return profissional ? this.processarSenhaTemporariaProfissional(profissional) : false;
    }

    const clinica = await this.clinicaRepo.buscarPorId(id);
    return clinica ? this.processarSenhaTemporariaClinica(clinica) : false;
  }

  async executarCicloManual(): Promise<void> {
    await this.ciclo();
  }

  private async gerarItensDryRun(): Promise<ItemDryRun[]> {
    const [pacientes, profissionais, tratamentos, pacientesSenha, profissionaisSenha, clinicasSenha, resets, reminders] = await Promise.all([
      this.pacienteRepo.buscarNovosApos(this.watermarkISO),
      this.profissionalRepo.buscarNovosApos(this.watermarkISO),
      this.tratamentoRepo.buscarNovosApos(this.watermarkISO),
      this.pacienteRepo.buscarComSenhaTemporariaAtualizadaApos(this.watermarkISO),
      this.profissionalRepo.buscarComSenhaTemporariaAtualizadaApos(this.watermarkISO),
      this.clinicaRepo.buscarComSenhaTemporariaAtualizadaApos(this.watermarkISO),
      this.passwordResetRepo.buscarPendentesApos(this.watermarkISO),
      this.reminderRepo.listarAtivos()
    ]);

    const itens: ItemDryRun[] = [];

    for (const paciente of pacientes) {
      const canais = await this.obterCanaisPendentes('patient', paciente.id, 'welcome_patient', paciente.email, paciente.telefone);
      if (canais.length > 0) {
        itens.push({ tipo: 'patient', id: paciente.id, nomeReferencia: this.nomePaciente(paciente), canais, destinos: { email: paciente.email, telefone: paciente.telefone }, motivo: 'Boas-vindas de paciente pendente' });
      }
    }

    for (const profissional of profissionais) {
      const canais = await this.obterCanaisPendentes('professional', profissional.id, 'welcome_professional', profissional.email, profissional.telefone);
      if (canais.length > 0) {
        itens.push({ tipo: 'professional', id: profissional.id, nomeReferencia: profissional.nomeCompleto || 'Profissional', canais, destinos: { email: profissional.email, telefone: profissional.telefone }, motivo: 'Boas-vindas de profissional pendente' });
      }
    }

    for (const tratamento of tratamentos) {
      const canais = await this.obterCanaisPendentes('treatment', tratamento.id, 'treatment_reminder', tratamento.paciente.email, tratamento.paciente.telefone);
      if (canais.length > 0) {
        itens.push({ tipo: 'treatment', id: tratamento.id, nomeReferencia: tratamento.nome, canais, destinos: { email: tratamento.paciente.email, telefone: tratamento.paciente.telefone }, motivo: `Lembrete inicial de tratamento para ${tratamento.paciente.primeiroNome}` });
      }
    }

    for (const paciente of pacientesSenha) {
      if (paciente.email && paciente.senhaTemporaria && !await this.auditRepo.existeSucesso('patient', this.chaveSenhaTemporaria(paciente.id, paciente.senhaTemporaria), 'temp_password_patient', 'email')) {
        itens.push({ tipo: 'patient', id: this.chaveSenhaTemporaria(paciente.id, paciente.senhaTemporaria), nomeReferencia: this.nomePaciente(paciente), canais: ['email'], destinos: { email: paciente.email, telefone: null }, motivo: 'Senha temporaria de paciente pendente' });
      }
    }

    for (const profissional of profissionaisSenha) {
      if (profissional.email && profissional.senhaTemporaria && !await this.auditRepo.existeSucesso('professional', this.chaveSenhaTemporaria(profissional.id, profissional.senhaTemporaria), 'temp_password_professional', 'email')) {
        itens.push({ tipo: 'professional', id: this.chaveSenhaTemporaria(profissional.id, profissional.senhaTemporaria), nomeReferencia: profissional.nomeCompleto || 'Profissional', canais: ['email'], destinos: { email: profissional.email, telefone: null }, motivo: 'Senha temporaria de profissional pendente' });
      }
    }

    for (const clinica of clinicasSenha) {
      if (clinica.email && clinica.senhaTemporaria && !await this.auditRepo.existeSucesso('clinic', this.chaveSenhaTemporaria(clinica.id, clinica.senhaTemporaria), 'temp_password_clinic', 'email')) {
        itens.push({ tipo: 'clinic', id: this.chaveSenhaTemporaria(clinica.id, clinica.senhaTemporaria), nomeReferencia: clinica.nome, canais: ['email'], destinos: { email: clinica.email, telefone: clinica.telefone }, motivo: 'Senha temporaria de clinica pendente' });
      }
    }

    for (const reset of resets) {
      if (!await this.auditRepo.existeSucesso('password_reset', reset.id, 'password_reset', 'email')) {
        itens.push({ tipo: 'password_reset', id: reset.id, nomeReferencia: reset.email, canais: ['email'], destinos: { email: reset.email, telefone: null }, motivo: 'Email de recuperacao de senha pendente' });
      }
    }

    const remindersDue = await this.listarOcorrenciasDue(reminders, this.obterJanelaInicial(), new Date());
    for (const ocorrencia of remindersDue) {
      itens.push({ tipo: 'reminder', id: ocorrencia.entityId, nomeReferencia: ocorrencia.nomeTratamento, canais: ['email'], destinos: { email: ocorrencia.destination, telefone: null }, motivo: `Lembrete recorrente do tratamento para ${ocorrencia.nomePaciente} em ${ocorrencia.dateKey} ${ocorrencia.horario}` });
    }

    return itens;
  }

  private obterJanelaInicial(): Date {
    return new Date(this.watermarkISO);
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

  private async registrarMarcacaoLog(entidade: 'paciente' | 'profissional' | 'tratamento' | 'clinica', id: number, marcado: boolean): Promise<void> {
    if (marcado) {
      logger.info({ entidade, id }, 'Registro marcado como notificado na tabela de origem');
      return;
    }

    logger.info({ entidade, id }, 'Tabela de auditoria passou a ser a fonte de verdade do envio');
  }

  private nomePaciente(paciente: Paciente): string {
    return [paciente.primeiroNome, paciente.sobrenome].filter(Boolean).join(' ').trim() || 'Paciente';
  }

  private primeiroNomeProfissional(profissional: Profissional): string {
    return profissional.nomeCompleto?.split(' ')[0] || 'Profissional';
  }

  private construirPasswordSetupLink(token: string): string {
    const baseUrl = ambiente.frontendUrl.replace(/\/+$/, '');
    return `${baseUrl}/nova-senha?token=${encodeURIComponent(token)}`;
  }

  private obterNotificationTypePasswordSetup(entityType: DestinatarioPasswordSetup['entityType']): Extract<NotificationType, 'password_setup_link_patient' | 'password_setup_link_professional' | 'password_setup_link_clinic'> {
    if (entityType === 'patient') {
      return 'password_setup_link_patient';
    }

    if (entityType === 'professional') {
      return 'password_setup_link_professional';
    }

    return 'password_setup_link_clinic';
  }

  private async buscarDestinatarioPasswordSetup(entityType: 'patient' | 'professional' | 'clinic', id: number): Promise<DestinatarioPasswordSetup | null> {
    if (entityType === 'patient') {
      const paciente = await this.pacienteRepo.buscarPorId(id);
      if (!paciente) {
        return null;
      }

      return {
        entityType,
        entityId: paciente.id,
        email: paciente.email,
        telefone: paciente.telefone,
        primeiroNome: paciente.primeiroNome || 'Paciente',
        nomeCompleto: this.nomePaciente(paciente)
      };
    }

    if (entityType === 'professional') {
      const profissional = await this.profissionalRepo.buscarPorId(id);
      if (!profissional) {
        return null;
      }

      return {
        entityType,
        entityId: profissional.id,
        email: profissional.email,
        telefone: profissional.telefone,
        primeiroNome: this.primeiroNomeProfissional(profissional),
        nomeCompleto: profissional.nomeCompleto || 'Profissional'
      };
    }

    const clinica = await this.clinicaRepo.buscarPorId(id);
    if (!clinica) {
      return null;
    }

    return {
      entityType,
      entityId: clinica.id,
      email: clinica.email,
      telefone: clinica.telefone,
      primeiroNome: clinica.nome || 'Clinica',
      nomeCompleto: clinica.nome || 'Clinica'
    };
  }

  private chaveSenhaTemporaria(id: number, senhaTemporaria: string): string {
    return `${id}:${senhaTemporaria}`;
  }

  private extrairPrimeiroNomeDoEmail(email: string): string {
    const prefixo = email.split('@')[0] ?? 'Usuario';
    const normalizado = prefixo.replace(/[._-]+/g, ' ').trim();
    return normalizado.length > 0 ? normalizado : 'Usuario';
  }

  private async processarPasswordSetup(destinatario: DestinatarioPasswordSetup, passwordSetup: PasswordReset): Promise<boolean> {
    if (!passwordSetup.token) {
      logger.warn({ passwordResetId: passwordSetup.id }, 'Password setup sem token nao pode ser enviado');
      return false;
    }

    const notificationType = this.obterNotificationTypePasswordSetup(destinatario.entityType);
    const entityIdAuditoria = passwordSetup.id;
    const setupLink = this.construirPasswordSetupLink(passwordSetup.token);
    let envioRealizado = false;

    if (destinatario.email) {
      envioRealizado = await this.processarCanal({
        entityType: destinatario.entityType,
        entityId: entityIdAuditoria,
        notificationType,
        channel: 'email',
        destination: destinatario.email,
        reason: 'Link de definicao inicial de senha por email',
        contextoLog: {
          entidade: destinatario.entityType,
          entityId: destinatario.entityId,
          passwordResetId: passwordSetup.id
        },
        executarEnvio: () => this.emailServico.enviarLinkDefinicaoSenha(
          destinatario.email as string,
          destinatario.primeiroNome,
          passwordSetup.token as string
        )
      }) || envioRealizado;
    }

    if (destinatario.telefone) {
      const destinoWhatsapp = this.whatsappServico.normalizarDestinoWhatsApp(destinatario.telefone);
      envioRealizado = await this.processarCanal({
        entityType: destinatario.entityType,
        entityId: entityIdAuditoria,
        notificationType,
        channel: 'whatsapp',
        destination: destinoWhatsapp,
        reason: 'Link de definicao inicial de senha por WhatsApp',
        contextoLog: {
          entidade: destinatario.entityType,
          entityId: destinatario.entityId,
          passwordResetId: passwordSetup.id
        },
        executarEnvio: () => this.whatsappServico.enviarLinkDefinicaoSenhaWhatsApp({
          paraWhatsApp: destinatario.telefone as string,
          primeiroNome: destinatario.primeiroNome,
          link: setupLink
        })
      }) || envioRealizado;
    }

    return envioRealizado;
  }

  private async processarSenhaTemporariaPaciente(paciente: Paciente): Promise<boolean> {
    if (!paciente.email || !paciente.senhaTemporaria) {
      return false;
    }

    const sucesso = await this.processarCanal({
      entityType: 'patient',
      entityId: this.chaveSenhaTemporaria(paciente.id, paciente.senhaTemporaria),
      notificationType: 'temp_password_patient',
      channel: 'email',
      destination: paciente.email,
      reason: 'Senha temporaria de paciente por email',
      contextoLog: { entidade: 'paciente', pacienteId: paciente.id },
      executarEnvio: () => this.emailServico.enviarSenhaTemporaria(
        paciente.email as string,
        paciente.primeiroNome || 'Paciente',
        paciente.senhaTemporaria as string
      )
    });

    if (sucesso) {
      const marcado = await this.pacienteRepo.marcarSenhaTemporariaEnviada(paciente.id);
      await this.registrarMarcacaoLog('paciente', paciente.id, marcado);
    }

    return sucesso;
  }

  private async processarSenhaTemporariaProfissional(profissional: Profissional): Promise<boolean> {
    if (!profissional.email || !profissional.senhaTemporaria) {
      return false;
    }

    const sucesso = await this.processarCanal({
      entityType: 'professional',
      entityId: this.chaveSenhaTemporaria(profissional.id, profissional.senhaTemporaria),
      notificationType: 'temp_password_professional',
      channel: 'email',
      destination: profissional.email,
      reason: 'Senha temporaria de profissional por email',
      contextoLog: { entidade: 'profissional', profissionalId: profissional.id },
      executarEnvio: () => this.emailServico.enviarSenhaTemporaria(
        profissional.email as string,
        this.primeiroNomeProfissional(profissional),
        profissional.senhaTemporaria as string
      )
    });

    if (sucesso) {
      const marcado = await this.profissionalRepo.marcarSenhaTemporariaEnviada(profissional.id);
      await this.registrarMarcacaoLog('profissional', profissional.id, marcado);
    }

    return sucesso;
  }

  private async processarSenhaTemporariaClinica(clinica: Clinica): Promise<boolean> {
    if (!clinica.email || !clinica.senhaTemporaria) {
      return false;
    }

    const sucesso = await this.processarCanal({
      entityType: 'clinic',
      entityId: this.chaveSenhaTemporaria(clinica.id, clinica.senhaTemporaria),
      notificationType: 'temp_password_clinic',
      channel: 'email',
      destination: clinica.email,
      reason: 'Senha temporaria de clinica por email',
      contextoLog: { entidade: 'clinica', clinicaId: clinica.id },
      executarEnvio: () => this.emailServico.enviarSenhaTemporaria(
        clinica.email as string,
        clinica.nome || 'Clinica',
        clinica.senhaTemporaria as string
      )
    });

    if (sucesso) {
      const marcado = await this.clinicaRepo.marcarSenhaTemporariaEnviada(clinica.id);
      await this.registrarMarcacaoLog('clinica', clinica.id, marcado);
    }

    return sucesso;
  }

  private async processarPasswordReset(reset: PasswordReset): Promise<boolean> {
    if (!reset.code) {
      logger.warn({ passwordResetId: reset.id }, 'Password reset sem code nao pode ser enviado');
      return false;
    }

    const codigo = reset.code;

    return this.processarCanal({
      entityType: 'password_reset',
      entityId: reset.id,
      notificationType: 'password_reset',
      channel: 'email',
      destination: reset.email,
      reason: 'Recuperacao de senha por email',
      contextoLog: { entidade: 'password_reset', passwordResetId: reset.id, email: reset.email },
      executarEnvio: () => this.emailServico.enviarRecuperacaoSenha(
        reset.email,
        this.extrairPrimeiroNomeDoEmail(reset.email),
        codigo
      )
    });
  }

  private async processarReminderRecorrente(ocorrencia: ReminderOcorrencia): Promise<boolean> {
    return this.processarCanal({
      entityType: 'reminder',
      entityId: ocorrencia.entityId,
      notificationType: 'recurring_treatment_reminder',
      channel: 'email',
      destination: ocorrencia.destination,
      reason: `Lembrete recorrente de tratamento para ${ocorrencia.dateKey} ${ocorrencia.horario}`,
      contextoLog: { entidade: 'reminder', reminderId: ocorrencia.reminderId, data: ocorrencia.dateKey, horario: ocorrencia.horario },
      executarEnvio: () => this.emailServico.enviarLembreteTratamento(
        ocorrencia.destination,
        ocorrencia.nomePaciente,
        ocorrencia.nomeConteudo ? `${ocorrencia.nomeTratamento} - ${ocorrencia.nomeConteudo}` : ocorrencia.nomeTratamento,
        ocorrencia.nomeProfissional
      )
    });
  }

  private async listarOcorrenciasDue(reminders: Reminder[], inicio: Date, fim: Date): Promise<ReminderOcorrencia[]> {
    const ocorrencias: ReminderOcorrencia[] = [];

    for (const reminder of reminders) {
      const horarios = this.normalizarHorarios(reminder.horarios);
      const diasSemana = this.normalizarDiasSemana(reminder.diasSemana);

      if (horarios.length === 0 || !reminder.paciente.email) {
        continue;
      }

      const ocorrenciasReminder = this.calcularOcorrenciasReminder(reminder, horarios, diasSemana, inicio, fim);
      for (const ocorrencia of ocorrenciasReminder) {
        if (!await this.auditRepo.existeSucesso('reminder', ocorrencia.entityId, 'recurring_treatment_reminder', 'email')) {
          ocorrencias.push(ocorrencia);
        }
      }
    }

    return ocorrencias;
  }

  private calcularOcorrenciasReminder(reminder: Reminder, horarios: string[], diasSemana: number[] | null, inicio: Date, fim: Date): ReminderOcorrencia[] {
    const ocorrencias: ReminderOcorrencia[] = [];
    const inicioLocal = this.obterPartesTimezone(inicio);
    const fimLocal = this.obterPartesTimezone(fim);
    const datas = Array.from(new Set([inicioLocal.dateKey, fimLocal.dateKey]));

    for (const dateKey of datas) {
      const partesData = this.obterPartesTimezone(this.construirDataRepresentativa(dateKey));
      if (reminder.tipo === 'SPECIFIC_DAYS' && diasSemana && !diasSemana.includes(partesData.weekdayIndex)) {
        continue;
      }

      for (const horario of horarios) {
        if (!this.estaNoIntervaloLocal(dateKey, horario, inicioLocal, fimLocal)) {
          continue;
        }

        ocorrencias.push({
          reminderId: reminder.id,
          entityId: `${reminder.id}:${dateKey}:${horario}`,
          dateKey,
          horario,
          destination: reminder.paciente.email as string,
          nomePaciente: reminder.paciente.primeiroNome,
          nomeTratamento: reminder.tratamento.nome,
          nomeProfissional: reminder.tratamento.profissional.nomeCompleto,
          nomeConteudo: reminder.conteudo?.titulo ?? null
        });
      }
    }

    return ocorrencias;
  }

  private normalizarHorarios(horarios: unknown): string[] {
    if (!Array.isArray(horarios)) {
      return [];
    }

    return horarios
      .filter((horario): horario is string => typeof horario === 'string')
      .map((horario) => horario.trim().slice(0, 5))
      .filter((horario) => /^\d{2}:\d{2}$/.test(horario));
  }

  private normalizarDiasSemana(diasSemana: unknown): number[] | null {
    if (!Array.isArray(diasSemana)) {
      return null;
    }

    const mapa: Record<string, number> = {
      SUNDAY: 0,
      MONDAY: 1,
      TUESDAY: 2,
      WEDNESDAY: 3,
      THURSDAY: 4,
      FRIDAY: 5,
      SATURDAY: 6,
      DOMINGO: 0,
      SEGUNDA: 1,
      TERCA: 2,
      QUARTA: 3,
      QUINTA: 4,
      SEXTA: 5,
      SABADO: 6
    };

    const dias = diasSemana
      .map((dia): number | null => {
        if (typeof dia === 'number' && dia >= 0 && dia <= 6) {
          return dia;
        }

        if (typeof dia === 'string') {
          return mapa[dia.trim().toUpperCase()] ?? null;
        }

        return null;
      })
      .filter((dia): dia is number => dia !== null);

    return dias.length > 0 ? dias : null;
  }

  private obterPartesTimezone(data: Date): ZonedParts {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: ambiente.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'long'
    }).formatToParts(data);

    const mapa = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
    const weekdayMap: Record<string, number> = {
      SUNDAY: 0,
      MONDAY: 1,
      TUESDAY: 2,
      WEDNESDAY: 3,
      THURSDAY: 4,
      FRIDAY: 5,
      SATURDAY: 6
    };

    return {
      dateKey: `${mapa.year}-${mapa.month}-${mapa.day}`,
      timeKey: `${mapa.hour}:${mapa.minute}`,
      weekdayIndex: weekdayMap[(mapa.weekday ?? '').toUpperCase()] ?? 0
    };
  }

  private construirDataRepresentativa(dateKey: string): Date {
    return new Date(`${dateKey}T12:00:00.000Z`);
  }

  private estaNoIntervaloLocal(dateKey: string, horario: string, inicio: ZonedParts, fim: ZonedParts): boolean {
    if (inicio.dateKey === fim.dateKey) {
      return dateKey === inicio.dateKey && horario >= inicio.timeKey && horario <= fim.timeKey;
    }

    return (dateKey === inicio.dateKey && horario >= inicio.timeKey)
      || (dateKey === fim.dateKey && horario <= fim.timeKey);
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
              paciente.sobrenome
            )
          }) || notificacaoEnviada;
        }

        if (paciente.telefone) {
          const destinoWhatsapp = this.whatsappServico.normalizarDestinoWhatsApp(paciente.telefone);
          notificacaoEnviada = await this.processarCanal({
            entityType: 'patient',
            entityId: paciente.id,
            notificationType: 'welcome_patient',
            channel: 'whatsapp',
            destination: destinoWhatsapp,
            reason: 'Boas-vindas de paciente por WhatsApp',
            contextoLog: { entidade: 'paciente', pacienteId: paciente.id },
            executarEnvio: () => this.whatsappServico.enviarBoasVindasWhatsApp({
              paraWhatsApp: paciente.telefone as string,
              email: paciente.email ?? '',
              primeiroNome,
              sobrenome: paciente.sobrenome,
              tipoUsuario: 'Paciente'
            })
          }) || notificacaoEnviada;
        }

        if (notificacaoEnviada) {
          const marcado = await this.pacienteRepo.marcarBoasVindasEnviado(paciente.id);
          await this.registrarMarcacaoLog('paciente', paciente.id, marcado);
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
              primeiroNome
            )
          }) || notificacaoEnviada;
        }

        if (profissional.telefone) {
          const destinoWhatsapp = this.whatsappServico.normalizarDestinoWhatsApp(profissional.telefone);
          notificacaoEnviada = await this.processarCanal({
            entityType: 'professional',
            entityId: profissional.id,
            notificationType: 'welcome_professional',
            channel: 'whatsapp',
            destination: destinoWhatsapp,
            reason: 'Boas-vindas de profissional por WhatsApp',
            contextoLog: { entidade: 'profissional', profissionalId: profissional.id },
            executarEnvio: () => this.whatsappServico.enviarBoasVindasWhatsApp({
              paraWhatsApp: profissional.telefone as string,
              email: profissional.email ?? '',
              primeiroNome,
              tipoUsuario: 'Profissional'
            })
          }) || notificacaoEnviada;
        }

        if (notificacaoEnviada) {
          const marcado = await this.profissionalRepo.marcarBoasVindasEnviado(profissional.id);
          await this.registrarMarcacaoLog('profissional', profissional.id, marcado);
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
          const destinoWhatsapp = this.whatsappServico.normalizarDestinoWhatsApp(telefonePaciente);
          notificacaoEnviada = await this.processarCanal({
            entityType: 'treatment',
            entityId: tratamento.id,
            notificationType: 'treatment_reminder',
            channel: 'whatsapp',
            destination: destinoWhatsapp,
            reason: 'Lembrete de tratamento por WhatsApp',
            contextoLog: { entidade: 'tratamento', tratamentoId: tratamento.id },
            executarEnvio: () => this.whatsappServico.enviarTratamentoNovo(
              telefonePaciente,
              nomePaciente,
              nomeProfissional
            )
          }) || notificacaoEnviada;
        }

        if (notificacaoEnviada) {
          const marcado = await this.tratamentoRepo.marcarTratamentoNotificado(tratamento.id);
          await this.registrarMarcacaoLog('tratamento', tratamento.id, marcado);
        }
      }

      const pacientesSenha = await this.pacienteRepo.buscarComSenhaTemporariaAtualizadaApos(this.watermarkISO);
      logger.info({ total: pacientesSenha.length }, 'Pacientes com senha temporaria encontrados');
      for (const paciente of pacientesSenha) {
        await this.processarSenhaTemporariaPaciente(paciente);
      }

      const profissionaisSenha = await this.profissionalRepo.buscarComSenhaTemporariaAtualizadaApos(this.watermarkISO);
      logger.info({ total: profissionaisSenha.length }, 'Profissionais com senha temporaria encontrados');
      for (const profissional of profissionaisSenha) {
        await this.processarSenhaTemporariaProfissional(profissional);
      }

      const clinicasSenha = await this.clinicaRepo.buscarComSenhaTemporariaAtualizadaApos(this.watermarkISO);
      logger.info({ total: clinicasSenha.length }, 'Clinicas com senha temporaria encontradas');
      for (const clinica of clinicasSenha) {
        await this.processarSenhaTemporariaClinica(clinica);
      }

      const resets = await this.passwordResetRepo.buscarPendentesApos(this.watermarkISO);
      logger.info({ total: resets.length }, 'Password resets pendentes encontrados');
      for (const reset of resets) {
        await this.processarPasswordReset(reset);
      }

      const reminders = await this.reminderRepo.listarAtivos();
      const ocorrenciasDue = await this.listarOcorrenciasDue(reminders, this.obterJanelaInicial(), inicioCiclo);
      logger.info({ total: ocorrenciasDue.length }, 'Ocorrencias de reminders recorrentes encontradas');
      for (const ocorrencia of ocorrenciasDue) {
        await this.processarReminderRecorrente(ocorrencia);
      }

      this.watermarkISO = new Date().toISOString();
      logger.info({ proximoWatermarkISO: this.watermarkISO }, 'Ciclo de mensageria finalizado');
    } catch (erro: unknown) {
      logger.error({ erro }, 'Erro no ciclo da mensageria');
    }
  }
}
