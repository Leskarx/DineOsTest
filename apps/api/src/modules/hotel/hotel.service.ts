import {
  Injectable, BadRequestException, NotFoundException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, Like, ILike } from 'typeorm';

import { RoomType }        from './entities/room-type.entity';
import { Room, RoomStatus } from './entities/room.entity';
import { Guest }            from './entities/guest.entity';
import {
  Reservation, ReservationStatus, BookingSource,
} from './entities/reservation.entity';
import { FolioCharge, ChargeType } from './entities/folio-charge.entity';
import {
  HousekeepingTask, HkTaskType, HkStatus, HkPriority,
} from './entities/housekeeping-task.entity';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateRoomTypeDto {
  branchId: string;
  name: string;
  description?: string;
  baseRate: number;
  maxOccupancy?: number;
  amenities?: string[];
}

export interface CreateRoomDto {
  branchId: string;
  roomTypeId: string;
  roomNumber: string;
  floor?: number;
  notes?: string;
}

export interface CreateGuestDto {
  name: string;
  phone: string;
  email?: string;
  idType?: string;
  idNumber?: string;
  nationality?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  dob?: string;
  gender?: string;
}

export interface CreateReservationDto {
  branchId: string;
  roomId: string;
  primaryGuestId?: string;
  guest?: CreateGuestDto;          // create guest inline if no primaryGuestId
  numAdults?: number;
  numChildren?: number;
  checkInDate: string;             // YYYY-MM-DD
  checkOutDate: string;            // YYYY-MM-DD
  ratePerNight?: number;           // if omitted, uses room type base rate
  advancePaid?: number;
  source?: BookingSource;
  bookingRef?: string;
  specialRequests?: string;
  notes?: string;
  createdById?: string;
}

export interface AddFolioChargeDto {
  description: string;
  amount: number;
  chargeType: ChargeType;
  referenceId?: string;
  date?: string;
}

export interface ListReservationsQuery {
  branchId?: string;
  status?: ReservationStatus;
  date?: string;        // filter by check-in date
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class HotelService {
  constructor(
    @InjectRepository(RoomType)          private readonly roomTypeRepo: Repository<RoomType>,
    @InjectRepository(Room)              private readonly roomRepo: Repository<Room>,
    @InjectRepository(Guest)             private readonly guestRepo: Repository<Guest>,
    @InjectRepository(Reservation)       private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(FolioCharge)       private readonly folioRepo: Repository<FolioCharge>,
    @InjectRepository(HousekeepingTask)  private readonly hkRepo: Repository<HousekeepingTask>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Room Types ──────────────────────────────────────────────────────────────

  async createRoomType(tenantId: string, dto: CreateRoomTypeDto): Promise<RoomType> {
    const rt = this.roomTypeRepo.create({ tenantId, ...dto });
    return this.roomTypeRepo.save(rt);
  }

  listRoomTypes(tenantId: string, branchId?: string): Promise<RoomType[]> {
    const where: any = { tenantId, isActive: true };
    if (branchId) where.branchId = branchId;
    return this.roomTypeRepo.find({ where, order: { name: 'ASC' } });
  }

  async updateRoomType(id: string, tenantId: string, data: Partial<RoomType>): Promise<RoomType> {
    const rt = await this.roomTypeRepo.findOne({ where: { id, tenantId } });
    if (!rt) throw new NotFoundException('Room type not found');
    Object.assign(rt, data);
    return this.roomTypeRepo.save(rt);
  }

  async deleteRoomType(id: string, tenantId: string): Promise<void> {
    const rt = await this.roomTypeRepo.findOne({ where: { id, tenantId } });
    if (!rt) throw new NotFoundException('Room type not found');
    rt.isActive = false;
    await this.roomTypeRepo.save(rt);
  }

  // ── Rooms ───────────────────────────────────────────────────────────────────

  async createRoom(tenantId: string, dto: CreateRoomDto): Promise<Room> {
    const exists = await this.roomRepo.findOne({
      where: { tenantId, branchId: dto.branchId, roomNumber: dto.roomNumber },
    });
    if (exists) throw new ConflictException(`Room ${dto.roomNumber} already exists in this branch`);

    const rt = await this.roomTypeRepo.findOne({ where: { id: dto.roomTypeId, tenantId } });
    if (!rt) throw new NotFoundException('Room type not found');

    const room = this.roomRepo.create({ tenantId, ...dto });
    const saved = await this.roomRepo.save(room);

    // Update counter
    await this.roomTypeRepo.increment({ id: rt.id }, 'totalRooms', 1);

    return saved;
  }

  async listRooms(tenantId: string, branchId?: string, status?: RoomStatus): Promise<Room[]> {
    const where: any = { tenantId, isActive: true };
    if (branchId) where.branchId = branchId;
    if (status)   where.status   = status;
    return this.roomRepo.find({ where, relations: ['roomType'], order: { floor: 'ASC', roomNumber: 'ASC' } });
  }

  async updateRoom(id: string, tenantId: string, data: Partial<Room>): Promise<Room> {
    const room = await this.roomRepo.findOne({ where: { id, tenantId } });
    if (!room) throw new NotFoundException('Room not found');
    Object.assign(room, data);
    return this.roomRepo.save(room);
  }

  async updateRoomStatus(id: string, tenantId: string, status: RoomStatus): Promise<Room> {
    const room = await this.roomRepo.findOne({ where: { id, tenantId } });
    if (!room) throw new NotFoundException('Room not found');
    room.status = status;
    return this.roomRepo.save(room);
  }

  // ── Guests ──────────────────────────────────────────────────────────────────

  async createGuest(tenantId: string, dto: CreateGuestDto): Promise<Guest> {
    const guest = this.guestRepo.create({ tenantId, ...dto } as Guest);
    return this.guestRepo.save(guest) as Promise<Guest>;
  }

  async searchGuests(tenantId: string, query: string): Promise<Guest[]> {
    if (!query || query.trim().length < 2) {
      return this.guestRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' }, take: 20 });
    }
    const q = `%${query.trim()}%`;
    return this.guestRepo
      .createQueryBuilder('g')
      .where('g.tenant_id = :tenantId', { tenantId })
      .andWhere('(g.name ILIKE :q OR g.phone ILIKE :q OR g.email ILIKE :q)', { q })
      .orderBy('g.total_stays', 'DESC')
      .limit(20)
      .getMany() as Promise<Guest[]>;
  }

  getGuest(id: string, tenantId: string): Promise<Guest | null> {
    return this.guestRepo.findOne({ where: { id, tenantId } });
  }

  async updateGuest(id: string, tenantId: string, data: Partial<Guest>): Promise<Guest> {
    const guest = await this.guestRepo.findOne({ where: { id, tenantId } });
    if (!guest) throw new NotFoundException('Guest not found');
    Object.assign(guest, data);
    return this.guestRepo.save(guest);
  }

  // ── Reservations ────────────────────────────────────────────────────────────

  private calcNights(checkIn: string, checkOut: string): number {
    const msPerDay = 86_400_000;
    return Math.max(1, Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / msPerDay,
    ));
  }

  async createReservation(tenantId: string, dto: CreateReservationDto, userId?: string) {
    return this.dataSource.transaction(async (em) => {
      // 1. Resolve or create guest
      let guestId = dto.primaryGuestId;
      if (!guestId && dto.guest) {
        const g = em.create(Guest, { tenantId, ...dto.guest } as any);
        const saved = await em.save(g);
        guestId = saved.id;
      }
      if (!guestId) throw new BadRequestException('Guest information is required');

      // 2. Validate room
      const room = await em.findOne(Room, { where: { id: dto.roomId, tenantId }, relations: ['roomType'] });
      if (!room) throw new NotFoundException('Room not found');
      if (room.status === RoomStatus.MAINTENANCE || room.status === RoomStatus.OUT_OF_ORDER) {
        throw new BadRequestException(`Room ${room.roomNumber} is not available (${room.status})`);
      }

      // 3. Check for overlapping reservations
      const overlap = await em
        .createQueryBuilder(Reservation, 'r')
        .where('r.room_id = :roomId', { roomId: dto.roomId })
        .andWhere('r.status NOT IN (:...bad)', { bad: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW, ReservationStatus.CHECKED_OUT] })
        .andWhere('r.check_in_date < :checkOut', { checkOut: dto.checkOutDate })
        .andWhere('r.check_out_date > :checkIn', { checkIn: dto.checkInDate })
        .getOne();
      if (overlap) throw new ConflictException(`Room ${room.roomNumber} is already booked for the selected dates`);

      // 4. Calculate financials
      const numNights   = this.calcNights(dto.checkInDate, dto.checkOutDate);
      const rate        = dto.ratePerNight ?? Number(room.roomType?.baseRate ?? 0);
      const subtotal    = rate * numNights;
      const taxRate     = 0.12;   // 12% GST on accommodation
      const taxAmount   = Math.round(subtotal * taxRate * 100) / 100;
      const totalAmount = subtotal + taxAmount;
      const advancePaid = dto.advancePaid ?? 0;
      const balanceDue  = totalAmount - advancePaid;

      // 5. Create reservation
      const reservation = em.create(Reservation, {
        tenantId,
        branchId:       dto.branchId,
        roomId:         dto.roomId,
        primaryGuestId: guestId,
        numAdults:      dto.numAdults ?? 1,
        numChildren:    dto.numChildren ?? 0,
        checkInDate:    dto.checkInDate,
        checkOutDate:   dto.checkOutDate,
        status:         ReservationStatus.CONFIRMED,
        ratePerNight:   rate,
        numNights,
        subtotal,
        taxAmount,
        totalAmount,
        advancePaid,
        balanceDue,
        source:          dto.source ?? BookingSource.WALK_IN,
        bookingRef:      dto.bookingRef,
        specialRequests: dto.specialRequests,
        notes:           dto.notes,
        createdById:     userId,
      });
      const saved = await em.save(reservation);

      // 6. Mark room as reserved
      await em.update(Room, { id: dto.roomId }, { status: RoomStatus.RESERVED });

      // 7. Create advance folio entry if advance paid
      if (advancePaid > 0) {
        const charge = em.create(FolioCharge, {
          tenantId,
          reservationId: saved.id,
          description:   'Advance payment',
          amount:        -advancePaid,
          chargeType:    ChargeType.ADVANCE,
          date:          new Date().toISOString().split('T')[0],
        });
        await em.save(charge);
      }

      return em.findOne(Reservation, {
        where: { id: saved.id },
        relations: ['room', 'room.roomType', 'primaryGuest'],
      });
    });
  }

  async listReservations(tenantId: string, query: ListReservationsQuery) {
    const { branchId, status, from, to, search, page = 1, limit = 50 } = query;

    const qb = this.reservationRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.room', 'room')
      .leftJoinAndSelect('room.roomType', 'roomType')
      .leftJoinAndSelect('r.primaryGuest', 'guest')
      .where('r.tenant_id = :tenantId', { tenantId });

    if (branchId) qb.andWhere('r.branch_id = :branchId', { branchId });
    if (status)   qb.andWhere('r.status = :status', { status });
    if (from)     qb.andWhere('r.check_in_date >= :from', { from });
    if (to)       qb.andWhere('r.check_out_date <= :to', { to });
    if (search) {
      qb.andWhere(
        '(guest.name ILIKE :s OR guest.phone ILIKE :s OR room.room_number ILIKE :s OR r.booking_ref ILIKE :s)',
        { s: `%${search}%` },
      );
    }

    const [data, total] = await qb
      .orderBy('r.check_in_date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async getReservation(id: string, tenantId: string): Promise<Reservation> {
    const r = await this.reservationRepo.findOne({
      where: { id, tenantId },
      relations: ['room', 'room.roomType', 'primaryGuest'],
    });
    if (!r) throw new NotFoundException('Reservation not found');
    return r;
  }

  async checkIn(id: string, tenantId: string): Promise<Reservation> {
    const r = await this.reservationRepo.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Reservation not found');
    if (r.status !== ReservationStatus.CONFIRMED) {
      throw new BadRequestException(`Cannot check in — reservation status is ${r.status}`);
    }

    await this.dataSource.transaction(async (em) => {
      // Update reservation
      await em.update(Reservation, { id }, {
        status:       ReservationStatus.CHECKED_IN,
        actualCheckIn: new Date(),
      });
      // Mark room occupied
      await em.update(Room, { id: r.roomId }, { status: RoomStatus.OCCUPIED });

      // Post room charge for first night
      const charge = em.create(FolioCharge, {
        tenantId,
        reservationId: id,
        description:   `Room charge — Night 1`,
        amount:        Number(r.ratePerNight),
        chargeType:    ChargeType.ROOM_CHARGE,
        date:          r.checkInDate,
      });
      await em.save(charge);
    });

    return this.getReservation(id, tenantId);
  }

  async checkOut(id: string, tenantId: string): Promise<Reservation> {
    const r = await this.reservationRepo.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Reservation not found');
    if (r.status !== ReservationStatus.CHECKED_IN) {
      throw new BadRequestException(`Cannot check out — reservation status is ${r.status}`);
    }

    await this.dataSource.transaction(async (em) => {
      await em.update(Reservation, { id }, {
        status:        ReservationStatus.CHECKED_OUT,
        actualCheckOut: new Date(),
      });
      // Mark room as needing cleaning
      await em.update(Room, { id: r.roomId }, { status: RoomStatus.CLEANING });

      // Increment guest stay counter
      await em.increment(Guest, { id: r.primaryGuestId }, 'totalStays', 1);

      // Auto-create housekeeping task
      const task = em.create(HousekeepingTask, {
        tenantId,
        branchId:      r.branchId,
        roomId:        r.roomId,
        reservationId: id,
        taskType:      HkTaskType.CHECKOUT_CLEAN,
        status:        HkStatus.PENDING,
        priority:      HkPriority.HIGH,
        scheduledFor:  new Date().toISOString().split('T')[0],
      });
      await em.save(task);
    });

    return this.getReservation(id, tenantId);
  }

  async cancelReservation(id: string, tenantId: string, reason: string): Promise<Reservation> {
    const r = await this.reservationRepo.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Reservation not found');
    if ([ReservationStatus.CHECKED_OUT, ReservationStatus.CANCELLED].includes(r.status)) {
      throw new BadRequestException(`Reservation is already ${r.status}`);
    }

    await this.dataSource.transaction(async (em) => {
      await em.update(Reservation, { id }, {
        status:       ReservationStatus.CANCELLED,
        cancelledAt:  new Date(),
        cancelReason: reason,
      });
      // Free the room back to available (only if it was reserved, not occupied)
      if (r.status === ReservationStatus.CONFIRMED) {
        await em.update(Room, { id: r.roomId }, { status: RoomStatus.AVAILABLE });
      }
    });

    return this.getReservation(id, tenantId);
  }

  // ── Folio ───────────────────────────────────────────────────────────────────

  async getFolio(reservationId: string, tenantId: string) {
    const r = await this.reservationRepo.findOne({
      where: { id: reservationId, tenantId },
      relations: ['room', 'room.roomType', 'primaryGuest'],
    });
    if (!r) throw new NotFoundException('Reservation not found');

    const charges = await this.folioRepo.find({
      where: { reservationId, tenantId },
      order: { createdAt: 'ASC' },
    });

    const total    = charges.reduce((s, c) => s + Number(c.amount), 0);
    const payments = charges
      .filter((c) => c.chargeType === ChargeType.ADVANCE || c.chargeType === ChargeType.SETTLEMENT)
      .reduce((s, c) => s + Math.abs(Number(c.amount)), 0);

    return { reservation: r, charges, totalCharges: total, totalPaid: payments, balance: total + payments };
  }

  async addFolioCharge(reservationId: string, tenantId: string, dto: AddFolioChargeDto) {
    const r = await this.reservationRepo.findOne({ where: { id: reservationId, tenantId } });
    if (!r) throw new NotFoundException('Reservation not found');

    const charge = this.folioRepo.create({
      tenantId,
      reservationId,
      description: dto.description,
      amount:      dto.chargeType === ChargeType.ADVANCE || dto.chargeType === ChargeType.DISCOUNT
        ? -Math.abs(dto.amount)   // credits are stored as negative
        : dto.amount,
      chargeType:  dto.chargeType,
      referenceId: dto.referenceId,
      date:        dto.date ?? new Date().toISOString().split('T')[0],
    });
    return this.folioRepo.save(charge);
  }

  // ── Housekeeping ────────────────────────────────────────────────────────────

  async listHousekeepingTasks(tenantId: string, branchId?: string, date?: string) {
    const where: any = { tenantId };
    if (branchId) where.branchId = branchId;
    where.scheduledFor = date ?? new Date().toISOString().split('T')[0];
    return this.hkRepo.find({ where, order: { priority: 'DESC', createdAt: 'ASC' } });
  }

  async updateHousekeepingTask(id: string, tenantId: string, status: HkStatus, notes?: string) {
    const task = await this.hkRepo.findOne({ where: { id, tenantId } });
    if (!task) throw new NotFoundException('Task not found');

    task.status = status;
    if (notes)                        task.notes = notes;
    if (status === HkStatus.IN_PROGRESS && !task.startedAt)  task.startedAt  = new Date();
    if (status === HkStatus.DONE      && !task.completedAt)  task.completedAt = new Date();

    const saved = await this.hkRepo.save(task);

    // When cleaning is done → mark room available
    if (status === HkStatus.DONE && task.taskType === HkTaskType.CHECKOUT_CLEAN) {
      await this.roomRepo.update({ id: task.roomId, tenantId }, { status: RoomStatus.AVAILABLE });
    }

    return saved;
  }

  async createHousekeepingTask(tenantId: string, dto: {
    branchId: string;
    roomId: string;
    taskType: HkTaskType;
    priority?: HkPriority;
    scheduledFor?: string;
    notes?: string;
    assignedTo?: string;
  }) {
    const task = this.hkRepo.create({
      tenantId,
      branchId:     dto.branchId,
      roomId:       dto.roomId,
      taskType:     dto.taskType,
      priority:     dto.priority ?? HkPriority.NORMAL,
      scheduledFor: dto.scheduledFor ?? new Date().toISOString().split('T')[0],
      notes:        dto.notes,
      assignedTo:   dto.assignedTo,
      status:       HkStatus.PENDING,
    });
    return this.hkRepo.save(task);
  }

  // ── Dashboard summary ────────────────────────────────────────────────────────

  async getDashboard(tenantId: string, branchId?: string) {
    const today = new Date().toISOString().split('T')[0];

    const roomsQuery = this.roomRepo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId AND r.is_active = true', { tenantId });
    if (branchId) roomsQuery.andWhere('r.branch_id = :branchId', { branchId });

    const rooms = await roomsQuery.getMany();

    const byStatus = rooms.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});

    const [arrivalsToday, departuresToday, inHouse] = await Promise.all([
      this.reservationRepo.count({ where: { tenantId, ...(branchId ? { branchId } : {}), checkInDate: today,  status: ReservationStatus.CONFIRMED } }),
      this.reservationRepo.count({ where: { tenantId, ...(branchId ? { branchId } : {}), checkOutDate: today, status: ReservationStatus.CHECKED_IN } }),
      this.reservationRepo.count({ where: { tenantId, ...(branchId ? { branchId } : {}), status: ReservationStatus.CHECKED_IN } }),
    ]);

    const totalRooms  = rooms.length;
    const occupancyPct = totalRooms > 0 ? Math.round((byStatus[RoomStatus.OCCUPIED] ?? 0) / totalRooms * 100) : 0;

    return {
      totalRooms,
      occupancyPct,
      roomsByStatus: byStatus,
      arrivalsToday,
      departuresToday,
      inHouse,
    };
  }
}
