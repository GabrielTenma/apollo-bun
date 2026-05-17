import { Injectable, Inject } from '@nestjs/common';
import {
  DataSource,
  Repository,
  EntityTarget,
  QueryDeepPartialEntity,
  DeepPartial,
} from 'typeorm';

/**
 * A thin wrapper around TypeORM's DataSource that provides convenient
 * generic CRUD operations for any entity. It is deliberately lightweight so
 * that new use‑cases can extend or compose it as needed without being forced
 * into a specific repository pattern.
 *
 * The service is exported from {@link SupabaseTypeOrmModule} and can be
 * injected into any other service or controller within the application.
 */
@Injectable()
export class SupabaseOrmService {
  constructor(@Inject('DATA_SOURCE') private readonly dataSource: DataSource) {}

  /**
   * Retrieve the TypeORM repository for a given entity.
   */
  getRepository<T>(entity: EntityTarget<T>): Repository<T> {
    return this.dataSource.getRepository(entity);
  }

  /** Generic find all */
  async findAll<T>(entity: EntityTarget<T>): Promise<T[]> {
    return this.getRepository(entity).find();
  }

  /** Generic find one by primary key */
  async findOne<T>(
    entity: EntityTarget<T>,
    id: number | string,
  ): Promise<T | null> {
    // TypeORM's findOneBy expects a where object. We assume the primary column is named "id".
    return this.getRepository(entity).findOneBy({ id } as any);
  }

  /** Generic create */
  async create<T>(entity: EntityTarget<T>, data: DeepPartial<T>): Promise<T> {
    const repo = this.getRepository(entity);
    const instance = repo.create(data as DeepPartial<T>) as T;
    return repo.save(instance);
  }

  /** Generic update */
  async update<T>(
    entity: EntityTarget<T>,
    id: number | string,
    data: QueryDeepPartialEntity<T>,
  ): Promise<T> {
    const repo = this.getRepository(entity);
    await repo.update(id as any, data);
    // Return the updated entity
    return (await repo.findOneBy({ id } as any)) as T;
  }

  /** Generic delete */
  async delete<T>(entity: EntityTarget<T>, id: number | string): Promise<void> {
    await this.getRepository(entity).delete(id as any);
  }
}
