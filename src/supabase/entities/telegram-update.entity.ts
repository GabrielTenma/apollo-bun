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
@Unique(['bot', 'update_id'])
export class TelegramUpdateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  bot_id: string;

  @Column({ type: 'bigint' })
  update_id: number;

  @Column({ type: 'bigint', nullable: true })
  telegram_chat_id?: number;

  @Column({ type: 'varchar', nullable: true })
  message_date?: string | Date;

  @Column({ type: 'json' })
  raw_update: any;

  @Column({ type: 'varchar', nullable: true })
  processed_at?: string | Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  processed_by?: string;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ type: 'varchar', nullable: true })
  created_at: string | Date;

  @ManyToOne(() => TelegramBotEntity, (bot) => bot.updates)
  @JoinColumn({ name: 'bot_id' })
  bot: TelegramBotEntity;
}
