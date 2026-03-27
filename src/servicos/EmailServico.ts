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

export class EmailServico {
  private avisoConfiguracaoEmitido = false;

  private estaConfigurado(): boolean {
    return Boolean(ambiente.smtp.host && ambiente.smtp.usuario && ambiente.smtp.senha && ambiente.smtp.de);
  }

  private avisarNaoConfigurado(): void {
    if (!this.avisoConfiguracaoEmitido) {
      logger.warn('SMTP nao configurado; envios de email serao ignorados');
      this.avisoConfiguracaoEmitido = true;
    }
  }

  async enviarBoasVindasPaciente(destino: string, primeiroNome: string, _sobrenome: string | null, senhaTemporaria?: string | null): Promise<EnvioResultado> {
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
            ${senhaTemporaria ? `<p><strong>Senha temporaria:</strong> ${senhaTemporaria}</p>` : ''}
          </div>
          <p style="margin-top: 15px;">Por seguranca, altere sua senha apos o primeiro acesso.</p>
          <a href="https://trataz.com.br/login" style="display: inline-block; padding: 10px 20px; border-radius: 4px; color: #fff; background-color: #4CAF50; text-decoration: none;">Acessar a plataforma</a>
        </div>
      `;

      const mail = await transportador.sendMail({
        from: ambiente.smtp.de,
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

  async enviarBoasVindasProfissional(destino: string, primeiroNome: string, senhaTemporaria?: string | null): Promise<EnvioResultado> {
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
        ${senhaTemporaria ? `<p><strong>Senha temporaria:</strong> ${senhaTemporaria}</p>` : ''}
      `;

      const mail = await transportador.sendMail({
        from: ambiente.smtp.de,
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

  async enviarLembreteTratamento(destino: string, nomePaciente: string, nomeTratamento: string, nomeProfissional: string): Promise<EnvioResultado> {
    if (!this.estaConfigurado()) {
      this.avisarNaoConfigurado();
      return {
        status: 'skipped',
        reason: 'SMTP nao configurado'
      };
    }

    try {
      const html = `
        <h1>Ola ${nomePaciente}!</h1>
        <p>Este e um lembrete do seu tratamento no Trataz.</p>
        <h2>Tratamento: ${nomeTratamento}</h2>
        <p>Profissional: ${nomeProfissional}</p>
      `;

      const mail = await transportador.sendMail({
        from: ambiente.smtp.de,
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
        from: ambiente.smtp.de,
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
        from: ambiente.smtp.de,
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
