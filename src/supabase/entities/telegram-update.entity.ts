import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { TelegramBotEntity } from './telegram-bot.entity.ts';

@Entity({ name: 'telegram_updates' })
@Unique(['bot_id', 'update_id'])
export class TelegramUpdateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  bot_id: string;

  @Column({ type: 'bigint' })
  update_id: number;

  @Column({ type: 'bigint', nullable: true })
  telegram_chat_id?: number;

  @Column({ type: 'timestamptz', nullable: true })
  message_date?: Date;

  @Column({ type: 'jsonb' })
  raw_update: any;

  @Column({ type: 'timestamptz', nullable: true })
  processed_at?: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  processed_by?: string;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @ManyToOne(() => TelegramBotEntity, (bot) => bot.updates)
  @JoinColumn({ name: 'bot_id' })
  bot: TelegramBotEntity;
}
