import {
  IsString, IsOptional, IsNumber, IsEnum, IsUUID,
  Min, MaxLength, IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TransactionType {
  IN = 'in',
  OUT = 'out',
  ADJUSTMENT = 'adjustment',
  WASTAGE = 'wastage',
}

export class CreateInventoryItemDto {
  @ApiProperty() @IsString() @MaxLength(150) name: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(50) sku?: string;
  @ApiProperty() @IsString() @MaxLength(20) unit: string; // kg, litre, piece, etc.
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) currentStock?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) reorderLevel?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) costPrice?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) category?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
}

export class UpdateInventoryItemDto {
  @ApiPropertyOptional() @IsString() @MaxLength(150) @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(50) sku?: string;
  @ApiPropertyOptional() @IsString() @MaxLength(20) @IsOptional() unit?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) reorderLevel?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) costPrice?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) category?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
}

export class InventoryTransactionDto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiProperty({ enum: TransactionType }) @IsEnum(TransactionType) type: TransactionType;
  @ApiProperty() @IsNumber() @Min(0.001) quantity: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) unitCost?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(300) notes?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() referenceId?: string; // order ID if auto-deducted
}
