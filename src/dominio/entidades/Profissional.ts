
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('Professional')
export class Profissional {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email!: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 191, nullable: true })
  telefone!: string | null;

  @Column({ name: 'fullName', type: 'varchar', length: 191 })
  nomeCompleto!: string;

  @Column({ name: 'tempPassword', type: 'varchar', length: 191, nullable: true })
  senhaTemporaria!: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  atualizadoEm!: Date;
}
