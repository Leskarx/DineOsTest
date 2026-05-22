import {
  IsString, IsOptional, IsNumber, IsBoolean, IsEnum,
  IsUUID, Min, Max, MaxLength, IsArray, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty() @IsString() @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(300) description?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() sortOrder?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() color?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() icon?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional() @IsString() @MaxLength(100) @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(300) description?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() sortOrder?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() color?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() icon?: string;
}

export class CreateMenuItemDto {
  @ApiProperty() @IsUUID() categoryId: string;
  @ApiProperty() @IsString() @MaxLength(150) name: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) description?: string;
  @ApiProperty() @IsNumber() @Min(0) price: number;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(20) hsnCode?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) @Max(28) gstRate?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isVeg?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isFeatured?: boolean;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) sortOrder?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() imageUrl?: string;
  @ApiPropertyOptional() @IsArray() @IsOptional() tags?: string[];
  @ApiPropertyOptional() @IsArray() @IsOptional() modifiers?: any[];
}

export class UpdateMenuItemDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() categoryId?: string;
  @ApiPropertyOptional() @IsString() @MaxLength(150) @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) description?: string;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() price?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(20) hsnCode?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) @Max(28) gstRate?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isVeg?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isFeatured?: boolean;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) sortOrder?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() imageUrl?: string;
  @ApiPropertyOptional() @IsArray() @IsOptional() tags?: string[];
  @ApiPropertyOptional() @IsArray() @IsOptional() modifiers?: any[];
}
