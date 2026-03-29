import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('password_resets')
export class PasswordReset {
  @PrimaryColumn({ type: 'varchar', length: 191 })
  id!: string;

  @Column({ type: 'varchar', length: 191 })
  email!: string;

  @Column({ type: 'varchar', length: 191 })
  code!: string;

  @Column({ name: 'expiresAt', type: 'datetime' })
  expiraEm!: Date;

  @Column({ type: 'boolean', default: false })
  used!: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  criadoEm!: Date;
}
