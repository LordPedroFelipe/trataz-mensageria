export type EntityType = 'patient' | 'professional' | 'treatment';
export type NotificationType = 'welcome_patient' | 'welcome_professional' | 'treatment_reminder';
export type CanalNotificacao = 'email' | 'whatsapp';
export type StatusDispatch = 'success' | 'failed' | 'skipped';

export interface EnvioResultado {
  status: StatusDispatch;
  reason: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
}
