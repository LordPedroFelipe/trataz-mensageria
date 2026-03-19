
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('Patient')
export class Paciente {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email!: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 191, nullable: true })
  telefone!: string | null;

  @Column({ name: 'firstName', type: 'varchar', length: 191 })
  primeiroNome!: string;

  @Column({ name: 'lastName', type: 'varchar', length: 191, nullable: true })
  sobrenome!: string | null;

  @Column({ name: 'tempPassword', type: 'varchar', length: 191, nullable: true })
  senhaTemporaria!: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  atualizadoEm!: Date;
}
