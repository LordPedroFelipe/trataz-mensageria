import twilio from 'twilio';
import { ambiente } from '../config/ambiente';
import { logger } from '../config/logger';
import { EnvioResultado } from '../compartilhado/tipos/mensageria';

const cliente = twilio(ambiente.twilio.sid, ambiente.twilio.token);

export class WhatsappServico {
  private avisoConfiguracaoEmitido = false;

  private estaConfigurado(): boolean {
    return Boolean(ambiente.twilio.sid && ambiente.twilio.token && ambiente.twilio.origemWhatsApp);
  }

  private avisarNaoConfigurado(): void {
    if (!this.avisoConfiguracaoEmitido) {
      logger.warn('Twilio nao configurado; envios de WhatsApp serao ignorados');
      this.avisoConfiguracaoEmitido = true;
    }
  }

  async enviarBoasVindasWhatsApp(paraWhatsApp: string, email: string, primeiroNome: string, senhaTemporaria?: string | null): Promise<EnvioResultado> {
    if (!this.estaConfigurado()) {
      this.avisarNaoConfigurado();
      return {
        status: 'skipped',
        reason: 'Twilio nao configurado'
      };
    }

    try {
      const corpo = `Ola ${primeiroNome}! Bem-vindo(a) ao Trataz. Seu email: ${email}.` +
        (senhaTemporaria ? ` Senha temporaria: ${senhaTemporaria}` : '');

      const msg = await cliente.messages.create({
        from: ambiente.twilio.origemWhatsApp,
        to: paraWhatsApp,
        body: corpo
      });

      logger.info({ sid: msg.sid }, 'WhatsApp de boas-vindas enviado');
      return {
        status: 'success',
        reason: 'WhatsApp de boas-vindas enviado com sucesso',
        providerMessageId: msg.sid
      };
    } catch (erro: unknown) {
      const errorMessage = erro instanceof Error ? erro.message : 'Falha desconhecida ao enviar WhatsApp';
      logger.error({ erro, paraWhatsApp }, 'Falha ao enviar WhatsApp de boas-vindas');
      return {
        status: 'failed',
        reason: 'Falha no envio de WhatsApp de boas-vindas',
        errorMessage
      };
    }
  }

  async enviarLembreteTratamento(paraWhatsApp: string, nomePaciente: string, nomeTratamento: string, nomeProfissional: string): Promise<EnvioResultado> {
    if (!this.estaConfigurado()) {
      this.avisarNaoConfigurado();
      return {
        status: 'skipped',
        reason: 'Twilio nao configurado'
      };
    }

    try {
      const corpo = `Ola ${nomePaciente}! Lembrete do seu tratamento "${nomeTratamento}" com ${nomeProfissional}.`;
      const msg = await cliente.messages.create({
        from: ambiente.twilio.origemWhatsApp,
        to: paraWhatsApp,
        body: corpo
      });
      logger.info({ sid: msg.sid }, 'WhatsApp de lembrete de tratamento enviado');
      return {
        status: 'success',
        reason: 'WhatsApp de lembrete de tratamento enviado com sucesso',
        providerMessageId: msg.sid
      };
    } catch (erro: unknown) {
      const errorMessage = erro instanceof Error ? erro.message : 'Falha desconhecida ao enviar WhatsApp';
      logger.error({ erro, paraWhatsApp }, 'Falha ao enviar WhatsApp de lembrete de tratamento');
      return {
        status: 'failed',
        reason: 'Falha no envio de WhatsApp de lembrete de tratamento',
        errorMessage
      };
    }
  }
}
