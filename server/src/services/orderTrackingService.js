import Order from '../models/Order.js';
import User from '../models/User.js';
import codService from './codService.js';

/**
 * Order tracking service for managing order status updates,
 * notifications, and order lifecycle management
 */
class OrderTrackingService {
  /**
   * Update order status with automatic notifications
   * @param {string} orderId - Order ID
   * @param {string} newStatus - New order status
   * @param {Object} updateData - Additional update data
   * @returns {Promise<Object>} Updated order
   */
  async updateOrderStatus(orderId, newStatus, updateData = {}) {
    try {
      const order = await Order.findById(orderId).populate('userId', 'name email');

      if (!order) {
        throw new Error('Order not found');
      }

      // Validate status transition
      if (!this.isValidStatusTransition(order.status, newStatus)) {
        throw new Error(`Invalid status transition from ${order.status} to ${newStatus}`);
      }

      // Update order status using the model method
      await order.updateStatus(newStatus, updateData.note || `Status updated to ${newStatus}`);

      // Update additional fields based on status
      if (newStatus === 'shipped' && updateData.trackingNumber) {
        order.trackingNumber = updateData.trackingNumber;
        order.courierService = updateData.courierService || order.courierService;
        order.shippedAt = new Date();
      }

      if (newStatus === 'delivered') {
        order.deliveredAt = new Date();
      }

      if (newStatus === 'cancelled') {
        order.cancelledAt = new Date();
        order.cancelReason = updateData.reason || 'Order cancelled';
      }

      await order.save();

      // Send notification to user
      await this.sendOrderNotification(order, newStatus, updateData);

      return order;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  /**
   * Validate if status transition is allowed
   * @param {string} currentStatus - Current order status
   * @param {string} newStatus - Proposed new status
   * @returns {boolean} Is transition valid
   */
  isValidStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      'placed': ['confirmed', 'cancelled'],
      'confirmed': ['processing', 'cancelled'],
      'processing': ['packed', 'cancelled'],
      'packed': ['shipped', 'cancelled'],
      'shipped': ['out_for_delivery', 'delivered', 'returned'],
      'out_for_delivery': ['delivered', 'returned'],
      'delivered': ['returned'],
      'cancelled': [], // Final status
      'returned': ['refunded'],
      'refunded': [] // Final status
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Get order tracking information
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Order tracking data
   */
  async getOrderTracking(orderId) {
    try {
      const order = await Order.findById(orderId)
        .populate('items.productId', 'name images')
        .populate('userId', 'name email')
        .select('orderNumber status paymentStatus trackingNumber courierService shippedAt deliveredAt statusHistory estimatedDelivery');

      if (!order) {
        throw new Error('Order not found');
      }

      // Calculate delivery progress
      const progress = this.calculateDeliveryProgress(order.status);

      return {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        trackingNumber: order.trackingNumber,
        courierService: order.courierService,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        estimatedDelivery: order.estimatedDelivery,
        progress: progress,
        statusHistory: order.statusHistory.map(history => ({
          status: history.status,
          timestamp: history.timestamp,
          note: history.note,
          description: this.getStatusDescription(history.status)
        }))
      };
    } catch (error) {
      console.error('Error getting order tracking:', error);
      throw error;
    }
  }

  /**
   * Calculate delivery progress percentage
   * @param {string} status - Current order status
   * @returns {number} Progress percentage (0-100)
   */
  calculateDeliveryProgress(status) {
    const statusProgress = {
      'placed': 10,
      'confirmed': 25,
      'processing': 40,
      'packed': 55,
      'shipped': 70,
      'out_for_delivery': 85,
      'delivered': 100,
      'cancelled': 0,
      'returned': 0,
      'refunded': 0
    };

    return statusProgress[status] || 0;
  }

  /**
   * Get user-friendly status description
   * @param {string} status - Order status
   * @returns {string} Status description
   */
  getStatusDescription(status) {
    const descriptions = {
      'placed': 'Your order has been placed successfully',
      'confirmed': 'Your order has been confirmed and is being prepared',
      'processing': 'Your order is being processed by our team',
      'packed': 'Your order has been carefully packed and is ready to ship',
      'shipped': 'Your order is on its way to you',
      'out_for_delivery': 'Your order is out for delivery',
      'delivered': 'Your order has been delivered successfully',
      'cancelled': 'Your order has been cancelled',
      'returned': 'Your order has been returned',
      'refunded': 'Your refund has been processed'
    };

    return descriptions[status] || status;
  }

  /**
   * Send order notification to user
   * @param {Object} order - Order object
   * @param {string} status - New status
   * @param {Object} updateData - Additional update data
   */
  async sendOrderNotification(order, status, updateData = {}) {
    try {
      // In a real application, this would send email/SMS notifications
      // For now, we'll just log the notification
      console.log(`Order Notification:`, {
        userId: order.userId._id,
        userEmail: order.userId.email,
        userName: order.userId.name,
        orderNumber: order.orderNumber,
        status: status,
        message: this.getStatusDescription(status),
        trackingNumber: updateData.trackingNumber,
        courierService: updateData.courierService
      });

      // TODO: Implement actual email/SMS notification service
      // await emailService.sendOrderStatusUpdate(order, status, updateData);
      // await smsService.sendOrderStatusUpdate(order, status, updateData);

    } catch (error) {
      console.error('Error sending order notification:', error);
      // Don't throw error as notification failure shouldn't fail the order update
    }
  }

  /**
   * Get orders by status for admin dashboard
   * @param {string} status - Order status filter
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Orders array
   */
  async getOrdersByStatus(status, options = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const skip = (page - 1) * limit;

      const query = status ? { status } : {};
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const orders = await Order.find(query)
        .populate('userId', 'name email')
        .populate('items.productId', 'name')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select('orderNumber status paymentStatus total createdAt trackingNumber courierService');

      const total = await Order.countDocuments(query);

      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting orders by status:', error);
      throw error;
    }
  }

  /**
   * Auto-cancel orders that are unpaid for too long
   * @param {number} hoursThreshold - Hours after which to cancel unpaid orders
   * @returns {Promise<number>} Number of cancelled orders
   */
  async autoCancelUnpaidOrders(hoursThreshold = 24) {
    try {
      const cutoffTime = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);

      const unpaidOrders = await Order.find({
        status: 'placed',
        paymentStatus: 'pending',
        createdAt: { $lt: cutoffTime }
      });

      let cancelledCount = 0;

      for (const order of unpaidOrders) {
        await this.updateOrderStatus(order._id, 'cancelled', {
          reason: `Auto-cancelled after ${hoursThreshold} hours of non-payment`
        });
        cancelledCount++;
      }

      return cancelledCount;
    } catch (error) {
      console.error('Error auto-cancelling unpaid orders:', error);
      throw error;
    }
  }

  /**
   * Get order analytics for dashboard
   * @param {Object} dateRange - Date range filter
   * @returns {Promise<Object>} Order analytics
   */
  async getOrderAnalytics(dateRange = {}) {
    try {
      const { startDate, endDate } = dateRange;
      const matchQuery = {};

      if (startDate && endDate) {
        matchQuery.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const analytics = await Order.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: '$total' },
            averageOrderValue: { $avg: '$total' },
            statusBreakdown: {
              $push: '$status'
            },
            paymentStatusBreakdown: {
              $push: '$paymentStatus'
            }
          }
        },
        {
          $project: {
            totalOrders: 1,
            totalRevenue: 1,
            averageOrderValue: { $round: ['$averageOrderValue', 2] },
            statusBreakdown: 1,
            paymentStatusBreakdown: 1
          }
        }
      ]);

      const result = analytics[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        statusBreakdown: [],
        paymentStatusBreakdown: []
      };

      // Count status occurrences
      result.statusCounts = result.statusBreakdown.reduce((acc, status) => {
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      result.paymentStatusCounts = result.paymentStatusBreakdown.reduce((acc, status) => {
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      delete result.statusBreakdown;
      delete result.paymentStatusBreakdown;

      return result;
    } catch (error) {
      console.error('Error getting order analytics:', error);
      throw error;
    }
  }
  /**
   * Update COD order status with COD-specific lifecycle validation.
   * Handles cash collection on delivery and risk re-assessment on return.
   *
   * @param {string} orderId - Order ID
   * @param {string} newStatus - New status
   * @param {Object} updateData - Additional update data (note, trackingNumber, etc.)
   * @returns {Promise<Object>} Updated order
   */
  async updateCodOrderStatus(orderId, newStatus, updateData = {}) {
    try {
      const order = await Order.findOne({ _id: orderId, paymentMethod: 'cod' })
        .populate('userId', 'name email');

      if (!order) {
        throw new Error('COD order not found');
      }

      // Use COD-specific transition validation
      if (!codService.isValidCodStatusTransition(order.status, newStatus)) {
        throw new Error(`Invalid COD status transition from '${order.status}' to '${newStatus}'`);
      }

      // Apply status
      order.status = newStatus;
      order.statusHistory.push({
        status: newStatus,
        timestamp: new Date(),
        note: updateData.note || `COD order status updated to ${newStatus}`
      });

      if (newStatus === 'shipped' && updateData.trackingNumber) {
        order.trackingNumber = updateData.trackingNumber;
        order.courierService = updateData.courierService || order.courierService;
        order.shippedAt = new Date();
      }

      if (newStatus === 'delivered') {
        order.deliveredAt = new Date();
        order.actualDelivery = new Date();
        order.codCollectedAt = new Date();  // Cash collected at doorstep
        order.paymentStatus = 'paid';       // COD payment fulfilled
        order.paidAt = new Date();
      }

      if (newStatus === 'cancelled') {
        order.cancelledAt = new Date();
        order.cancellationReason = updateData.reason || 'Order cancelled';
      }

      if (newStatus === 'returned') {
        // Re-assess risk after return event
        const risk = await codService.handleReturnRiskUpdate(
          order.userId._id.toString(),
          order._id.toString()
        );
        order.codRiskFlags = {
          ...order.codRiskFlags,
          isFlagged: risk.isFlagged,
          isHighRisk: risk.isHighRisk,
          flagReason: risk.flagReason,
          returnCount: risk.returnCount,
          ...(risk.isFlagged ? { flaggedAt: new Date() } : {})
        };
      }

      await order.save();

      // Send notification
      await this.sendOrderNotification(order, newStatus, updateData);

      return order;
    } catch (error) {
      console.error('Error updating COD order status:', error);
      throw error;
    }
  }
}

export default new OrderTrackingService();
