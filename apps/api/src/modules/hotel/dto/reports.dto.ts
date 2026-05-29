import { ApiProperty } from '@nestjs/swagger';

export class RevenueReportDto {
    @ApiProperty()
    date: string;

    @ApiProperty()
    bookings: number;

    @ApiProperty()
    revenue: number;

    @ApiProperty()
    tax: number;

    @ApiProperty()
    net_revenue: number;
}

export class BookingReportDto {
    @ApiProperty()
    booking_id: string;

    @ApiProperty()
    guest_name: string;

    @ApiProperty()
    guest_email?: string;

    @ApiProperty()
    guest_phone?: string;

    @ApiProperty()
    check_in: Date;

    @ApiProperty()
    check_out: Date;

    @ApiProperty()
    room_number: string;

    @ApiProperty()
    status: string;

    @ApiProperty()
    amount: number;

    @ApiProperty()
    nights?: number;

    @ApiProperty()
    payment_status?: string;
}

export class RoomPerformanceDto {
    @ApiProperty()
    room_number: string;

    @ApiProperty()
    room_type: string;

    @ApiProperty()
    bookings: number;

    @ApiProperty()
    occupancy: number;

    @ApiProperty()
    revenue: number;

    @ApiProperty()
    avg_rate: number;
}

export class PaymentReportDto {
    @ApiProperty()
    method: string;

    @ApiProperty()
    total_amount: number;

    @ApiProperty()
    transaction_count: number;
}

export class GstReportDto {
    @ApiProperty()
    month: string;

    @ApiProperty()
    total_invoices: number;

    @ApiProperty()
    taxable_value: number;

    @ApiProperty()
    cgst: number;

    @ApiProperty()
    sgst: number;

    @ApiProperty()
    igst: number;

    @ApiProperty()
    total_tax: number;

    @ApiProperty()
    gross_value: number;
}

export class FrontDeskReportDto {
    @ApiProperty()
    staff_id: string;

    @ApiProperty()
    staff_name: string;

    @ApiProperty()
    check_ins: number;

    @ApiProperty()
    check_outs: number;

    @ApiProperty()
    bookings_handled: number;

    @ApiProperty()
    revenue_managed: number;

    @ApiProperty()
    avg_booking_value: number;
}

export class OccupancySummaryDto {
    @ApiProperty()
    occupancy_today: number;

    @ApiProperty()
    available_rooms: number;

    @ApiProperty()
    occupied_rooms: number;

    @ApiProperty()
    maintenance_rooms: number;
}