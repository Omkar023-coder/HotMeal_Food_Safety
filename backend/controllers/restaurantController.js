import restaurantModel from "../models/restaurantModel.js";
import foodModel from "../models/foodModel.js";

// Add Restaurant
const addRestaurant = async (req, res) => {
    try {
        const {
            name,
            address,
            city,
            state,
            pincode,
            phone,
            cuisine
        } = req.body;

        const restaurant = new restaurantModel({
            name,
            address,
            city,
            state,
            pincode,
            phone,
            cuisine
        });

        await restaurant.save();

        res.json({
            success: true,
            message: "Restaurant Added",
            data: restaurant
        });

    } catch (error) {
        console.log(error);

        res.json({
            success: false,
            message: error.message || "Error adding restaurant"
        });
    }
};


// Get All Restaurants
const listRestaurant = async (req, res) => {
    try {
        const restaurants = await restaurantModel.find({});

        res.json({
            success: true,
            data: restaurants
        });

    } catch (error) {
        console.log(error);

        res.json({
            success: false,
            message: error.message || "Error fetching restaurants"
        });
    }
};


// Get Single Restaurant
const getRestaurant = async (req, res) => {
    try {
        const restaurant = await restaurantModel.findById(req.params.id);

        if (!restaurant) {
            return res.json({
                success: false,
                message: "Restaurant not found"
            });
        }

        res.json({
            success: true,
            data: restaurant
        });

    } catch (error) {
        console.log(error);

        res.json({
            success: false,
            message: error.message || "Error fetching restaurant"
        });
    }
};


// Delete Restaurant
const deleteRestaurant = async (req, res) => {
    try {
        const restaurant = await restaurantModel.findById(req.body.id);

        if (!restaurant) {
            return res.json({
                success: false,
                message: "Restaurant not found"
            });
        }

        // Safety check — refuse deletion if food items reference this restaurant
        const associatedFoods = await foodModel.countDocuments({ restaurantId: req.body.id });
        if (associatedFoods > 0) {
            return res.json({
                success: false,
                message: `Cannot delete restaurant because ${associatedFoods} food item(s) are associated with it.`
            });
        }

        await restaurantModel.findByIdAndDelete(req.body.id);

        res.json({
            success: true,
            message: "Restaurant Removed"
        });

    } catch (error) {
        console.log(error);
        res.json({
            success: false,
            message: error.message || "Error removing restaurant"
        });
    }
};


export {
    addRestaurant,
    listRestaurant,
    getRestaurant,
    deleteRestaurant
};