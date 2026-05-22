import { IsEmail, IsOptional, IsString, MinLength, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() pin?: string;
  @ApiProperty() @IsString() @MinLength(6) password: string;
  @Transform(({ value }) => value === '' ? undefined : value)
  @ApiPropertyOptional() @IsUUID() @IsOptional() tenantId?: string;
  @Transform(({ value }) => value === '' ? undefined : value)
  @ApiPropertyOptional() @IsUUID() @IsOptional() branchId?: string;
}

export class RefreshTokenDto {
  @ApiProperty() @IsString() refreshToken: string;
}

export class RegisterTenantDto {
  @ApiProperty() @IsString() businessName: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() phone: string;
  @ApiProperty() @IsString() @MinLength(8) password: string;
  @ApiPropertyOptional() @IsString() @IsOptional() planCode?: string;
}
