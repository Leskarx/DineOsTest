import { IsString, IsOptional, IsNumber, IsBoolean, IsUUID, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSectionDto {
  @ApiProperty() @IsString() @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() sortOrder?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
}

export class CreateTableDto {
  @ApiProperty() @IsString() @MaxLength(20) tableNumber: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() sectionId?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(1) capacity?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
  @ApiPropertyOptional() @IsNumber() @IsOptional() posX?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() posY?: number;
}

export class UpdateTableDto {
  @ApiPropertyOptional() @IsString() @MaxLength(20) @IsOptional() tableNumber?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() sectionId?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(1) capacity?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
  @ApiPropertyOptional() @IsNumber() @IsOptional() posX?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() posY?: number;
}
