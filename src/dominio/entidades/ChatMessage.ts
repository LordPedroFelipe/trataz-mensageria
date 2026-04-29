import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ChatMessage')
export class ChatMessage {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ name: 'conversationId', type: 'int' })
  conversationId!: number;

  @Column({ name: 'senderId', type: 'int' })
  senderId!: number;

  @Column({ name: 'senderType', type: 'varchar', length: 32 })
  senderType!: string;

  @Column({ name: 'content', type: 'text' })
  content!: string;

  @Column({ name: 'read', type: 'boolean', default: false })
  read!: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
