import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Conteudo } from './Conteudo';
import { Paciente } from './Paciente';
import { Tratamento } from './Tratamento';

@Entity('Reminder')
export class Reminder {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @ManyToOne(() => Tratamento, { eager: true })
  @JoinColumn({ name: 'treatmentId' })
  tratamento!: Tratamento;

  @ManyToOne(() => Paciente, { eager: true })
  @JoinColumn({ name: 'patientId' })
  paciente!: Paciente;

  @ManyToOne(() => Conteudo, { eager: true, nullable: true })
  @JoinColumn({ name: 'contentId' })
  conteudo!: Conteudo | null;

  @Column({ name: 'type', type: 'varchar', length: 32 })
  tipo!: string;

  @Column({ name: 'times', type: 'json' })
  horarios!: unknown;

  @Column({ name: 'daysOfWeek', type: 'json', nullable: true })
  diasSemana!: unknown;

  @Column({ name: 'isActive', type: 'boolean', default: true })
  ativo!: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  atualizadoEm!: Date;
}
