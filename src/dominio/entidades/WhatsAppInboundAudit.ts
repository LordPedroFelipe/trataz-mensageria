import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('WhatsAppInboundAudit')
export class WhatsAppInboundAudit {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'varchar', length: 191, unique: true })
  providerMessageId!: string;

  @Column({ type: 'varchar', length: 191 })
  fromPhone!: string;

  @Column({ type: 'varchar', length: 191, nullable: true })
  toPhone!: string | null;

  @Column({ type: 'text' })
  rawBody!: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  parsedOption!: string | null;

  @Column({ type: 'varchar', length: 32 })
  status!: string;

  @Column({ type: 'int', nullable: true })
  reminderId!: number | null;

  @Column({ type: 'int', nullable: true })
  treatmentId!: number | null;

  @Column({ type: 'int', nullable: true })
  patientId!: number | null;

  @Column({ type: 'int', nullable: true })
  contentId!: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  responseAction!: string | null;

  @Column({ type: 'varchar', length: 191, nullable: true })
  matchedReminderEntityId!: string | null;

  @Column({ type: 'varchar', length: 191, nullable: true })
  replyMessageId!: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'datetime', precision: 3 })
  receivedAt!: Date;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  processedAt!: Date | null;

  @CreateDateColumn({ type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
