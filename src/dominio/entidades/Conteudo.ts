import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('Content')
export class Conteudo {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ name: 'title', type: 'varchar', length: 191 })
  titulo!: string;
}
