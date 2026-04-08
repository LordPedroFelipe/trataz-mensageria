import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;
const databaseUrlValida = databaseUrl ? new URL(databaseUrl) : null;

const portaBanco = databaseUrlValida?.port
  ? Number(databaseUrlValida.port)
  : Number(process.env.DB_PORT ?? 3306);
const corsOrigins = (process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? '')
  .split(',')
  .map((origem) => origem.trim())
  .filter(Boolean);

export const ambiente = {
  porta: Number(process.env.PORT ?? process.env.PORTA ?? 3000),
  nivelLog: process.env.NIVEL_LOG ?? 'info',
  frontendUrl: process.env.FRONTEND_URL ?? 'https://www.trataz.com.br',
  cors: {
    origins: corsOrigins
  },
  timezone: process.env.APP_TIMEZONE ?? 'America/Sao_Paulo',
  databaseUrl,
  sincronizarBanco: (process.env.DB_SYNC ?? 'false').toLowerCase() === 'true',
  db: {
    host: databaseUrlValida?.hostname ?? process.env.DB_HOST ?? 'localhost',
    port: portaBanco,
    usuario: databaseUrlValida?.username ? decodeURIComponent(databaseUrlValida.username) : process.env.DB_USUARIO ?? 'root',
    senha: databaseUrlValida?.password ? decodeURIComponent(databaseUrlValida.password) : process.env.DB_SENHA ?? '',
    nome: databaseUrlValida?.pathname ? databaseUrlValida.pathname.replace(/^\//, '') : process.env.DB_NOME ?? 'trataz'
  },
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    seguro: (process.env.SMTP_SEGURO ?? 'false').toLowerCase() === 'true',
    usuario: process.env.SMTP_USUARIO ?? '',
    senha: process.env.SMTP_SENHA ?? '',
    de: process.env.EMAIL_DE ?? 'no-reply@example.com'
  },
  twilio: {
    sid: process.env.TWILIO_SID ?? '',
    token: process.env.TWILIO_TOKEN ?? '',
    origemWhatsApp: process.env.TWILIO_WHATSAPP_ORIGEM ?? 'whatsapp:+554796772094',
    destinoInternoWhatsApp: process.env.TWILIO_WHATSAPP_DESTINO_INTERNO ?? '',
    templates: {
      boasVindas: process.env.TWILIO_TEMPLATE_BOAS_VINDAS ?? 'HXe85ea5a2198c839ce4dba28eddbc1a30',
      notificacaoInterna: process.env.TWILIO_TEMPLATE_NOTIFICACAO_INTERNA ?? 'HXccce1658c6598b76325ec7d990115452',
      tratamentoNovo: process.env.TWILIO_TEMPLATE_TRATAMENTO_NOVO ?? 'HX915b8fea222af037ab408fff177d65e5',
      lembreteTratamento: process.env.TWILIO_TEMPLATE_LEMBRETE_TRATAMENTO ?? 'HX0ef4ee34246eca8200dada1b987bd79b'
    }
  },
  worker: {
    ativo: (process.env.WORKER_ATIVO ?? 'true').toLowerCase() === 'true',
    intervaloMs: Number(process.env.WORKER_INTERVALO_MS ?? 60000)
  }
} as const;
