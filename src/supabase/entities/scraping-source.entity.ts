import {
	Column,
	Entity,
	Index,
	OneToMany,
	PrimaryGeneratedColumn,
} from "typeorm";
import { ScrapedDataEntity } from "./scraped-data.entity.ts";

@Entity({ name: "scraping_sources" })
@Index("idx_scraping_source_type", ["source_type"])
@Index("idx_scraping_source_active", ["is_active"])
export class ScrapingSourceEntity {
	@PrimaryGeneratedColumn("uuid")
	id: string;

	@Column({ type: "varchar", length: 255 })
	name: string;

	@Column({ type: "varchar", length: 50 })
	source_type: string;

	@Column({ type: "json" })
	connection_config: any;

	@Column({ type: "varchar", length: 100, nullable: true })
	schedule_cron?: string;

	@Column({ type: "boolean", default: true })
	is_active: boolean;

	@Column({ type: "varchar", nullable: true })
	created_at: string | Date;

	@OneToMany(
		() => ScrapedDataEntity,
		(data) => data.source,
	)
	scrapedData: ScrapedDataEntity[];
}
