export type EntityType = 'patient' | 'professional' | 'treatment' | 'clinic' | 'password_reset' | 'reminder' | 'reminder_response';
export type NotificationType =
  | 'welcome_patient'
  | 'welcome_professional'
  | 'treatment_reminder'
  | 'password_setup_link_patient'
  | 'password_setup_link_professional'
  | 'password_setup_link_clinic'
  | 'temp_password_patient'
  | 'temp_password_professional'
  | 'temp_password_clinic'
  | 'password_reset'
  | 'recurring_treatment_reminder'
  | 'reminder_response_ack'
  | 'reminder_response_invalid';
export type CanalNotificacao = 'email' | 'whatsapp';
export type StatusDispatch = 'success' | 'failed' | 'skipped';

export interface EnvioResultado {
  status: StatusDispatch;
  reason: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
}
