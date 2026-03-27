import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('Clinic')
export class Clinica {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ name: 'name', type: 'varchar', length: 191 })
  nome!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email!: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 191, nullable: true })
  telefone!: string | null;

  @Column({ name: 'tempPassword', type: 'varchar', length: 191, nullable: true })
  senhaTemporaria!: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  atualizadoEm!: Date;
}
