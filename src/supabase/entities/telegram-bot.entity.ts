import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { TelegramChatEntity } from './telegram-chat.entity';
import { TelegramUpdateEntity } from './telegram-update.entity';

@Entity({ name: 'telegram_bots' })
export class TelegramBotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  bot_token_hash: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  bot_username?: string;

  @Column({ type: 'uuid', default: () => 'gen_random_uuid()' })
  webhook_secret: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'jsonb', default: {} })
  config: any;

  @OneToMany(() => TelegramChatEntity, (chat) => chat.bot)
  chats: TelegramChatEntity[];

  @OneToMany(() => TelegramUpdateEntity, (update) => update.bot)
  updates: TelegramUpdateEntity[];
}
