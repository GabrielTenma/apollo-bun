import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import {
  CreateRecordDto,
  UpdateRecordDto,
} from './interfaces/supabase.interface';

/**
 * Controller for Supabase operations.
 * Provides basic CRUD endpoints and a health check.
 */
@Controller('/api/v1/supabase')
export class SupabaseController {
  private readonly logger = new Logger(SupabaseController.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  @Get('health')
  healthCheck(): any {
    return { status: 'ok', service: 'supabase' };
  }

  @Post('create')
  async create(@Body() dto: CreateRecordDto): Promise<any> {
    this.logger.log(`Create record in ${dto.table}`);
    return this.supabaseService.create(dto.table, dto.data);
  }

  @Get('read/:table')
  async read(
    @Param('table') table: string,
    @Body() dto: { filter?: any } = {},
  ): Promise<any> {
    this.logger.log(`Read records from ${table}`);
    return this.supabaseService.read(table, dto.filter);
  }

  @Put('update')
  async update(@Body() dto: UpdateRecordDto): Promise<any> {
    this.logger.log(`Update record in ${dto.table}`);
    return this.supabaseService.update(dto.table, dto.id, dto.data);
  }

  @Delete('delete')
  async delete(
    @Body() dto: { table: string; id: string | number },
  ): Promise<any> {
    this.logger.log(`Delete record from ${dto.table}`);
    return this.supabaseService.delete(dto.table, dto.id);
  }
}
