import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ScrapedDataEntity } from './scraped-data.entity';

@Entity({ name: 'scraping_sources' })
export class ScrapingSourceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  source_type: string;

  @Column({ type: 'jsonb' })
  connection_config: any;

  @Column({ type: 'varchar', length: 100, nullable: true })
  schedule_cron?: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @OneToMany(() => ScrapedDataEntity, (data) => data.source)
  scrapedData: ScrapedDataEntity[];
}
