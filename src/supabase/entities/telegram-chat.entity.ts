import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { TelegramBotEntity } from './telegram-bot.entity.ts';
import { UserEntity } from './user.entity.ts';

@Entity({ name: 'telegram_chats' })
@Unique(['bot_id', 'telegram_chat_id'])
export class TelegramChatEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  bot_id: string;

  @Column({ type: 'bigint' })
  telegram_chat_id: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  chat_type?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  first_name?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  last_name?: string;

  @Column({ type: 'uuid', nullable: true })
  linked_user_id?: string;

  @Column({ type: 'jsonb', default: {} })
  settings: any;

  @ManyToOne(() => TelegramBotEntity, (bot) => bot.chats)
  @JoinColumn({ name: 'bot_id' })
  bot: TelegramBotEntity;

  @ManyToOne(() => UserEntity, (user) => user.telegramChats)
  @JoinColumn({ name: 'linked_user_id' })
  linkedUser?: UserEntity;
}
