import express from 'express'
import cors from 'cors'
import connectDB from './config/db.js'
import foodRouter from './routes/foodRoute.js'
import userRouter from './routes/userRoute.js';
import cartRouter from './routes/cartRoute.js';
import orderRouter from './routes/orderRoute.js';
import restaurantRouter from './routes/restaurantRoute.js';
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
app.use("/api/restaurant", restaurantRouter)
app.use("/images",express.static('uploads'))
app.use('/api/user', userRouter)
app.use('/api/cart', cartRouter)
app.use('/api/order', orderRouter)


app.get("/",(req,res)=>{
        res.send("API working")
})

app.listen(port,()=>{
    console.log(`Server started on http://localhost:${port}`)
})

//mongodb+srv://dulanjalisenarathna93:E2JUb0zfaT2FVp8D@cluster0.exkxkun.mongodb.net/?