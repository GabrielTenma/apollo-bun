import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity.ts';

@Entity({ name: 'user_auth_providers' })
export class UserAuthProviderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @Column({ type: 'varchar', length: 255 })
  provider_user_id: string;

  @Column({ type: 'json', nullable: true })
  provider_data?: any;

  @Column({ type: 'varchar', nullable: true })
  created_at: string | Date;

  @ManyToOne(() => UserEntity, (user) => user.authProviders)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
