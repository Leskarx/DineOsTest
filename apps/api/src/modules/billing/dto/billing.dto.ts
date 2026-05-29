import {
  IsUUID, IsOptional, IsString, IsNumber, IsEnum,
  IsArray, ValidateNested, Min, MaxLength, IsIn, IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GstType } from '../entities/bill.entity';
import { PaymentMethod } from '../entities/payment.entity';

export class PaymentSplitDto {
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) method: PaymentMethod;
  @ApiProperty() @IsNumber() @Min(0.01) amount: number;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) referenceNo?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(4) cardLast4?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(50) upiId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(50) walletName?: string;
}

export class CreateBillDto {
  @ApiProperty() @IsUUID() orderId: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() shiftId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) customerName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(20) customerPhone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(15) customerGstin?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) customerAddress?: string;
  @ApiPropertyOptional({ enum: GstType }) @IsEnum(GstType) @IsOptional() supplyType?: GstType;
  @ApiProperty({ type: [PaymentSplitDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => PaymentSplitDto) payments: PaymentSplitDto[];
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) notes?: string;
  // Offline sync flag — tells backend to auto-adjust payment to server grandTotal
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isOfflineSync?: boolean;
  // Injected server-side (whitelisted so ValidationPipe doesn't reject them)
  @ApiPropertyOptional() @IsString() @IsOptional() branchId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() tenantId?: string;
}

export class VoidBillDto {
  @ApiProperty() @IsString() @MaxLength(300) reason: string;
}

export class BillEmailDto {
  @ApiProperty() @IsString() email: string;
}
