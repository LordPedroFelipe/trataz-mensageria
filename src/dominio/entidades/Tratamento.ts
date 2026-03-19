
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Paciente } from './Paciente';
import { Profissional } from './Profissional';

@Entity('Treatment')
export class Tratamento {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @ManyToOne(() => Paciente, { eager: true })
  @JoinColumn({ name: 'patientId' })
  paciente!: Paciente;

  @ManyToOne(() => Profissional, { eager: true })
  @JoinColumn({ name: 'professionalId' })
  profissional!: Profissional;

  @Column({ name: 'name', type: 'varchar', length: 191 })
  nome!: string;

  @CreateDateColumn({ name: 'createdAt' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  atualizadoEm!: Date;
}
