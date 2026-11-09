import fs from 'fs'
import foodModel from '../models/foodModel.js'
import restaurantModel from '../models/restaurantModel.js'

// Add food item
const addFood = async (req, res) => {
    const { name, description, price, category, restaurantId } = req.body;

    // Validate restaurant exists before saving
    if (!restaurantId) {
        return res.json({ success: false, message: "Please select a restaurant." });
    }

    const restaurantExists = await restaurantModel.findById(restaurantId);
    if (!restaurantExists) {
        return res.json({ success: false, message: "Restaurant not found." });
    }

    const image_filename = req.file.filename;

    const food = new foodModel({
        name,
        description,
        price,
        category,
        image: image_filename,
        restaurantId
    });

    try {
        await food.save();
        res.json({ success: true, message: 'Food Added' });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message || 'Error' });
    }
}

// All food list — populate restaurant info
const listFood = async (req, res) => {
    try {
        const foods = await foodModel
            .find({})
            .populate("restaurantId", "name address city state cuisine status");
        res.json({ success: true, data: foods });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message || 'Error' });
    }
}

// Remove food item
const removeFood = async (req, res) => {
    try {
        const food = await foodModel.findById(req.body.id);
        if (!food) {
            return res.json({ success: false, message: "Food not found." });
        }
        fs.unlink(`uploads/${food.image}`, () => {});
        await foodModel.findByIdAndDelete(req.body.id);
        res.json({ success: true, message: 'Food Removed' });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message || 'Error' });
    }
}

export { addFood, listFood, removeFood }
