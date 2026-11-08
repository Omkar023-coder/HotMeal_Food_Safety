import express from 'express'
import cors from 'cors'
import { connectDB } from './config/db.js'
import foodRouter from './routes/foodRoute.js'
import userRouter from './routes/userRoute.js';
import cartRouter from './routes/cartRoute.js';
import orderRouter from './routes/orderRoute.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();


// const Razorpay = require('razorpay');  /** */
// const crypto = require('crypto');    /** */

//app config
const app = express()
const port = process.env.PORT || 4000

// middleware
app.use(express.json())
app.use(cors())

//db connection
connectDB();

// api endpoints
app.use("/api/food",foodRouter)
app.use("/images",express.static('uploads'))
app.use('/api/user', userRouter)
app.use('/api/cart', cartRouter)
app.use('/api/order', orderRouter)


const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret:process.env.RAZORPAY_KEY_SECRET
  });



  app.post('/api/order/place', async (req, res) => {
     // Get amount from frontend
    // console.log("amount in backend",amount);
    const {amount } = req.body;
    // console.log("Full request body in backend:", req.body);
   
    // console.log("Received amount:", amount);

    try {
      const order = await razorpay.orders.create({
        amount: amount * 100, // amount in paise
        currency: 'INR',
        receipt: 'order_receipt_123',
        payment_capture: 1
      });
     

      res.json({ success: true, order_id: order.id, amount });
    } catch (error) {
      res.json({ success: false, error: error.message });
    }
  });



  // Verify Payment API
app.post('/api/order/verify', (req, res) => {   //verifyPayment
  console.log('Received a POST request');
    const { payment_id, order_id, signature } = req.body;

    console.log("Received order_id:", order_id);
    console.log("Received payment_id:", payment_id);
    console.log("Received Signature:", signature);


    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(order_id + "|" + payment_id)
      .digest('hex');


   console.log("generated and signature after chekcking:");
   console.log(generated_signature);
   console.log(signature);



    if (generated_signature === signature) {
      // Payment is successful
      res.json({ success: true });
    } else {
      // Payment failed
      res.json({ success: false, message: 'Signature mismatch' });
    }
  });


  

app.get("/",(req,res)=>{
        res.send("API working")
})

app.listen(port,()=>{
    console.log(`Server started on http://localhost:${port}`)
})

//mongodb+srv://dulanjalisenarathna93:E2JUb0zfaT2FVp8D@cluster0.exkxkun.mongodb.net/?