import twilio from 'twilio';
import { ambiente } from '../config/ambiente';
import { logger } from '../config/logger';
import { EnvioResultado } from '../compartilhado/tipos/mensageria';

const cliente = twilio(ambiente.twilio.sid, ambiente.twilio.token);

interface EnviarBoasVindasWhatsAppInput {
  paraWhatsApp: string;
  email: string;
  primeiroNome: string;
  sobrenome?: string | null;
  senhaTemporaria?: string | null;
  tipoUsuario: string;
}

interface EnviarTemplateInput {
  paraWhatsApp: string;
  contentSid: string;
  contentVariables?: Record<string, string>;
  motivoLog: string;
}

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

  normalizarDestinoWhatsApp(telefone: string): string {
    const semPrefixo = telefone.replace(/^whatsapp:/i, '').trim();
    const apenasDigitos = semPrefixo.replace(/\D/g, '');

    if (!apenasDigitos) {
      return 'whatsapp:';
    }

    if (semPrefixo.startsWith('+')) {
      return `whatsapp:+${apenasDigitos}`;
    }

    if (apenasDigitos.startsWith('55')) {
      return `whatsapp:+${apenasDigitos}`;
    }

    return `whatsapp:+55${apenasDigitos}`;
  }

  private async enviarTemplate(input: EnviarTemplateInput): Promise<{ sid: string; destination: string }> {
    const destinoNormalizado = this.normalizarDestinoWhatsApp(input.paraWhatsApp);
    const message = await cliente.messages.create({
      from: ambiente.twilio.origemWhatsApp,
      to: destinoNormalizado,
      body: '',
      contentSid: input.contentSid,
      contentVariables: input.contentVariables ? JSON.stringify(input.contentVariables) : undefined
    });

    logger.info({
      sid: message.sid,
      destinoNormalizado,
      contentSid: input.contentSid
    }, input.motivoLog);

    return {
      sid: message.sid,
      destination: destinoNormalizado
    };
  }

  async enviarBoasVindasWhatsApp(input: EnviarBoasVindasWhatsAppInput): Promise<EnvioResultado> {
    if (!this.estaConfigurado()) {
      this.avisarNaoConfigurado();
      return {
        status: 'skipped',
        reason: 'Twilio nao configurado'
      };
    }

    try {
      const sids: string[] = [];

      const boasVindas = await this.enviarTemplate({
        paraWhatsApp: input.paraWhatsApp,
        contentSid: ambiente.twilio.templates.boasVindas,
        contentVariables: { nome: input.primeiroNome },
        motivoLog: 'Template de boas-vindas enviado por WhatsApp'
      });
      sids.push(boasVindas.sid);

      if (input.senhaTemporaria) {
        const credenciais = await this.enviarTemplate({
          paraWhatsApp: input.paraWhatsApp,
          contentSid: ambiente.twilio.templates.credenciais,
          contentVariables: {
            mensagem: `Email: ${input.email} | Senha: ${input.senhaTemporaria}`
          },
          motivoLog: 'Template de credenciais enviado por WhatsApp'
        });
        sids.push(credenciais.sid);
      }

      if (ambiente.twilio.destinoInternoWhatsApp) {
        const notificacaoInterna = await this.enviarTemplate({
          paraWhatsApp: ambiente.twilio.destinoInternoWhatsApp,
          contentSid: ambiente.twilio.templates.notificacaoInterna,
          contentVariables: {
            nome: [input.primeiroNome, input.sobrenome].filter(Boolean).join(' ').trim() || input.primeiroNome,
            usuario: input.tipoUsuario,
            email: input.email,
            telefone: input.paraWhatsApp
          },
          motivoLog: 'Template interno de novo usuario enviado por WhatsApp'
        });
        sids.push(notificacaoInterna.sid);
      }

      return {
        status: 'success',
        reason: 'WhatsApp de boas-vindas enviado com sucesso por template',
        providerMessageId: sids.join(',')
      };
    } catch (erro: unknown) {
      const errorMessage = erro instanceof Error ? erro.message : 'Falha desconhecida ao enviar WhatsApp';
      logger.error({ erro, destino: input.paraWhatsApp }, 'Falha ao enviar WhatsApp de boas-vindas');
      return {
        status: 'failed',
        reason: 'Falha no envio de WhatsApp de boas-vindas',
        errorMessage
      };
    }
  }

  async enviarTratamentoNovo(paraWhatsApp: string, nomePaciente: string, nomeProfissional: string): Promise<EnvioResultado> {
    if (!this.estaConfigurado()) {
      this.avisarNaoConfigurado();
      return {
        status: 'skipped',
        reason: 'Twilio nao configurado'
      };
    }

    try {
      const resultado = await this.enviarTemplate({
        paraWhatsApp,
        contentSid: ambiente.twilio.templates.tratamentoNovo,
        contentVariables: {
          nome: nomePaciente,
          professional: nomeProfissional
        },
        motivoLog: 'Template de novo tratamento enviado por WhatsApp'
      });

      return {
        status: 'success',
        reason: 'WhatsApp de novo tratamento enviado com sucesso',
        providerMessageId: resultado.sid
      };
    } catch (erro: unknown) {
      const errorMessage = erro instanceof Error ? erro.message : 'Falha desconhecida ao enviar WhatsApp';
      logger.error({ erro, paraWhatsApp }, 'Falha ao enviar WhatsApp de novo tratamento');
      return {
        status: 'failed',
        reason: 'Falha no envio de WhatsApp de novo tratamento',
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
      const resultado = await this.enviarTemplate({
        paraWhatsApp,
        contentSid: ambiente.twilio.templates.lembreteTratamento,
        contentVariables: {
          nome: nomePaciente,
          professional: nomeProfissional,
          modulo: nomeTratamento
        },
        motivoLog: 'Template de lembrete de tratamento enviado por WhatsApp'
      });

      return {
        status: 'success',
        reason: 'WhatsApp de lembrete de tratamento enviado com sucesso',
        providerMessageId: resultado.sid
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
