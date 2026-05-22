import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelService }    from './hotel.service';
import { HotelController } from './hotel.controller';
import { RoomType }         from './entities/room-type.entity';
import { Room }             from './entities/room.entity';
import { Guest }            from './entities/guest.entity';
import { Reservation }      from './entities/reservation.entity';
import { FolioCharge }      from './entities/folio-charge.entity';
import { HousekeepingTask } from './entities/housekeeping-task.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoomType, Room, Guest, Reservation, FolioCharge, HousekeepingTask,
    ]),
  ],
  providers:   [HotelService],
  controllers: [HotelController],
  exports:     [HotelService],
})
export class HotelModule {}
