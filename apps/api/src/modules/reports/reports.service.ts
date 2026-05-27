import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ReportsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  private assertDate(value: string, name: string): void {
    if (!value || isNaN(new Date(value).getTime())) {
      throw new BadRequestException(
        `Invalid date for '${name}': "${value}". Use ISO 8601 format (YYYY-MM-DD).`,
      );
    }
  }

  private toDateRange(from: string, to: string): { start: string; end: string } {
    return {
      start: `${from}T00:00:00.000+05:30`,
      end:   `${to}T23:59:59.999+05:30`,
    };
  }

  // ── Daily Sales ────────────────────────────────────────────────────────────

  async getDailySales(branchId: string, tenantId: string, from: string, to: string) {
    this.assertDate(from, 'from');
    this.assertDate(to, 'to');
    const { start, end } = this.toDateRange(from, to);

    return this.db.query(`
      SELECT
        date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata')
          AT TIME ZONE 'Asia/Kolkata'                              AS date,
        COUNT(*)::int                     AS total_bills,
        COALESCE(SUM(grand_total),     0) AS gross_sales,
        COALESCE(SUM(discount_amount), 0) AS total_discount,
        COALESCE(SUM(total_tax),       0) AS total_tax,
        COALESCE(SUM(cgst_amount),     0) AS cgst,
        COALESCE(SUM(sgst_amount),     0) AS sgst,
        COALESCE(SUM(igst_amount),     0) AS igst
      FROM bills
      WHERE branch_id = $1
        AND tenant_id = $2
        AND status NOT IN ('void', 'refunded')
        AND created_at BETWEEN $3 AND $4
      GROUP BY date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata')
      ORDER BY date ASC
    `, [branchId, tenantId, start, end]);
  }

  // ── Item Sales ─────────────────────────────────────────────────────────────

  async getItemSalesReport(branchId: string, tenantId: string, from: string, to: string) {
    this.assertDate(from, 'from');
    this.assertDate(to, 'to');
    const { start, end } = this.toDateRange(from, to);

    return this.db.query(`
      SELECT
        oi.name                                   AS item_name,
        oi.menu_item_id,
        SUM(oi.quantity)::numeric                 AS total_qty,
        COALESCE(SUM(oi.line_total), 0)::numeric  AS total_revenue,
        SUM(
          oi.taxable_amount::numeric
          * (1.0 - COALESCE(
              o.discount_amount::numeric / NULLIF(o.subtotal::numeric, 0), 0
            ))
        )                                         AS taxable,
        COUNT(DISTINCT oi.order_id)::int          AS order_count
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.branch_id  = $1
        AND o.tenant_id  = $2
        AND oi.is_voided = false
        AND o.status     = 'billed'
        AND o.created_at BETWEEN $3 AND $4
      GROUP BY oi.name, oi.menu_item_id
      ORDER BY total_revenue DESC
      LIMIT 100
    `, [branchId, tenantId, start, end]);
  }

  // ── Payment Methods ────────────────────────────────────────────────────────

  async getPaymentMethodReport(branchId: string, tenantId: string, from: string, to: string) {
    this.assertDate(from, 'from');
    this.assertDate(to, 'to');
    const { start, end } = this.toDateRange(from, to);

    return this.db.query(`
      SELECT
        method,
        COUNT(*)::int            AS transaction_count,
        COALESCE(SUM(amount), 0) AS total_amount
      FROM payments
      WHERE branch_id  = $1
        AND tenant_id  = $2
        AND status     = 'success'
        AND created_at BETWEEN $3 AND $4
      GROUP BY method
      ORDER BY total_amount DESC
    `, [branchId, tenantId, start, end]);
  }

  // ── Hourly ─────────────────────────────────────────────────────────────────

  async getHourlyReport(branchId: string, tenantId: string, date: string) {
    this.assertDate(date, 'date');
    const { start, end } = this.toDateRange(date, date);

    return this.db.query(`
      SELECT
        EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')::int AS hour,
        COUNT(*)::int                 AS total_bills,
        COALESCE(SUM(grand_total), 0) AS revenue
      FROM bills
      WHERE branch_id = $1
        AND tenant_id = $2
        AND status NOT IN ('void', 'refunded')
        AND created_at BETWEEN $3 AND $4
      GROUP BY EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')
      ORDER BY hour
    `, [branchId, tenantId, start, end]);
  }

  // ── Category ───────────────────────────────────────────────────────────────

  async getCategoryReport(branchId: string, tenantId: string, from: string, to: string) {
    this.assertDate(from, 'from');
    this.assertDate(to, 'to');
    const { start, end } = this.toDateRange(from, to);

    return this.db.query(`
      SELECT
        COALESCE(c.name, 'Uncategorised') AS category_name,
        SUM(oi.quantity)::numeric          AS total_qty,
        COALESCE(SUM(oi.line_total), 0)   AS total_revenue
      FROM order_items   oi
      JOIN   orders      o  ON o.id  = oi.order_id
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      LEFT JOIN categories  c  ON c.id  = mi.category_id
      WHERE o.branch_id  = $1
        AND o.tenant_id  = $2
        AND oi.is_voided = false
        AND o.status     = 'billed'
        AND o.created_at BETWEEN $3 AND $4
      GROUP BY COALESCE(c.name, 'Uncategorised')
      ORDER BY total_revenue DESC
    `, [branchId, tenantId, start, end]);
  }

  // ── GST Report ─────────────────────────────────────────────────────────────

  async getGstReport(branchId: string, tenantId: string, from: string, to: string) {
    this.assertDate(from, 'from');
    this.assertDate(to, 'to');
    const { start, end } = this.toDateRange(from, to);

    return this.db.query(`
      SELECT
        DATE_TRUNC('month', issued_at AT TIME ZONE 'Asia/Kolkata')
          AT TIME ZONE 'Asia/Kolkata'                              AS month,
        COALESCE(SUM(taxable_amount), 0) AS taxable_value,
        COALESCE(SUM(cgst_amount),    0) AS cgst,
        COALESCE(SUM(sgst_amount),    0) AS sgst,
        COALESCE(SUM(igst_amount),    0) AS igst,
        COALESCE(SUM(cess_amount),    0) AS cess,
        COALESCE(SUM(total_tax),      0) AS total_tax,
        COALESCE(SUM(grand_total),    0) AS gross_value,
        COUNT(*)::int                    AS total_invoices
      FROM bills
      WHERE branch_id = $1
        AND tenant_id = $2
        AND status NOT IN ('void', 'refunded')
        AND issued_at BETWEEN $3 AND $4
      GROUP BY DATE_TRUNC('month', issued_at AT TIME ZONE 'Asia/Kolkata')
      ORDER BY month
    `, [branchId, tenantId, start, end]);
  }

  // ── GSTR-1 Export ──────────────────────────────────────────────────────────

  async getGstr1Export(branchId: string, tenantId: string, from: string, to: string) {
    this.assertDate(from, 'from');
    this.assertDate(to, 'to');
    const { start, end } = this.toDateRange(from, to);

    const bills = await this.db.query(`
      SELECT
        b.bill_number,
        b.issued_at,
        b.customer_name,
        b.customer_phone,
        b.customer_gstin,
        b.supply_type,
        b.taxable_amount,
        b.cgst_amount,
        b.sgst_amount,
        b.igst_amount,
        b.cess_amount,
        b.total_tax,
        b.grand_total,
        b.gst_summary,
        br.name          AS branch_name,
        br.gstin         AS branch_gstin,
        br.address_line1 AS branch_address,
        br.state_code    AS branch_state_code
      FROM bills b
      LEFT JOIN branches br ON br.id = b.branch_id
      WHERE b.branch_id = $1
        AND b.tenant_id = $2
        AND b.status NOT IN ('void', 'refunded')
        AND b.issued_at BETWEEN $3 AND $4
      ORDER BY b.issued_at ASC
    `, [branchId, tenantId, start, end]);

    const b2b: any[] = [];
    const b2c: any[] = [];

    for (const bill of bills) {
      const isInterState = !!bill.customer_gstin;

      const invoiceDate = new Date(bill.issued_at)
        .toLocaleDateString('en-IN', {
          day: '2-digit', month: '2-digit', year: 'numeric',
        });

      const items = (bill.gst_summary || []).map((g: any) => ({
        num: 1,
        itm_det: {
          rt:    Number(g.gstRate       || 0),
          txval: Number(g.taxableAmount || 0),
          // intra-state: CGST+SGST only, iamt=0
          // inter-state: IGST only, camt+samt=0
          camt:  isInterState ? 0 : Number(g.cgstAmount || 0),
          samt:  isInterState ? 0 : Number(g.sgstAmount || 0),
          iamt:  isInterState ? Number(g.igstAmount || 0) : 0,
          csamt: 0,
        },
      }));

      const invoice = {
        inum:    bill.bill_number,
        idt:     invoiceDate,
        val:     Number(bill.grand_total),
        pos:     bill.branch_state_code || '27',
        rchrg:   'N',
        inv_typ: isInterState ? 'R' : 'B2CL',
        itms:    items,
      };

      if (isInterState) {
        const existing = b2b.find((b: any) => b.ctin === bill.customer_gstin);
        if (existing) {
          existing.inv.push(invoice);
        } else {
          b2b.push({ ctin: bill.customer_gstin, inv: [invoice] });
        }
      } else {
        b2c.push(invoice);
      }
    }

    return {
      gstin:   bills[0]?.branch_gstin || '',
      fp:      from.slice(0, 7).replace('-', ''),
      version: 'GST3.0.4',
      hash:    'hash',
      b2b,
      b2cs:    b2c,
    };
  }

  // ── Shift Report ───────────────────────────────────────────────────────────

  async getShiftReport(branchId: string, tenantId: string, from: string, to: string) {
    this.assertDate(from, 'from');
    this.assertDate(to, 'to');
    const { start, end } = this.toDateRange(from, to);

    return this.db.query(`
      SELECT
        s.id                                                       AS shift_id,
        s.shift_number,
        s.opened_at,
        s.closed_at,
        CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))      AS cashier_name,
        s.opening_cash,
        s.closing_cash,
        s.expected_cash,
        s.cash_difference,
        COALESCE(s.total_sales,   0)                               AS total_sales,
        COALESCE(s.total_orders,  0)                               AS total_orders,
        COALESCE(s.cash_sales,    0)                               AS cash_sales,
        COALESCE(s.card_sales,    0)                               AS card_sales,
        COALESCE(s.upi_sales,     0)                               AS upi_sales,
        COALESCE(s.wallet_sales,  0)                               AS wallet_sales,
        COALESCE(s.credit_sales,  0)                               AS credit_sales,
        COALESCE(s.complimentary, 0)                               AS complimentary,
        COALESCE(s.total_cgst,    0)                               AS total_cgst,
        COALESCE(s.total_sgst,    0)                               AS total_sgst,
        COALESCE(s.total_igst,    0)                               AS total_igst,
        s.status
      FROM shifts s
      LEFT JOIN users u ON u.id = s.opened_by
      WHERE s.branch_id = $1
        AND s.tenant_id = $2
        AND s.opened_at BETWEEN $3 AND $4
      ORDER BY s.opened_at DESC
    `, [branchId, tenantId, start, end]);
  }

  // ── Waiter Report ──────────────────────────────────────────────────────────

  async getWaiterReport(branchId: string, tenantId: string, from: string, to: string) {
    this.assertDate(from, 'from');
    this.assertDate(to, 'to');
    const { start, end } = this.toDateRange(from, to);

    return this.db.query(`
      SELECT
        CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))      AS waiter_name,
        u.id                                                        AS waiter_id,
        u.employee_code,
        COUNT(DISTINCT o.id)::int                                  AS total_orders,
        COALESCE(SUM(o.grand_total), 0)                            AS total_revenue,
        COALESCE(
          SUM(o.grand_total) / NULLIF(COUNT(DISTINCT o.id), 0), 0
        )                                                           AS avg_order_value,
        COUNT(DISTINCT o.id) FILTER (WHERE o.type = 'dine_in')::int
                                                                    AS dine_in_orders,
        COUNT(DISTINCT o.id) FILTER (WHERE o.type = 'takeaway')::int
                                                                    AS takeaway_orders,
        COUNT(DISTINCT o.table_id)                                  AS tables_served,
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (o.billed_at - o.placed_at)) / 60
        ) FILTER (WHERE o.billed_at IS NOT NULL AND o.placed_at IS NOT NULL), 0)
                                                                    AS avg_turnaround_min
      FROM orders o
      JOIN users u ON u.id = o.waiter_id
      WHERE o.branch_id  = $1
        AND o.tenant_id  = $2
        AND o.status     = 'billed'
        AND o.created_at BETWEEN $3 AND $4
      GROUP BY u.id, u.first_name, u.last_name, u.employee_code
      ORDER BY total_revenue DESC
    `, [branchId, tenantId, start, end]);
  }

  // ── Dashboard Summary ──────────────────────────────────────────────────────

  async getDashboardSummary(branchId: string, tenantId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const { start: dayStart,  end: dayEnd  } = this.toDateRange(today, today);
    const { start: weekStart, end: weekEnd } = this.toDateRange(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      today,
    );

    const [
      todaySales, weekSales, pendingOrders,
      stockAlerts, orderStats, revLeakage, tableStats,
    ] = await Promise.all([

      this.db.query(`
        SELECT
          COALESCE(SUM(grand_total), 0) AS today_sales,
          COUNT(*)::int                 AS today_bills
        FROM bills
        WHERE branch_id = $1 AND tenant_id = $2
          AND status NOT IN ('void', 'refunded')
          AND created_at BETWEEN $3 AND $4
      `, [branchId, tenantId, dayStart, dayEnd]),

      this.db.query(`
        SELECT COALESCE(SUM(grand_total), 0) AS week_sales
        FROM bills
        WHERE branch_id = $1 AND tenant_id = $2
          AND status NOT IN ('void', 'refunded')
          AND created_at BETWEEN $3 AND $4
      `, [branchId, tenantId, weekStart, weekEnd]),

      this.db.query(`
        SELECT COUNT(*)::int AS pending
        FROM orders
        WHERE branch_id = $1 AND tenant_id = $2
          AND status NOT IN ('billed', 'cancelled')
      `, [branchId, tenantId]),

      this.db.query(`
        SELECT COUNT(*)::int AS low_stock
        FROM inventory_items
        WHERE (branch_id = $1 OR branch_id IS NULL)
          AND tenant_id = $2
          AND current_stock <= min_stock_level
          AND is_active = true
      `, [branchId, tenantId]),

      this.db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'billed' AND NOT is_complimentary)::int AS successful,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int                       AS cancelled,
          COUNT(*) FILTER (WHERE is_complimentary = true)::int                   AS complimentary,
          COUNT(*) FILTER (WHERE is_sales_return  = true)::int                   AS returns
        FROM orders
        WHERE branch_id = $1 AND tenant_id = $2
          AND created_at BETWEEN $3 AND $4
      `, [branchId, tenantId, dayStart, dayEnd]),

      this.db.query(`
        SELECT
          (SELECT COUNT(*)::int
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE o.branch_id = $1 AND o.tenant_id = $2
             AND oi.is_voided = true
             AND oi.created_at BETWEEN $3 AND $4
          ) AS voided_items,
          (SELECT COUNT(*)::int
           FROM orders
           WHERE branch_id = $1 AND tenant_id = $2
             AND status = 'cancelled'
             AND grand_total > 0
             AND created_at BETWEEN $3 AND $4
          ) AS cancelled_with_value
      `, [branchId, tenantId, dayStart, dayEnd]),

      this.db.query(`
        SELECT COALESCE(AVG(
          EXTRACT(EPOCH FROM (billed_at - placed_at)) / 60
        ), 0) AS avg_turnaround_minutes
        FROM orders
        WHERE branch_id = $1 AND tenant_id = $2
          AND type = 'dine_in'
          AND placed_at IS NOT NULL
          AND billed_at IS NOT NULL
          AND billed_at BETWEEN $3 AND $4
      `, [branchId, tenantId, dayStart, dayEnd]),
    ]);

    return {
      todaySales:     Number(todaySales[0]?.today_sales  || 0),
      todayBills:     Number(todaySales[0]?.today_bills  || 0),
      weekSales:      Number(weekSales[0]?.week_sales    || 0),
      pendingOrders:  Number(pendingOrders[0]?.pending   || 0),
      lowStockAlerts: Number(stockAlerts[0]?.low_stock   || 0),
      orderStats: {
        successful:    Number(orderStats[0]?.successful    || 0),
        cancelled:     Number(orderStats[0]?.cancelled     || 0),
        complimentary: Number(orderStats[0]?.complimentary || 0),
        returns:       Number(orderStats[0]?.returns       || 0),
      },
      revenueLeakage: {
        voidedItems:        Number(revLeakage[0]?.voided_items         || 0),
        cancelledWithValue: Number(revLeakage[0]?.cancelled_with_value || 0),
      },
      tableStats: {
        avgTurnaroundMinutes: Math.round(
          Number(tableStats[0]?.avg_turnaround_minutes || 0),
        ),
      },
    };
  }

  // ── Hotel Dashboard Summary ────────────────────────────────────────────────

  async getHotelDashboardSummary(branchId: string, tenantId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const [
      todaySales, weekSales, todayCheckins,
      todayCheckouts, roomsData, weeklyChart,
    ] = await Promise.all([

      this.db.query(`
        SELECT COALESCE(SUM(grand_total), 0) AS revenue, COUNT(*)::int AS count
        FROM bills
        WHERE branch_id = $1 AND tenant_id = $2
          AND source = 'hotel'
          AND status NOT IN ('void', 'refunded')
          AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') = $3
      `, [branchId, tenantId, today]),

      this.db.query(`
        SELECT COALESCE(SUM(grand_total), 0) AS revenue
        FROM bills
        WHERE branch_id = $1 AND tenant_id = $2
          AND source = 'hotel'
          AND status NOT IN ('void', 'refunded')
          AND created_at >= NOW() - INTERVAL '7 days'
      `, [branchId, tenantId]),

      this.db.query(`
        SELECT COUNT(*)::int AS count
        FROM hotel_reservations
        WHERE branch_id = $1 AND tenant_id = $2
          AND check_in_date = $3
          AND status NOT IN ('cancelled', 'no_show')
      `, [branchId, tenantId, today]),

      this.db.query(`
        SELECT COUNT(*)::int AS count
        FROM hotel_reservations
        WHERE branch_id = $1 AND tenant_id = $2
          AND check_out_date = $3
          AND status NOT IN ('cancelled', 'no_show')
      `, [branchId, tenantId, today]),

      this.db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM hotel_rooms
           WHERE branch_id = $1 AND tenant_id = $2
             AND status != 'out_of_order'
          ) AS total_rooms,
          (SELECT COUNT(*)::int FROM hotel_reservations
           WHERE branch_id = $1 AND tenant_id = $2
             AND status IN ('checked_in')
          ) AS occupied_rooms
      `, [branchId, tenantId]),

      this.db.query(`
        SELECT
          TO_CHAR(date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata'), 'Mon DD') AS date,
          COALESCE(SUM(grand_total), 0) AS revenue
        FROM bills
        WHERE branch_id = $1 AND tenant_id = $2
          AND source = 'hotel'
          AND status NOT IN ('void', 'refunded')
          AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata')
        ORDER BY date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata') ASC
      `, [branchId, tenantId]),
    ]);

    const totalRooms    = Number(roomsData[0]?.total_rooms    || 0);
    const occupiedRooms = Number(roomsData[0]?.occupied_rooms || 0);
    const occupancyRate = totalRooms > 0
      ? Math.round((occupiedRooms / totalRooms) * 100)
      : 0;

    const todayRev = Number(todaySales[0]?.revenue || 0);
    const adr      = occupiedRooms > 0 ? todayRev / occupiedRooms : 0;

    return {
      todaySales:     todayRev,
      todayBills:     Number(todaySales[0]?.count    || 0),
      weekSales:      Number(weekSales[0]?.revenue   || 0),
      todayCheckins:  Number(todayCheckins[0]?.count  || 0),
      todayCheckouts: Number(todayCheckouts[0]?.count || 0),
      occupancyRate,
      adr: Math.round(adr),
      weeklyChart: weeklyChart.map((r: any) => ({
        date:    r.date,
        revenue: Number(r.revenue || 0),
      })),
    };
  }
}