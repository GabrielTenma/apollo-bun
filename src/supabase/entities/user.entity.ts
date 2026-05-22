import {
	Column,
	Entity,
	Index,
	OneToMany,
	PrimaryGeneratedColumn,
} from "typeorm";
import { FeatureConfigEntity } from "./feature-config.entity.ts";
import { TelegramChatEntity } from "./telegram-chat.entity.ts";
import { UserAuthProviderEntity } from "./user-auth-provider.entity.ts";
import { UserSessionEntity } from "./user-session.entity.ts";

@Entity({ name: "users" })
@Index("idx_users_email_active", ["email", "is_active"])
export class UserEntity {
	@PrimaryGeneratedColumn("uuid")
	id: string;

	@Column({ type: "varchar", length: 255, unique: true })
	email: string;

	@Column({ type: "varchar", length: 255, nullable: true })
	password_hash?: string;

	@Column({ type: "varchar", length: 255, nullable: true })
	full_name?: string;

	@Column({ type: "boolean", default: true })
	is_active: boolean;

	@Column({ type: "json" })
	roles: string[];

	@Column({ type: "varchar", nullable: true })
	created_at: string | Date;

	@Column({ type: "varchar", nullable: true })
	updated_at: string | Date;

	@OneToMany(
		() => UserAuthProviderEntity,
		(provider) => provider.user,
	)
	authProviders: UserAuthProviderEntity[];

	@OneToMany(
		() => UserSessionEntity,
		(session) => session.user,
	)
	sessions: UserSessionEntity[];

	@OneToMany(
		() => TelegramChatEntity,
		(chat) => chat.linkedUser,
	)
	telegramChats: TelegramChatEntity[];

	@OneToMany(
		() => FeatureConfigEntity,
		(config) => config.updatedBy,
	)
	updatedConfigs: FeatureConfigEntity[];
}
