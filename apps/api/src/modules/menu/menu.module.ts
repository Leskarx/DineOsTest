import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItem } from './entities/menu-item.entity';
import { MenuItemVariation } from './entities/menu-item-variation.entity';
import { Category } from './entities/category.entity';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { GstRate } from '../billing/entities/gst-rate.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MenuItem, MenuItemVariation, Category, GstRate])],
  providers: [MenuService],
  controllers: [MenuController],
  exports: [MenuService],
})
export class MenuModule {}
