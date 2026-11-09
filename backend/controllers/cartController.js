import userModel from './../models/userModel.js';

// add items to user cart
const addToCart = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Not Authorized. Login Again." });
        }

        const userData = await userModel.findById(userId);
        if (!userData) {
            return res.status(404).json({ success: false, message: "User not found. Please login again." });
        }

        const cartData = userData.cartData;
        if (!cartData[req.body.itemId]) {
            cartData[req.body.itemId] = 1;
        } else {
            cartData[req.body.itemId] += 1;
        }

        await userModel.findByIdAndUpdate(userId, { cartData });
        res.json({ success: true, message: 'Added to cart' });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message || 'Error' });
    }
}

// remove items from user cart
const removeFromCart = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Not Authorized. Login Again." });
        }

        const userData = await userModel.findById(userId);
        if (!userData) {
            return res.status(404).json({ success: false, message: "User not found. Please login again." });
        }

        const cartData = userData.cartData;
        if (cartData[req.body.itemId] > 0) {
            cartData[req.body.itemId] -= 1;
        }

        await userModel.findByIdAndUpdate(userId, { cartData });
        res.json({ success: true, message: 'Removed from cart' });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message || 'Error' });
    }
}

// fetch user cart data
const getCart = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Not Authorized. Login Again." });
        }

        const userData = await userModel.findById(userId);
        if (!userData) {
            return res.status(404).json({ success: false, message: "User not found. Please login again." });
        }

        res.json({ success: true, cartData: userData.cartData });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message || 'Error' });
    }
}

export { addToCart, removeFromCart, getCart }
