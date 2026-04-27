import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('password_resets')
export class PasswordReset {
  @PrimaryColumn({ type: 'varchar', length: 191 })
  id!: string;

  @Column({ type: 'varchar', length: 191 })
  email!: string;

  @Column({ type: 'varchar', length: 191, nullable: true })
  code!: string | null;

  @Column({ type: 'varchar', length: 191, nullable: true })
  token!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  purpose!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  accountType!: string | null;

  @Column({ type: 'int', nullable: true })
  entityId!: number | null;

  @Column({ name: 'expiresAt', type: 'datetime' })
  expiraEm!: Date;

  @Column({ type: 'boolean', default: false })
  used!: boolean;

  @Column({ name: 'usedAt', type: 'datetime', nullable: true })
  usadoEm!: Date | null;

  @CreateDateColumn({ name: 'createdAt' })
  criadoEm!: Date;
}
