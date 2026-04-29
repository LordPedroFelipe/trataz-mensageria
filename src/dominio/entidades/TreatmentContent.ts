import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('TreatmentContent')
export class TreatmentContent {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ name: 'treatmentId', type: 'int' })
  treatmentId!: number;

  @Column({ name: 'contentId', type: 'int' })
  contentId!: number;

  @Column({ type: 'varchar', length: 32 })
  status!: string;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
