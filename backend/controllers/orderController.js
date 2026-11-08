// import orderModel from './../models/orderModel.js';
// import userModel from './../models/userModel.js';
// import Stripe from "stripe"

// const stripe =  new Stripe(process.env.STRIPE_SECRET_KEY)

// // Placing user order for frontend
// const placeOrder = async (req, res) =>{

//     const frontend_url = 'http://localhost:5173';
//     try {
//         const newOrder = new orderModel({
//             userId: req.body.userId,
//             items: req.body.items,
//             amount:req.body.amount,
//             address: req.body.address
//         })

//         await newOrder.save();
//         await userModel.findByIdAndUpdate(req.body.userId,{cartData:{}});

//         const line_items = req.body.items.map((item)=>({
//             price_data :{
//                 currency: "lkr",
//                 product_data:{
//                     name: item.name
//                 },
//                 unit_amount:item.price*100*300
//             },
//             quantity: item.quantity
//         }))

//         line_items.push({
//             price_data :{
//                 currency:"lkr",
//                 product_data:{
//                     name:"Delivery Charges"
//                 },
//                 unit_amount:2*100*80
//             },
//             quantity:1
//         })

//         const session = await stripe.checkout.sessions.create({
//             line_items:line_items,
//             mode:'payment',
//             success_url:`${frontend_url}/verify?success=true&orderId=${newOrder._id}`,
//             cancel_url:`${frontend_url}/verify?success=false&orderId=${newOrder._id}`
//         })

//         res.json({success:true, session_url:session.url})
//     } catch (error) {
//         console.log(error)
//         res.json({success:false, message:"Error"})
//     }
// }

// const verifyOrder = async (req, res) =>{
//     const {orderId, success} = req.body;
//     try {
//         if(success=='true'){
//             await orderModel.findByIdAndUpdate(orderId,{payment:true});
//             res.json({success:true, message:"Paid"})
//         }else{
//             await orderModel.findByIdAndDelete(orderId);
//             res.json({success:false, message:"Not Paid"})
//         }
//     } catch (error) {
//         console.log(error)
//         res.json({success:false, message:"Error"})
//     }
// }

// // user orders for frontend
// const userOrders = async (req,res) => {
//     try {
//         const orders = await orderModel.find({userId:req.body.userId})
//         res.json({success:true, data:orders})
//     } catch (error) {
//         console.log(error)
//         res.json({success:false, message:"Error"})
//     }
// }

// // listing orders for admin panel
// const listOrders = async (req,res) =>{
//    try {
//     const orders = await orderModel.find({});
//     res.json({success:true, data:orders})
//    } catch (error) {
//         console.log(error)
//         res.json({success:false, message:"Error"})  
//    } 
// }

// // api for updating order status
// const updateStatus = async (req, res) =>{
//     try {
//         await orderModel.findByIdAndUpdate(req.body.orderId,{status:req.body.status})
//         res.json({success:true, message:"Status Updated"})
//     } catch (error) {
//         console.log(error)
//         res.json({success:false, message:"Error"})  
//     }
// }

// export {placeOrder, verifyOrder, userOrders,listOrders, updateStatus}





import orderModel from './../models/orderModel.js';
import userModel from './../models/userModel.js';
// import Stripe from "stripe"
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();


// const stripe =  new Stripe(process.env.STRIPE_SECRET_KEY)

// Placing user order for frontend

const razorpay = new Razorpay({
    key_id:process.env.RAZORPAY_KEY_ID,
    key_secret:process.env.RAZORPAY_KEY_SECRET,
});



const placeOrder = async (req, res) => {
    try {
        const newOrder = new orderModel({
            userId: req.body.userId,
            items: req.body.items,
            amount: req.body.amount,
            address: req.body.address
        });

        await newOrder.save();
        await userModel.findByIdAndUpdate(req.body.userId, { cartData: {} });

        // Create a Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount: req.body.amount * 100, // Razorpay works with smallest currency units (e.g., paise)
            currency: "INR",
            receipt: `order_rcptid_${newOrder._id}`,
        });

        res.json({
            success: true,
            order_id: razorpayOrder.id,
            amount: req.body.amount,
        });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: "Error creating order" });
    }
};



// const verifyOrder = async (req, res) =>{
//     const {orderId, success} = req.body;
//     try {
//         if(success=='true'){
//             await orderModel.findByIdAndUpdate(orderId,{payment:true});
//             res.json({success:true, message:"Paid"})
//         }else{
//             await orderModel.findByIdAndDelete(orderId);
//             res.json({success:false, message:"Not Paid"})
//         }
//     } catch (error) {
//         console.log(error)
//         res.json({success:false, message:"Error"})
//     }
// }


const verifyOrder = async (req, res) => {
    const { payment_id, order_id, signature } = req.body;
  
    try {
      console.log("Received order_id:", order_id);
      console.log("Received payment_id:", payment_id);
      console.log("Received signature:", signature);
  
      // Razorpay secret key
      const secret =process.env.RAZORPAY_KEY_SECRET; 
  
      // Generate signature to compare
      const generated_signature = crypto
        .createHmac('sha256', secret)
        .update(order_id + "|" + payment_id)
        .digest('hex');
  
      console.log("Generated signature:", generated_signature);
  
      // Verify the signature
      if (generated_signature === signature) {
        // Signature matches, so update the order status
        const order = await orderModel.findById(order_id);
        if (!order) {
          return res.status(404).json({ success: false, message: 'Order not found' });
        }
  
        // If payment is successful, mark the order as paid
        if (req.body.success === 'true') {
          await orderModel.findByIdAndUpdate(order_id, { payment: true });
          res.json({ success: true, message: 'Paid' });
        } else {
          // Payment failed, remove the order
          await orderModel.findByIdAndDelete(order_id);
          res.json({ success: false, message: 'Payment failed' });
        }
      } else {
        // Signature mismatch
        res.json({ success: false, message: 'Signature mismatch' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  };



// user orders for frontend
const userOrders = async (req,res) => {
    try {
        const orders = await orderModel.find({userId:req.body.userId})
        res.json({success:true, data:orders})
    } catch (error) {
        console.log(error)
        res.json({success:false, message:"Error"})
    }
}

// listing orders for admin panel
const listOrders = async (req,res) =>{
   try {
    const orders = await orderModel.find({});
    res.json({success:true, data:orders})
   } catch (error) {
        console.log(error)
        res.json({success:false, message:"Error"})  
   } 
}

// api for updating order status
const updateStatus = async (req, res) =>{
    try {
        await orderModel.findByIdAndUpdate(req.body.orderId,{status:req.body.status})
        res.json({success:true, message:"Status Updated"})
    } catch (error) {
        console.log(error)
        res.json({success:false, message:"Error"})  
    }
}

export {placeOrder, verifyOrder, userOrders,listOrders, updateStatus}