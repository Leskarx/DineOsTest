import {
  IsString, IsOptional, IsEmail, IsEnum, IsBoolean,
  IsUUID, MinLength, MaxLength, Matches, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(20) phone?: string;
  @ApiProperty() @IsString() @MinLength(8) password: string;
  @ApiProperty() @IsString() @MaxLength(50) firstName: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(50) lastName?: string;
  @ApiProperty({ enum: UserRole }) @IsEnum(UserRole) role: UserRole;
  @ApiPropertyOptional() @IsUUID() @IsOptional() branchId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(10) employeeCode?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @Matches(/^\d{4,6}$/, { message: 'PIN must be 4-6 digits' }) pin?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(20) phone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(50) firstName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(50) lastName?: string;
  @ApiPropertyOptional({ enum: UserRole }) @IsEnum(UserRole) @IsOptional() role?: UserRole;
  @ApiPropertyOptional() @IsUUID() @IsOptional() branchId?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(10) employeeCode?: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() currentPassword: string;
  @ApiProperty() @IsString() @MinLength(8) newPassword: string;
}

export class SetPinDto {
  @ApiProperty() @IsString() @Matches(/^\d{4,6}$/, { message: 'PIN must be 4-6 digits' }) pin: string;
}
