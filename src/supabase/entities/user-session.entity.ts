import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { UserEntity } from "./user.entity.ts";

@Entity({ name: "user_sessions" })
@Index("idx_session_token_hash", ["refresh_token_hash"])
@Index("idx_session_user", ["user_id"])
export class UserSessionEntity {
	@PrimaryGeneratedColumn("uuid")
	id: string;

	@Column({ type: "uuid" })
	user_id: string;

	@Column({ type: "varchar", length: 255 })
	refresh_token_hash: string;

	@Column({ type: "text", nullable: true })
	user_agent?: string;

	@Column({ type: "varchar", nullable: true })
	ip_address?: string;

	@Column({ type: "varchar", nullable: true })
	expires_at: string | Date;

	@Column({ type: "varchar", nullable: true })
	revoked_at?: string | Date;

	@Column({ type: "varchar", nullable: true })
	created_at: string | Date;

	@ManyToOne(
		() => UserEntity,
		(user) => user.sessions,
	)
	@JoinColumn({ name: "user_id" })
	user: UserEntity;
}
