import { DataSource } from 'typeorm';

export class SupabaseOrmService {
  constructor(private dataSource: DataSource) {}

  getRepository<T>(entity: any) {
    return this.dataSource.getRepository(entity);
  }

  async findAll<T>(entity: any): Promise<T[]> {
    return this.getRepository(entity).find() as unknown as T[];
  }

  async findOne<T>(entity: any, id: number | string): Promise<T | null> {
    return this.getRepository(entity).findOneBy({ id } as any) as unknown as T | null;
  }

  async create<T>(entity: any, data: any): Promise<T> {
    const repo = this.getRepository(entity);
    const instance = repo.create(data);
    return repo.save(instance) as unknown as T;
  }

  async update<T>(entity: any, id: number | string, data: any): Promise<T> {
    const repo = this.getRepository(entity);
    await repo.update(id as any, data);
    return (await repo.findOneBy({ id } as any)) as T;
  }

  async delete<T>(entity: any, id: number | string): Promise<void> {
    await this.getRepository(entity).delete(id as any);
  }
}
