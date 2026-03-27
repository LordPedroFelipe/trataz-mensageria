import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;
const databaseUrlValida = databaseUrl ? new URL(databaseUrl) : null;

const portaBanco = databaseUrlValida?.port
  ? Number(databaseUrlValida.port)
  : Number(process.env.DB_PORT ?? 3306);

export const ambiente = {
  porta: Number(process.env.PORT ?? process.env.PORTA ?? 3000),
  nivelLog: process.env.NIVEL_LOG ?? 'info',
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
    origemWhatsApp: process.env.TWILIO_WHATSAPP_ORIGEM ?? 'whatsapp:+14155238886'
  },
  worker: {
    ativo: (process.env.WORKER_ATIVO ?? 'true').toLowerCase() === 'true',
    intervaloMs: Number(process.env.WORKER_INTERVALO_MS ?? 60000)
  }
} as const;
