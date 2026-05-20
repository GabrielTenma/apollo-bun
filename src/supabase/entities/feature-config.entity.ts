import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity.ts';

@Entity({ name: 'feature_configs' })
export class FeatureConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  feature_key: string;

  @Column({ type: 'varchar', length: 20, default: 'string' })
  value_type: string;

  @Column({ type: 'text', nullable: true })
  value_string?: string;

  @Column({ type: 'bigint', nullable: true })
  value_integer?: number;

  @Column({ type: 'boolean', nullable: true })
  value_boolean?: boolean;

  @Column({ type: 'jsonb', nullable: true })
  value_json?: any;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50 })
  scope_type: string;

  @Column({ type: 'uuid', nullable: true })
  scope_id?: string;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'boolean', default: true })
  is_enabled: boolean;

  @Column({ type: 'uuid', nullable: true })
  updated_by?: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updated_at: Date;

  @ManyToOne(() => UserEntity, (user) => user.updatedConfigs)
  @JoinColumn({ name: 'updated_by' })
  updatedBy?: UserEntity;
}
