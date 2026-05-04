import nodemailer from 'nodemailer';
import { ambiente } from '../config/ambiente';
import { logger } from '../config/logger';
import { EnvioResultado } from '../compartilhado/tipos/mensageria';

const transportador = nodemailer.createTransport({
  host: ambiente.smtp.host,
  port: ambiente.smtp.port,
  secure: ambiente.smtp.seguro,
  auth: {
    user: ambiente.smtp.usuario,
    pass: ambiente.smtp.senha
  }
});

const remetenteFormatado = `"Trataz - Contato" <${ambiente.smtp.de}>`;

export class EmailServico {
  private avisoConfiguracaoEmitido = false;

  private construirPasswordSetupLink(token: string): string {
    const baseUrl = ambiente.frontendUrl.replace(/\/+$/, '');
    return `${baseUrl}/new-password?token=${encodeURIComponent(token)}`;
  }

  private construirDashboardTratamentoLink(treatmentId: number): string {
    const baseUrl = ambiente.frontendUrl.replace(/\/+$/, '');
    return `${baseUrl}/patient-dashboard?treatmentId=${encodeURIComponent(String(treatmentId))}`;
  }

  private estaConfigurado(): boolean {
    return Boolean(ambiente.smtp.host && ambiente.smtp.usuario && ambiente.smtp.senha && ambiente.smtp.de);
  }

  private avisarNaoConfigurado(): void {
    if (!this.avisoConfiguracaoEmitido) {
      logger.warn('SMTP nao configurado; envios de email serao ignorados');
      this.avisoConfiguracaoEmitido = true;
    }
  }

  async enviarBoasVindasPaciente(destino: string, primeiroNome: string, _sobrenome: string | null): Promise<EnvioResultado> {
    if (!this.estaConfigurado()) {
      this.avisarNaoConfigurado();
      return {
        status: 'skipped',
        reason: 'SMTP nao configurado'
      };
    }

    try {
      const html = `
        <div style="font-family: Arial; padding: 20px; border-radius: 8px; background-color: #f9f9f9; text-align: center;">
          <h2 style="color: #4CAF50;">Bem-vindo(a) ao Trataz, <b>${primeiroNome}</b>!</h2>
          <p>Seu cadastro foi realizado com sucesso!</p>
          <div style="background-color: #fff; padding: 10px; border-radius: 5px; box-shadow: 0 0 5px rgba(0,0,0,0.1);">
            <p><strong>Email cadastrado:</strong> ${destino}</p>
          </div>
          <p style="margin-top: 15px;">Seu acesso sera liberado com o fluxo de onboarding enviado pelos canais configurados.</p>
          <a href="https://trataz.com.br/login" style="display: inline-block; padding: 10px 20px; border-radius: 4px; color: #fff; background-color: #4CAF50; text-decoration: none;">Acessar a plataforma</a>
        </div>
      `;

      const mail = await transportador.sendMail({
        from: remetenteFormatado,
        to: destino,
        subject: 'Bem-vindo(a) ao Trataz!',
        html
      });

      logger.info({ mensagemId: mail.messageId }, 'Email de boas-vindas enviado (paciente)');
      return {
        status: 'success',
        reason: 'Email de boas-vindas para paciente enviado com sucesso',
        providerMessageId: mail.messageId
      };
    } catch (erro: unknown) {
      const errorMessage = erro instanceof Error ? erro.message : 'Falha desconhecida ao enviar email';
      logger.error({ erro, destino }, 'Falha ao enviar email de boas-vindas (paciente)');
      return {
        status: 'failed',
        reason: 'Falha no envio de email de boas-vindas para paciente',
        errorMessage
      };
    }
  }

  async enviarBoasVindasProfissional(destino: string, primeiroNome: string): Promise<EnvioResultado> {
    if (!this.estaConfigurado()) {
      this.avisarNaoConfigurado();
      return {
        status: 'skipped',
        reason: 'SMTP nao configurado'
      };
    }

    try {
      const html = `
        <h1>Bem-vindo(a) ao Trataz, ${primeiroNome}!</h1>
        <p>Seu cadastro como profissional foi concluido.</p>
        <p>Seu acesso sera liberado com o fluxo de onboarding enviado pelos canais configurados.</p>
      `;

      const mail = await transportador.sendMail({
        from: remetenteFormatado,
        to: destino,
        subject: 'Bem-vindo(a) ao Trataz (Profissional)',
        html
      });

      logger.info({ mensagemId: mail.messageId }, 'Email de boas-vindas enviado (profissional)');
      return {
        status: 'success',
        reason: 'Email de boas-vindas para profissional enviado com sucesso',
        providerMessageId: mail.messageId
      };
    } catch (erro: unknown) {
      const errorMessage = erro instanceof Error ? erro.message : 'Falha desconhecida ao enviar email';
      logger.error({ erro, destino }, 'Falha ao enviar email de boas-vindas (profissional)');
      return {
        status: 'failed',
        reason: 'Falha no envio de email de boas-vindas para profissional',
        errorMessage
      };
    }
  }

  async enviarLembreteTratamento(
    destino: string,
    nomePaciente: string,
    nomeTratamento: string,
    nomeProfissional: string,
    treatmentId: number,
    horarioProgramado?: string | null
  ): Promise<EnvioResultado> {
    if (!this.estaConfigurado()) {
      this.avisarNaoConfigurado();
      return {
        status: 'skipped',
        reason: 'SMTP nao configurado'
      };
    }

    try {
      const tratamentoLink = this.construirDashboardTratamentoLink(treatmentId);
      const blocoHorario = horarioProgramado
        ? `<p><strong>Horario:</strong> ${horarioProgramado}</p>`
        : '';
      const html = `
        <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #f7f9fc; border-radius: 12px; color: #1f2937;">
          <h1 style="margin: 0 0 16px; color: #0f766e;">Ola ${nomePaciente}!</h1>
          <p style="margin: 0 0 16px;">Este e um lembrete do seu tratamento no Trataz.</p>
          <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0 0 10px;"><strong>Tratamento:</strong> ${nomeTratamento}</p>
            ${blocoHorario}
            <p style="margin: 0;"><strong>Profissional:</strong> ${nomeProfissional}</p>
          </div>
          <p style="margin: 0 0 18px;">Clique no botao abaixo para abrir direto os detalhes do seu tratamento.</p>
          <p style="margin: 0 0 18px;">
            <a href="${tratamentoLink}" style="display: inline-block; padding: 12px 20px; border-radius: 8px; color: #ffffff; background-color: #0f766e; text-decoration: none; font-weight: 700;">
              Abrir tratamento
            </a>
          </p>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">Se preferir, copie e cole este link no navegador:</p>
          <p style="margin: 8px 0 0; font-size: 14px; word-break: break-all; color: #374151;">${tratamentoLink}</p>
        </div>
      `;

      const mail = await transportador.sendMail({
        from: remetenteFormatado,
        to: destino,
        subject: 'Lembrete do Tratamento - Trataz',
        html
      });

      logger.info({ mensagemId: mail.messageId }, 'Email de lembrete de tratamento enviado');
      return {
        status: 'success',
        reason: 'Email de lembrete de tratamento enviado com sucesso',
        providerMessageId: mail.messageId
      };
    } catch (erro: unknown) {
      const errorMessage = erro instanceof Error ? erro.message : 'Falha desconhecida ao enviar email';
      logger.error({ erro, destino }, 'Falha ao enviar email de lembrete de tratamento');
      return {
        status: 'failed',
        reason: 'Falha no envio de email de lembrete de tratamento',
        errorMessage
      };
    }
  }

  async enviarSenhaTemporaria(destino: string, primeiroNome: string, senhaTemporaria: string): Promise<EnvioResultado> {
    if (!this.estaConfigurado()) {
      this.avisarNaoConfigurado();
      return {
        status: 'skipped',
        reason: 'SMTP nao configurado'
      };
    }

    try {
      const html = `
        <div style="font-family: Arial; padding: 20px; border-radius: 8px; background-color: #f9f9f9;">
          <h1>Ola ${primeiroNome}!</h1>
          <p>Sua conta foi criada ou atualizada com sucesso no Trataz.</p>
          <p>Use a senha temporaria abaixo para fazer seu proximo acesso:</p>
          <p><strong>Email:</strong> ${destino}</p>
          <p><strong>Senha temporaria:</strong> ${senhaTemporaria}</p>
          <p>Por seguranca, recomendamos trocar essa senha apos entrar na plataforma.</p>
        </div>
      `;

      const mail = await transportador.sendMail({
        from: remetenteFormatado,
        to: destino,
        subject: 'Trataz - Suas credenciais de acesso',
        html
      });

      logger.info({ mensagemId: mail.messageId }, 'Email de senha temporaria enviado');
      return {
        status: 'success',
        reason: 'Email de senha temporaria enviado com sucesso',
        providerMessageId: mail.messageId
      };
    } catch (erro: unknown) {
      const errorMessage = erro instanceof Error ? erro.message : 'Falha desconhecida ao enviar email';
      logger.error({ erro, destino }, 'Falha ao enviar email de senha temporaria');
      return {
        status: 'failed',
        reason: 'Falha no envio de email de senha temporaria',
        errorMessage
      };
    }
  }

  async enviarLinkDefinicaoSenha(destino: string, primeiroNome: string, token: string): Promise<EnvioResultado> {
    if (!this.estaConfigurado()) {
      this.avisarNaoConfigurado();
      return {
        status: 'skipped',
        reason: 'SMTP nao configurado'
      };
    }

    try {
      const setupLink = this.construirPasswordSetupLink(token);
      const html = `
        <div style="font-family: Arial; padding: 20px; border-radius: 8px; background-color: #f9f9f9;">
          <h1>Ola ${primeiroNome}!</h1>
          <p>Seu acesso ao Trataz foi criado com sucesso.</p>
          <p>Para cadastrar sua senha, clique no botao abaixo:</p>
          <p>
            <a href="${setupLink}" style="display: inline-block; padding: 10px 20px; border-radius: 4px; color: #fff; background-color: #4CAF50; text-decoration: none;">
              Definir minha senha
            </a>
          </p>
          <p>Se preferir, copie e cole este link no navegador:</p>
          <p>${setupLink}</p>
          <p>Esse link expira automaticamente. Se ele nao funcionar, solicite um novo acesso.</p>
        </div>
      `;

      const mail = await transportador.sendMail({
        from: remetenteFormatado,
        to: destino,
        subject: 'Trataz - Defina sua senha',
        html
      });

      logger.info({ mensagemId: mail.messageId }, 'Email de definicao inicial de senha enviado');
      return {
        status: 'success',
        reason: 'Email de definicao inicial de senha enviado com sucesso',
        providerMessageId: mail.messageId
      };
    } catch (erro: unknown) {
      const errorMessage = erro instanceof Error ? erro.message : 'Falha desconhecida ao enviar email';
      logger.error({ erro, destino }, 'Falha ao enviar email de definicao inicial de senha');
      return {
        status: 'failed',
        reason: 'Falha no envio de email de definicao inicial de senha',
        errorMessage
      };
    }
  }

  async enviarRecuperacaoSenha(destino: string, primeiroNome: string, codigo: string): Promise<EnvioResultado> {
    if (!this.estaConfigurado()) {
      this.avisarNaoConfigurado();
      return {
        status: 'skipped',
        reason: 'SMTP nao configurado'
      };
    }

    try {
      const resetLink = `${ambiente.frontendUrl.replace(/\/$/, '')}/forgot-password?code=${encodeURIComponent(codigo)}&email=${encodeURIComponent(destino)}`;
      const html = `
        <div style="font-family: Arial; padding: 20px; border-radius: 8px; background-color: #f9f9f9;">
          <h1>Ola ${primeiroNome}!</h1>
          <p>Voce solicitou a recuperacao de senha da sua conta no Trataz.</p>
          <p>
            <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; border-radius: 4px; color: #fff; background-color: #4CAF50; text-decoration: none;">
              Redefinir senha
            </a>
          </p>
          <p>Se preferir, copie e cole este link no navegador:</p>
          <p>${resetLink}</p>
          <p>Se voce nao solicitou essa recuperacao, ignore este email.</p>
        </div>
      `;

      const mail = await transportador.sendMail({
        from: remetenteFormatado,
        to: destino,
        subject: 'Recuperacao de senha - Trataz',
        html
      });

      logger.info({ mensagemId: mail.messageId }, 'Email de recuperacao de senha enviado');
      return {
        status: 'success',
        reason: 'Email de recuperacao de senha enviado com sucesso',
        providerMessageId: mail.messageId
      };
    } catch (erro: unknown) {
      const errorMessage = erro instanceof Error ? erro.message : 'Falha desconhecida ao enviar email';
      logger.error({ erro, destino }, 'Falha ao enviar email de recuperacao de senha');
      return {
        status: 'failed',
        reason: 'Falha no envio de email de recuperacao de senha',
        errorMessage
      };
    }
  }
}
