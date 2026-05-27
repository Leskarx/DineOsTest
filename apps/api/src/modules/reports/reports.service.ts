import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ReportsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** Throws 400 (not 500) when a caller passes a non-date string like "abc". */
  private assertDate(value: string, name: string): void {
    if (!value || isNaN(new Date(value).getTime())) {
      throw new BadRequestException(`Invalid date for '${name}': "${value}". Use ISO 8601 format (YYYY-MM-DD).`);
    }
  }

  async getDailySales(branchId: string, tenantId: string, from: string, to: string) {
    this.assertDate(from, 'from');
    this.assertDate(to, 'to');
    return this.db.query(`
      SELECT
        date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata') AS date,
        COUNT(*) AS total_bills,
        SUM(grand_total) AS gross_sales,
        SUM(discount_amount) AS total_discount,
        SUM(total_tax) AS total_tax,
        SUM(cgst_amount) AS cgst,
        SUM(sgst_amount) AS sgst,
        SUM(igst_amount) AS igst
      FROM bills
      WHERE branch_id = $1 AND tenant_id = $2
        AND status NOT IN ('void','refunded')
        AND created_at BETWEEN $3 AND $4
      GROUP BY date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata')
      ORDER BY date ASC
    `, [branchId, tenantId, from, to]);
  }

  async getItemSalesReport(branchId: string, tenantId: string, from: string, to: string) {
    this.assertDate(from, 'from');
    this.assertDate(to, 'to');
    // order_items.taxable_amount is intentionally kept at the pre-discount price
    // (see recalculateTotals). Apply the order-level discount ratio here so the
    // report reflects the actual discounted taxable value that appears on the bill.
    return this.db.query(`
      SELECT
        oi.name AS item_name,
        oi.menu_item_id,
        SUM(oi.quantity) AS total_qty,
        SUM(oi.line_total) AS total_revenue,
        SUM(
          oi.taxable_amount::numeric
          * (1.0 - COALESCE(o.discount_amount::numeric / NULLIF(o.subtotal::numeric, 0), 0))
        ) AS taxable,
        COUNT(DISTINCT oi.order_id) AS order_count
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.branch_id = $1 AND o.tenant_id = $2
        AND oi.is_voided = false
        AND o.status = 'billed'
        AND o.created_at BETWEEN $3 AND $4
      GROUP BY oi.name, oi.menu_item_id
      ORDER BY total_revenue DESC
      LIMIT 100
    `, [branchId, tenantId, from, to]);
  }

  async getPaymentMethodReport(branchId: string, tenantId: string, from: string, to: string) {
    this.assertDate(from, 'from');
    this.assertDate(to, 'to');
    return this.db.query(`
      SELECT
        method,
        COUNT(*) AS transaction_count,
        SUM(amount) AS total_amount
      FROM payments
      WHERE branch_id = $1 AND tenant_id = $2
        AND status = 'success'
        AND created_at BETWEEN $3 AND $4
      GROUP BY method
      ORDER BY total_amount DESC
    `, [branchId, tenantId, from, to]);
  }

  async getHourlyReport(branchId: string, tenantId: string, date: string) {
    return this.db.query(`
      SELECT
        EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata') AS hour,
        COUNT(*) AS total_bills,
        SUM(grand_total) AS revenue
      FROM bills
      WHERE branch_id = $1 AND tenant_id = $2
        AND status NOT IN ('void','refunded')
        AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') = $3
      GROUP BY EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')
      ORDER BY hour
    `, [branchId, tenantId, date]);
  }

  async getCategoryReport(branchId: string, tenantId: string, from: string, to: string) {
    this.assertDate(from, 'from');
    this.assertDate(to, 'to');
    return this.db.query(`
      SELECT
        c.name AS category_name,
        SUM(oi.quantity) AS total_qty,
        SUM(oi.line_total) AS total_revenue
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      JOIN categories c ON c.id = mi.category_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.branch_id = $1 AND o.tenant_id = $2
        AND oi.is_voided = false
        AND o.status = 'billed'
        AND o.created_at BETWEEN $3 AND $4
      GROUP BY c.name
      ORDER BY total_revenue DESC
    `, [branchId, tenantId, from, to]);
  }

  async getDashboardSummary(branchId: string, tenantId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const [todaySales, weekSales, pendingOrders, stockAlerts, orderStats, revLeakage, tableStats] =
      await Promise.all([
        this.db.query(`
          SELECT COALESCE(SUM(grand_total),0) AS today_sales, COUNT(*) AS today_bills
          FROM bills WHERE branch_id=$1 AND tenant_id=$2 AND source='pos'
          AND status NOT IN ('void','refunded')
          AND DATE(created_at AT TIME ZONE 'Asia/Kolkata')=$3
        `, [branchId, tenantId, today]),

        this.db.query(`
          SELECT COALESCE(SUM(grand_total),0) AS week_sales
          FROM bills WHERE branch_id=$1 AND tenant_id=$2 AND source='pos'
          AND status NOT IN ('void','refunded')
          AND created_at >= NOW() - INTERVAL '7 days'
        `, [branchId, tenantId]),

        this.db.query(`
          SELECT COUNT(*) AS pending
          FROM orders WHERE branch_id=$1 AND tenant_id=$2
          AND status NOT IN ('billed','cancelled')
        `, [branchId, tenantId]),

        this.db.query(`
          SELECT COUNT(*) AS low_stock
          FROM inventory_items
          WHERE (branch_id=$1 OR branch_id IS NULL) AND tenant_id=$2
          AND current_stock <= min_stock_level AND is_active=true
        `, [branchId, tenantId]),

        // Order stats for today
        this.db.query(`
          SELECT
            COUNT(*) FILTER (WHERE status = 'billed' AND NOT is_complimentary) AS successful,
            COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
            COUNT(*) FILTER (WHERE is_complimentary = true) AS complimentary,
            COUNT(*) FILTER (WHERE is_sales_return = true) AS returns
          FROM orders
          WHERE branch_id=$1 AND tenant_id=$2
          AND DATE(created_at AT TIME ZONE 'Asia/Kolkata')=$3
        `, [branchId, tenantId, today]),

        // Revenue leakage: voided order items & cancelled orders with non-zero value today
        this.db.query(`
          SELECT
            (SELECT COUNT(*) FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE o.branch_id=$1 AND o.tenant_id=$2 AND oi.is_voided=true
             AND DATE(oi.created_at AT TIME ZONE 'Asia/Kolkata')=$3
            ) AS voided_items,
            (SELECT COUNT(*) FROM orders
             WHERE branch_id=$1 AND tenant_id=$2 AND status='cancelled'
             AND grand_total > 0
             AND DATE(created_at AT TIME ZONE 'Asia/Kolkata')=$3
            ) AS cancelled_with_value
        `, [branchId, tenantId, today]),

        // Average table turnaround: placed_at → billed_at for dine-in today
        this.db.query(`
          SELECT COALESCE(AVG(
            EXTRACT(EPOCH FROM (billed_at - placed_at)) / 60
          ), 0) AS avg_turnaround_minutes
          FROM orders
          WHERE branch_id=$1 AND tenant_id=$2
          AND type = 'dine_in' AND placed_at IS NOT NULL AND billed_at IS NOT NULL
          AND DATE(billed_at AT TIME ZONE 'Asia/Kolkata')=$3
        `, [branchId, tenantId, today]),
      ]);

    return {
      todaySales: Number(todaySales[0]?.today_sales || 0),
      todayBills: Number(todaySales[0]?.today_bills || 0),
      weekSales: Number(weekSales[0]?.week_sales || 0),
      pendingOrders: Number(pendingOrders[0]?.pending || 0),
      lowStockAlerts: Number(stockAlerts[0]?.low_stock || 0),
      orderStats: {
        successful: Number(orderStats[0]?.successful || 0),
        cancelled: Number(orderStats[0]?.cancelled || 0),
        complimentary: Number(orderStats[0]?.complimentary || 0),
        returns: Number(orderStats[0]?.returns || 0),
      },
      revenuLeakage: {
        voidedItems: Number(revLeakage[0]?.voided_items || 0),
        cancelledWithValue: Number(revLeakage[0]?.cancelled_with_value || 0),
      },
      tableStats: {
        avgTurnaroundMinutes: Math.round(Number(tableStats[0]?.avg_turnaround_minutes || 0)),
      },
    };
  }

  async getGstReport(branchId: string, tenantId: string, from: string, to: string) {
    this.assertDate(from, 'from');
    this.assertDate(to, 'to');
    return this.db.query(`
      SELECT
        DATE_TRUNC('month', issued_at AT TIME ZONE 'Asia/Kolkata') AS month,
        SUM(taxable_amount) AS taxable_value,
        SUM(cgst_amount) AS cgst,
        SUM(sgst_amount) AS sgst,
        SUM(igst_amount) AS igst,
        SUM(cess_amount) AS cess,
        SUM(total_tax) AS total_tax,
        SUM(grand_total) AS gross_value
      FROM bills
      WHERE branch_id = $1 AND tenant_id = $2
        AND status NOT IN ('void','refunded')
        AND issued_at BETWEEN $3 AND $4
      GROUP BY DATE_TRUNC('month', issued_at AT TIME ZONE 'Asia/Kolkata')
      ORDER BY month
    `, [branchId, tenantId, from, to]);
  }

  async getHotelDashboardSummary(branchId: string, tenantId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const [todaySales, weekSales, todayCheckins, todayCheckouts, roomsData, weeklyChart] = await Promise.all([
      // Today's Hotel Sales
      this.db.query(`
        SELECT COALESCE(SUM(grand_total),0) AS revenue, COUNT(*) AS count
        FROM bills WHERE branch_id=$1 AND tenant_id=$2 AND source='hotel'
        AND status NOT IN ('void','refunded')
        AND DATE(created_at AT TIME ZONE 'Asia/Kolkata')=$3
      `, [branchId, tenantId, today]),

      // This Week's Hotel Sales
      this.db.query(`
        SELECT COALESCE(SUM(grand_total),0) AS revenue
        FROM bills WHERE branch_id=$1 AND tenant_id=$2 AND source='hotel'
        AND status NOT IN ('void','refunded')
        AND created_at >= NOW() - INTERVAL '7 days'
      `, [branchId, tenantId]),

      // Today's Check-ins
      this.db.query(`
        SELECT COUNT(*) AS count
        FROM hotel_reservations WHERE branch_id=$1 AND tenant_id=$2
        AND check_in_date=$3 AND status NOT IN ('cancelled', 'no_show')
      `, [branchId, tenantId, today]),

      // Today's Check-outs
      this.db.query(`
        SELECT COUNT(*) AS count
        FROM hotel_reservations WHERE branch_id=$1 AND tenant_id=$2
        AND check_out_date=$3 AND status NOT IN ('cancelled', 'no_show')
      `, [branchId, tenantId, today]),

      // Occupancy (Rooms sold vs Total rooms)
      this.db.query(`
        SELECT 
          (SELECT COUNT(*) FROM hotel_rooms WHERE branch_id=$1 AND tenant_id=$2 AND status != 'out_of_order') as total_rooms,
          (SELECT COUNT(*) FROM hotel_reservations WHERE branch_id=$1 AND tenant_id=$2 AND status IN ('checked_in')) as occupied_rooms
      `, [branchId, tenantId]),

      // Weekly Revenue Chart (last 7 days grouped by date)
      this.db.query(`
        SELECT 
          TO_CHAR(date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata'), 'Mon DD') AS date,
          COALESCE(SUM(grand_total), 0) AS revenue
        FROM bills
        WHERE branch_id=$1 AND tenant_id=$2 AND source='hotel'
        AND status NOT IN ('void','refunded')
        AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata')
        ORDER BY date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata') ASC
      `, [branchId, tenantId])
    ]);

    const totalRooms = Number(roomsData[0]?.total_rooms || 0);
    const occupiedRooms = Number(roomsData[0]?.occupied_rooms || 0);
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
    
    // ADR (Average Daily Rate) = Today's Revenue / Occupied Rooms
    const todayRev = Number(todaySales[0]?.revenue || 0);
    const adr = occupiedRooms > 0 ? todayRev / occupiedRooms : 0;

    return {
      todaySales: todayRev,
      todayBills: Number(todaySales[0]?.count || 0),
      weekSales: Number(weekSales[0]?.revenue || 0),
      todayCheckins: Number(todayCheckins[0]?.count || 0),
      todayCheckouts: Number(todayCheckouts[0]?.count || 0),
      occupancyRate,
      adr: Math.round(adr),
      weeklyChart: weeklyChart.map((r: any) => ({
        date: r.date,
        revenue: Number(r.revenue || 0)
      }))
    };
  }

  async getOwnerDashboardSummary(branchId: string, tenantId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const [
      totalRevToday, totalRevWeek, posSalesToday, hotelSalesToday,
      pendingOrders, occupancy, checkins, checkouts,
      weeklyChart, paymentBreakdown, lowStock
    ] = await Promise.all([
      // Total revenue today (POS + Hotel combined)
      this.db.query(`
        SELECT COALESCE(SUM(grand_total),0) AS revenue, COUNT(*) AS bills
        FROM bills WHERE branch_id=$1 AND tenant_id=$2
        AND status NOT IN ('void','refunded')
        AND DATE(created_at AT TIME ZONE 'Asia/Kolkata')=$3
      `, [branchId, tenantId, today]),

      // Total revenue 7 days (POS + Hotel combined)
      this.db.query(`
        SELECT COALESCE(SUM(grand_total),0) AS revenue
        FROM bills WHERE branch_id=$1 AND tenant_id=$2
        AND status NOT IN ('void','refunded')
        AND created_at >= NOW() - INTERVAL '7 days'
      `, [branchId, tenantId]),

      // POS-only today
      this.db.query(`
        SELECT COALESCE(SUM(grand_total),0) AS revenue, COUNT(*) AS bills
        FROM bills WHERE branch_id=$1 AND tenant_id=$2 AND source='pos'
        AND status NOT IN ('void','refunded')
        AND DATE(created_at AT TIME ZONE 'Asia/Kolkata')=$3
      `, [branchId, tenantId, today]),

      // Hotel-only today
      this.db.query(`
        SELECT COALESCE(SUM(grand_total),0) AS revenue, COUNT(*) AS bills
        FROM bills WHERE branch_id=$1 AND tenant_id=$2 AND source='hotel'
        AND status NOT IN ('void','refunded')
        AND DATE(created_at AT TIME ZONE 'Asia/Kolkata')=$3
      `, [branchId, tenantId, today]),

      // Pending orders
      this.db.query(`
        SELECT COUNT(*) AS count
        FROM orders WHERE branch_id=$1 AND tenant_id=$2
        AND status NOT IN ('billed','cancelled')
      `, [branchId, tenantId]),

      // Occupancy
      this.db.query(`
        SELECT
          (SELECT COUNT(*) FROM hotel_rooms WHERE branch_id=$1 AND tenant_id=$2 AND status != 'out_of_order') AS total_rooms,
          (SELECT COUNT(*) FROM hotel_reservations WHERE branch_id=$1 AND tenant_id=$2 AND status IN ('checked_in')) AS occupied_rooms
      `, [branchId, tenantId]),

      // Today's check-ins
      this.db.query(`
        SELECT COUNT(*) AS count
        FROM hotel_reservations WHERE branch_id=$1 AND tenant_id=$2
        AND check_in_date=$3 AND status NOT IN ('cancelled','no_show')
      `, [branchId, tenantId, today]),

      // Today's check-outs
      this.db.query(`
        SELECT COUNT(*) AS count
        FROM hotel_reservations WHERE branch_id=$1 AND tenant_id=$2
        AND check_out_date=$3 AND status NOT IN ('cancelled','no_show')
      `, [branchId, tenantId, today]),

      // Weekly chart (POS + Hotel stacked by day)
      this.db.query(`
        SELECT
          TO_CHAR(date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata'), 'Mon DD') AS date,
          COALESCE(SUM(grand_total) FILTER (WHERE source='pos'), 0) AS pos,
          COALESCE(SUM(grand_total) FILTER (WHERE source='hotel'), 0) AS hotel,
          COALESCE(SUM(grand_total), 0) AS total
        FROM bills
        WHERE branch_id=$1 AND tenant_id=$2
        AND status NOT IN ('void','refunded')
        AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata')
        ORDER BY date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata') ASC
      `, [branchId, tenantId]),

      // Payment method breakdown today
      this.db.query(`
        SELECT method, COALESCE(SUM(amount),0) AS total
        FROM payments
        WHERE branch_id=$1 AND tenant_id=$2
        AND status='success'
        AND DATE(created_at AT TIME ZONE 'Asia/Kolkata')=$3
        GROUP BY method ORDER BY total DESC
      `, [branchId, tenantId, today]),

      // Low stock count
      this.db.query(`
        SELECT COUNT(*) AS count
        FROM inventory_items
        WHERE (branch_id=$1 OR branch_id IS NULL) AND tenant_id=$2
        AND current_stock <= min_stock_level AND is_active=true
      `, [branchId, tenantId]),
    ]);

    const totalRooms = Number(occupancy[0]?.total_rooms || 0);
    const occupiedRooms = Number(occupancy[0]?.occupied_rooms || 0);
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    return {
      totalRevenueToday: Number(totalRevToday[0]?.revenue || 0),
      totalBillsToday: Number(totalRevToday[0]?.bills || 0),
      totalRevenueWeek: Number(totalRevWeek[0]?.revenue || 0),
      posRevenueToday: Number(posSalesToday[0]?.revenue || 0),
      posBillsToday: Number(posSalesToday[0]?.bills || 0),
      hotelRevenueToday: Number(hotelSalesToday[0]?.revenue || 0),
      hotelBillsToday: Number(hotelSalesToday[0]?.bills || 0),
      pendingOrders: Number(pendingOrders[0]?.count || 0),
      occupancyRate,
      todayCheckins: Number(checkins[0]?.count || 0),
      todayCheckouts: Number(checkouts[0]?.count || 0),
      lowStockAlerts: Number(lowStock[0]?.count || 0),
      weeklyChart: (weeklyChart || []).map((r: any) => ({
        date: r.date,
        pos: Number(r.pos || 0),
        hotel: Number(r.hotel || 0),
        total: Number(r.total || 0),
      })),
      paymentBreakdown: (paymentBreakdown || []).map((r: any) => ({
        method: r.method,
        total: Number(r.total || 0),
      })),
    };
  }
}
