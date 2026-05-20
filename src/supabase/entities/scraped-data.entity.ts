import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { ScrapingSourceEntity } from './scraping-source.entity.ts';

@Entity({ name: 'scraped_data' })
@Unique(['source_id', 'data_hash'])
@Index('idx_scraped_captured', ['captured_at'])
@Index('idx_scraped_status', ['status'])
export class ScrapedDataEntity {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column({ type: 'uuid' })
  source_id: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  captured_at?: Date;

  @Column({ type: 'text', nullable: true })
  raw_content?: string;

  @Column({ type: 'jsonb', nullable: true })
  parsed_data?: object;

  @Column({ type: 'varchar', length: 64, nullable: true })
  data_hash?: string;

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status?: string;

  @Column({ type: 'text', nullable: true })
  processing_log?: string;

  @ManyToOne(() => ScrapingSourceEntity, (source) => source.scrapedData)
  @JoinColumn({ name: 'source_id' })
  source?: ScrapingSourceEntity;
}
