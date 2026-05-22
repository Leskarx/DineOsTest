import { IsNumber, IsOptional, IsString, IsObject, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DenominationDto {
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) note2000?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) note500?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) note200?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) note100?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) note50?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) note20?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) note10?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) coin5?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) coin2?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) coin1?: number;
}

export class OpenShiftDto {
  @ApiProperty() @IsNumber() @Min(0) openingCash: number;
  @ApiPropertyOptional() @IsObject() @IsOptional() denominations?: DenominationDto;
}

export class CloseShiftDto {
  @ApiProperty() @IsNumber() @Min(0) closingCash: number;
  @ApiPropertyOptional() @IsObject() @IsOptional() denominations?: DenominationDto;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(1000) notes?: string;
}
