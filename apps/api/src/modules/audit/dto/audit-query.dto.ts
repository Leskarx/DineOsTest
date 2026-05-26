import { IsOptional, IsUUID, IsInt, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AuditQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 100;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Must be a valid UUID v4' })
  @IsOptional()
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  userId?: string;

  @ApiPropertyOptional({ description: 'ISO date string YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date string YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  to?: string;
}