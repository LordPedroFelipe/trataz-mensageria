import { CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, Column } from 'typeorm';

@Entity('ChatConversation')
export class ChatConversation {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ name: 'patientId', type: 'int' })
  patientId!: number;

  @Column({ name: 'professionalId', type: 'int', nullable: true })
  professionalId!: number | null;

  @Column({ name: 'clinicId', type: 'int', nullable: true })
  clinicId!: number | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
