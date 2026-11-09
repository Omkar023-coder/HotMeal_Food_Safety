import express from "express";

import authMiddleware from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

import {
    placeOrder,
    verifyOrder,
    userOrders,
    listOrders,
    updateStatus
} from "../controllers/orderController.js";

const orderRouter = express.Router();

// Customer — Login required
orderRouter.post(
    "/place",
    authMiddleware,
    placeOrder
);

// Payment verification
orderRouter.post(
    "/verify",
    verifyOrder
);

// Customer — Login required
orderRouter.post(
    "/userorders",
    authMiddleware,
    userOrders
);

// Admin — View all orders
orderRouter.get(
    "/list",
    authMiddleware,
    adminAuth,
    listOrders
);

// Admin — Update order status
orderRouter.post(
    "/status",
    authMiddleware,
    adminAuth,
    updateStatus
);

export default orderRouter;