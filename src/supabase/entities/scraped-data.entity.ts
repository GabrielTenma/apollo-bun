import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	Unique,
} from "typeorm";
import { ScrapingSourceEntity } from "./scraping-source.entity.ts";

@Entity({ name: "scraped_data" })
@Unique(["source", "data_hash"])
@Index("idx_scraped_captured", ["captured_at"])
@Index("idx_scraped_status", ["status"])
export class ScrapedDataEntity {
	@PrimaryGeneratedColumn("uuid")
	id?: string;

	@Column({ type: "varchar", length: 36 })
	source_id: string;

	@Column({ type: "varchar", nullable: true })
	captured_at?: string | Date;

	@Column({ type: "text", nullable: true })
	raw_content?: string;

	@Column({ type: "json", nullable: true })
	parsed_data?: object;

	@Column({ type: "varchar", length: 64, nullable: true })
	data_hash?: string;

	@Column({ type: "varchar", length: 20, default: "new" })
	status?: string;

	@Column({ type: "text", nullable: true })
	processing_log?: string;

	@ManyToOne(
		() => ScrapingSourceEntity,
		(source) => source.scrapedData,
	)
	@JoinColumn({ name: "source_id" })
	source?: ScrapingSourceEntity;
}
