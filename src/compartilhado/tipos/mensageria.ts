export type EntityType = 'patient' | 'professional' | 'treatment' | 'clinic' | 'password_reset' | 'reminder';
export type NotificationType =
  | 'welcome_patient'
  | 'welcome_professional'
  | 'treatment_reminder'
  | 'temp_password_patient'
  | 'temp_password_professional'
  | 'temp_password_clinic'
  | 'password_reset'
  | 'recurring_treatment_reminder';
export type CanalNotificacao = 'email' | 'whatsapp';
export type StatusDispatch = 'success' | 'failed' | 'skipped';

export interface EnvioResultado {
  status: StatusDispatch;
  reason: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
}
