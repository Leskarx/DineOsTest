import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, DefaultValuePipe, ParseIntPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/tenant.decorator';
import { HotelService } from './hotel.service';
import { RoomStatus } from './entities/room.entity';
import { ReservationStatus, BookingSource } from './entities/reservation.entity';
import { ChargeType } from './entities/folio-charge.entity';
import { HkStatus, HkTaskType, HkPriority } from './entities/housekeeping-task.entity';
import { PaymentMethod } from '../billing/entities/payment.entity';

@ApiTags('hotel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'hotel', version: '1' })
export class HotelController {
  constructor(private readonly svc: HotelService) { }

  // ── Dashboard ──────────────────────────────────────────────────────────────

  @Get('dashboard')
  @Roles('owner', 'manager', 'cashier')
  @ApiOperation({ summary: 'Hotel overview — occupancy, arrivals, departures' })
  getDashboard(
    @TenantId() tenantId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.svc.getDashboard(tenantId, branchId);
  }

  // ── Room Types ─────────────────────────────────────────────────────────────

  @Get('room-types')
  @Roles('owner', 'manager', 'cashier', 'waiter')
  listRoomTypes(@TenantId() tid: string, @Query('branchId') branchId?: string) {
    return this.svc.listRoomTypes(tid, branchId);
  }

  @Post('room-types')
  @Roles('owner', 'manager')
  createRoomType(@TenantId() tid: string, @Body() body: any) {
    return this.svc.createRoomType(tid, body);
  }

  @Patch('room-types/:id')
  @Roles('owner', 'manager')
  updateRoomType(@Param('id') id: string, @TenantId() tid: string, @Body() body: any) {
    return this.svc.updateRoomType(id, tid, body);
  }

  @Delete('room-types/:id')
  @Roles('owner', 'manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRoomType(@Param('id') id: string, @TenantId() tid: string) {
    return this.svc.deleteRoomType(id, tid);
  }

  // ── Rooms ──────────────────────────────────────────────────────────────────

  @Get('rooms')
  @Roles('owner', 'manager', 'cashier', 'waiter', 'housekeeping')
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'status', required: false })
  listRooms(
    @TenantId() tid: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: RoomStatus,
  ) {
    return this.svc.listRooms(tid, branchId, status);
  }

  @Post('rooms')
  createRoom(
    @TenantId() tid: string,
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    return this.svc.createRoom(
      tid,
      user?.branchId,
      body,
    );
  }

  @Patch('rooms/:id')
  @Roles('owner', 'manager')
  updateRoom(@Param('id') id: string, @TenantId() tid: string, @Body() body: any) {
    return this.svc.updateRoom(id, tid, body);
  }

  @Patch('rooms/:id/status')
  @Roles('owner', 'manager', 'cashier', 'housekeeping')
  updateRoomStatus(
    @Param('id') id: string,
    @TenantId() tid: string,
    @Body('status') status: RoomStatus,
  ) {
    return this.svc.updateRoomStatus(id, tid, status);
  }

  // ── Guests ─────────────────────────────────────────────────────────────────

  @Get('guests')
  @Roles('owner', 'manager', 'cashier')
  @ApiQuery({ name: 'q', required: false })
  searchGuests(@TenantId() tid: string, @Query('q') q?: string) {
    return this.svc.searchGuests(tid, q ?? '');
  }

  @Get('guests/:id')
  @Roles('owner', 'manager', 'cashier')
  getGuest(@Param('id') id: string, @TenantId() tid: string) {
    return this.svc.getGuest(id, tid);
  }

  @Post('guests')
  @Roles('owner', 'manager', 'cashier')
  createGuest(@TenantId() tid: string, @Body() body: any) {
    return this.svc.createGuest(tid, body);
  }

  @Patch('guests/:id')
  @Roles('owner', 'manager', 'cashier')
  updateGuest(@Param('id') id: string, @TenantId() tid: string, @Body() body: any) {
    return this.svc.updateGuest(id, tid, body);
  }

  // ── Reservations ───────────────────────────────────────────────────────────

  @Get('reservations')
  @Roles('owner', 'manager', 'cashier')
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listReservations(
    @TenantId() tid: string,
    @Query('status') status?: ReservationStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('branchId') branchId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    return this.svc.listReservations(tid, { status, from, to, search, branchId, page, limit });
  }

  @Get('reservations/:id')
  @Roles('owner', 'manager', 'cashier')
  getReservation(@Param('id') id: string, @TenantId() tid: string) {
    return this.svc.getReservation(id, tid);
  }

  @Post('reservations')
  createReservation(
    @TenantId() tid: string,
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    return this.svc.createReservation(
      tid,
      user?.branchId,
      body,
    );
  }

  @Post('reservations/:id/check-in')
  @Roles('owner', 'manager', 'cashier')
  checkIn(@Param('id') id: string, @TenantId() tid: string) {
    return this.svc.checkIn(id, tid);
  }

  @Post('reservations/:id/check-out')
  @Roles('owner', 'manager', 'cashier')
  checkOut(@Param('id') id: string, @TenantId() tid: string) {
    return this.svc.checkOut(id, tid);
  }

  @Post('reservations/:id/cancel')
  @Roles('owner', 'manager', 'cashier')
  cancel(
    @Param('id') id: string,
    @TenantId() tid: string,
    @Body('reason') reason: string,
  ) {
    return this.svc.cancelReservation(id, tid, reason ?? 'Cancelled by staff');
  }

  // ── Folio ──────────────────────────────────────────────────────────────────

  @Get('reservations/:id/folio')
  @Roles('owner', 'manager', 'cashier')
  getFolio(@Param('id') id: string, @TenantId() tid: string) {
    return this.svc.getFolio(id, tid);
  }

  @Post('reservations/:id/folio/charges')
  @Roles('owner', 'manager', 'cashier')
  addCharge(@Param('id') id: string, @TenantId() tid: string, @Body() body: any) {
    return this.svc.addFolioCharge(id, tid, body);
  }

  // ── Billing ────────────────────────────────────────────────────────────────

  @Post('reservations/:id/bill')
  @Roles('owner', 'manager', 'cashier')
  generateBill(
    @Param('id') id: string,
    @TenantId() tid: string,
    @Body('paymentMethod') paymentMethod?: PaymentMethod,
    @Body('amountPaid') amountPaid?: number,
  ) {
    return this.svc.generateBill(id, tid, paymentMethod, amountPaid);
  }

  // ── Housekeeping ───────────────────────────────────────────────────────────

  @Get('housekeeping')
  @Roles('owner', 'manager', 'cashier', 'housekeeping')
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'date', required: false })
  listTasks(
    @TenantId() tid: string,
    @Query('branchId') branchId?: string,
    @Query('date') date?: string,
  ) {
    return this.svc.listHousekeepingTasks(tid, branchId, date);
  }

  @Post('housekeeping')
  @Roles('owner', 'manager')
  createTask(
    @TenantId() tid: string,
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    return this.svc.createHousekeepingTask(
      tid,
      user?.branchId,
      body,
    );
  }

  @Patch('housekeeping/:id')
  @Roles('owner', 'manager', 'cashier', 'housekeeping')
  updateTask(
    @Param('id') id: string,
    @TenantId() tid: string,
    @Body('status') status: HkStatus,
    @Body('notes') notes?: string,
  ) {
    return this.svc.updateHousekeepingTask(id, tid, status, notes);
  }
}
