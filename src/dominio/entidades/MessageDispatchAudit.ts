import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CanalNotificacao, EntityType, NotificationType, StatusDispatch } from '../../compartilhado/tipos/mensageria';

@Entity('MessageDispatchAudit')
export class MessageDispatchAudit {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'varchar', length: 32 })
  entityType!: EntityType;

  @Column({ type: 'varchar', length: 64 })
  entityId!: string;

  @Column({ type: 'varchar', length: 64 })
  notificationType!: NotificationType;

  @Column({ type: 'varchar', length: 16 })
  channel!: CanalNotificacao;

  @Column({ type: 'varchar', length: 16 })
  status!: StatusDispatch;

  @Column({ type: 'varchar', length: 191, nullable: true })
  destination!: string | null;

  @Column({ type: 'varchar', length: 191 })
  reason!: string;

  @Column({ type: 'varchar', length: 191, nullable: true })
  providerMessageId!: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'datetime', precision: 3 })
  attemptedAt!: Date;

  @CreateDateColumn({ type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
