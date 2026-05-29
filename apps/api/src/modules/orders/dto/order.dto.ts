import {
  IsUUID, IsOptional, IsString, IsNumber, IsEnum,
  IsArray, ValidateNested, Min, IsBoolean, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType } from '../entities/order.entity';

export class CreateOrderItemDto {
  @ApiProperty() @IsUUID() menuItemId: string;
  @ApiProperty() @IsNumber() @Min(1) quantity: number;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) notes?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() variationId?: string;
  @ApiPropertyOptional() @IsArray() @IsOptional() modifiers?: any[];
}

export class CreateOrderDto {
  @ApiProperty({ enum: OrderType }) @IsEnum(OrderType) @IsOptional() orderType?: OrderType;
  // Also accept 'type' as an alias (frontend sends 'type')
  @ApiPropertyOptional({ enum: OrderType }) @IsEnum(OrderType) @IsOptional() type?: OrderType;
  @ApiPropertyOptional() @IsUUID() @IsOptional() tableId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) customerName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(20) customerPhone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() customerGstin?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() shiftId?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) coverCount?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) covers?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(1000) notes?: string;
  @ApiPropertyOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateOrderItemDto) @IsOptional() items?: CreateOrderItemDto[];
  @ApiPropertyOptional() @IsUUID() @IsOptional() waiterId?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isComplimentary?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isSalesReturn?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() scheduledAt?: string;
  // Offline sync fields
  @ApiPropertyOptional() @IsString() @IsOptional() offlineId?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isOfflineSync?: boolean;
  // Injected server-side (not sent by client but merged in controller)
  @ApiPropertyOptional() @IsString() @IsOptional() branchId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() tenantId?: string;
}

export class AddOrderItemDto {
  @ApiProperty() @IsUUID() menuItemId: string;
  @ApiProperty() @IsNumber() @Min(1) quantity: number;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) notes?: string;
  @ApiPropertyOptional() @IsArray() @IsOptional() modifiers?: any[];
}

export class AddItemsBodyDto {
  @ApiProperty({ type: [AddOrderItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => AddOrderItemDto)
  items: AddOrderItemDto[];

  @ApiPropertyOptional() @IsBoolean() @IsOptional() isOfflineSync?: boolean;
}

export class UpdateOrderItemDto {
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() quantity?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isVoided?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) notes?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() voidReason?: string;
}

export class ApplyDiscountDto {
  @ApiProperty() @IsNumber() @Min(0) discountPercent: number;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) discountReason?: string;
}
