import orderModel from './../models/orderModel.js';
import userModel from './../models/userModel.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const razorpay = new Razorpay({
    key_id:    process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─── Place Order (customer) ────────────────────────────────────────────────────
const placeOrder = async (req, res) => {
    try {
        // userId comes from authMiddleware — never trust req.body for this
        const userId = req.userId;
        if (!userId) {
            return res.json({ success: false, message: "Not authorized" });
        }
        console.log(`[placeOrder] request received — userId: ${userId}`);

        const { items, amount, address } = req.body;

        if (!items || !items.length) {
            return res.json({ success: false, message: "No items in order" });
        }
        if (!amount || amount <= 0) {
            return res.json({ success: false, message: "Invalid order amount" });
        }
        if (!address) {
            return res.json({ success: false, message: "Delivery address is required" });
        }

        // 1. Save order to MongoDB (payment false until verified)
        const newOrder = new orderModel({
            userId,
            items,
            amount,
            address
        });
        await newOrder.save();
        console.log(`[placeOrder] MongoDB order created: ${newOrder._id}`);

        // 2. Clear the user's cart
        await userModel.findByIdAndUpdate(userId, { cartData: {} });

        // 3. Create Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount:   amount * 100,   // paise
            currency: "INR",
            receipt:  `rcpt_${newOrder._id}`,
        });
        console.log(`[placeOrder] Razorpay order created: ${razorpayOrder.id}`);

        // 4. Store the Razorpay order ID on the MongoDB order so verifyOrder can find it
        await orderModel.findByIdAndUpdate(
            newOrder._id,
            { razorpayOrderId: razorpayOrder.id }
        );

        res.json({
            success:  true,
            order_id: razorpayOrder.id,
            amount,
        });

    } catch (error) {
        console.error("placeOrder error:", error);
        res.json({ success: false, message: error.message || "Error creating order" });
    }
};

// ─── Verify Razorpay Payment ───────────────────────────────────────────────────
const verifyOrder = async (req, res) => {
    const { payment_id, order_id, signature } = req.body;

    try {
        console.log(`[verifyOrder] request received — order_id: ${order_id}`);
        console.log(`[verifyOrder] payment_id: ${payment_id}`);

        // 1. Verify HMAC signature using the secret (never expose key_secret to frontend)
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(order_id + "|" + payment_id)
            .digest('hex');

        console.log("verifyOrder — generated:", generated_signature);
        console.log("verifyOrder — received: ", signature);

        if (generated_signature !== signature) {
            console.log(`[verifyOrder] signature MISMATCH`);
            return res.json({ success: false, message: "Signature mismatch" });
        }
        console.log(`[verifyOrder] signature VERIFIED`);

        // 2. Find the MongoDB order by the Razorpay order ID (NOT by MongoDB _id)
        const order = await orderModel.findOne({ razorpayOrderId: order_id });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // 3. Signature matched — mark paid
        if (req.body.success === 'true') {
            await orderModel.findByIdAndUpdate(order._id, { payment: true });
            return res.json({ success: true, message: "Paid" });
        }

        // 4. Signature matched but payment was cancelled/failed — delete the order
        await orderModel.findByIdAndDelete(order._id);
        return res.json({ success: false, message: "Payment failed" });

    } catch (error) {
        console.error("verifyOrder error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

// ─── User Orders (customer) ────────────────────────────────────────────────────
const userOrders = async (req, res) => {
    try {
        // userId comes from authMiddleware — never trust req.body for this
        const orders = await orderModel.find({ userId: req.userId });
        res.json({ success: true, data: orders });
    } catch (error) {
        console.error("userOrders error:", error);
        res.json({ success: false, message: error.message || "Error" });
    }
};

// ─── List All Orders (admin) ───────────────────────────────────────────────────
const listOrders = async (req, res) => {
    try {
        const orders = await orderModel.find({});
        res.json({ success: true, data: orders });
    } catch (error) {
        console.error("listOrders error:", error);
        res.json({ success: false, message: error.message || "Error" });
    }
};

// ─── Update Order Status (admin) ──────────────────────────────────────────────
const updateStatus = async (req, res) => {
    try {
        await orderModel.findByIdAndUpdate(
            req.body.orderId,
            { status: req.body.status }
        );
        res.json({ success: true, message: "Status Updated" });
    } catch (error) {
        console.error("updateStatus error:", error);
        res.json({ success: false, message: error.message || "Error" });
    }
};

export { placeOrder, verifyOrder, userOrders, listOrders, updateStatus };
