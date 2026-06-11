import {
  WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody,
  ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({ cors: { origin: process.env.NEXT_PUBLIC_APP_URL || '*' }, namespace: '/orders' })
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(OrdersGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.warn(`[WS] No token — disconnecting ${client.id}`);
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.config.get('JWT_SECRET'),
      });
      (client as any).jwtPayload = payload;
      this.logger.log(`[WS] Connected: ${client.id} tenant=${payload.tenantId}`);
    } catch {
      this.logger.warn(`[WS] Invalid token — disconnecting ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[WS] Disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:branch')
  handleJoinBranch(
    @MessageBody() data: { branchId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = (client as any).jwtPayload;
    if (!user) { client.disconnect(true); return; }
    client.join(`branch:${data.branchId}`);
    this.logger.log(`[WS] ${client.id} (tenant=${user.tenantId}) joined branch:${data.branchId}`);
    return { event: 'joined', data: { room: `branch:${data.branchId}` } };
  }

  @SubscribeMessage('join:kds')
  handleJoinKds(
    @MessageBody() data: { branchId: string; displayId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = (client as any).jwtPayload;
    if (!user) { client.disconnect(true); return; }
    client.join(`kds:${data.branchId}:${data.displayId}`);
    return { event: 'joined:kds', data };
  }

  /* ── Order events ──────────────────────────────────────────────────────── */

  @OnEvent('order.created')
  notifyOrderCreated(order: any) {
    this.server.to(`branch:${order.branchId}`).emit('order:created', order);
    this.server.to(`branch:${order.branchId}`).emit('kds:newItems', {
      orderId:     order.id,
      orderNumber: order.orderNumber,
      items:       order.items,
      tableId:     order.tableId,
    });
  }

  @OnEvent('order.statusChanged')
  notifyStatusChange(payload: any) {
    this.server.to(`branch:${payload.branchId}`).emit('order:statusChanged', payload);
  }

  @OnEvent('order.itemsAdded')
  notifyItemsAdded(payload: any) {
    this.server.to(`branch:${payload.branchId}`).emit('order:itemsAdded', payload);
    this.server.to(`branch:${payload.branchId}`).emit('kds:newItems', payload);
  }

  /* ── KDS events ────────────────────────────────────────────────────────── */

  @OnEvent('kds.itemStatus')
  notifyKdsStatus(payload: any) {
    this.server.to(`branch:${payload.branchId}`).emit('kds:itemStatusChanged', payload);
  }

  @OnEvent('kds.orderReady')
  notifyOrderReady(payload: any) {
    this.server.to(`branch:${payload.branchId}`).emit('order:statusChanged', {
      orderId:     payload.orderId,
      orderNumber: payload.orderNumber,
      status:      'ready',
      branchId:    payload.branchId,
    });
  }

  /**
   * Fired when waiter clicks "Picked Up & Served" — bumps ALL items in order.
   * Tells POS cart to mark everything as completed (served).
   */
  @OnEvent('kds.orderBumped')
  notifyOrderBumped(payload: any) {
    this.server.to(`branch:${payload.branchId}`).emit('kds:orderBumped', {
      orderId:     payload.orderId,
      bumpedCount: payload.bumpedCount,
      branchId:    payload.branchId,
    });
    // Also fire statusChanged so waiter dashboard and open orders list update
    this.server.to(`branch:${payload.branchId}`).emit('order:statusChanged', {
      orderId:  payload.orderId,
      status:   'served',
      branchId: payload.branchId,
    });
  }
}