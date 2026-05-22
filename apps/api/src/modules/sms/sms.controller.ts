import { Controller, Post, Body, HttpCode, HttpStatus, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SmsService } from './sms.service';
import { IS_PUBLIC_KEY } from '../auth/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

class SendOtpDto {
  @ApiProperty({ example: '9876543210' })
  @IsString() @Matches(/^\d{10}$/, { message: 'Phone must be a 10-digit Indian mobile number' })
  phone: string;
}

class VerifyOtpDto {
  @ApiProperty() @IsString() @Matches(/^\d{10}$/) phone: string;
  @ApiProperty() @IsString() @Length(6, 6) otp: string;
}

@ApiTags('sms')
@Controller({ path: 'sms', version: '1' })
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Public()
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP to a mobile number' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.smsService.sendOtp(dto.phone);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an OTP' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.smsService.verifyOtp(dto.phone, dto.otp);
  }
}
