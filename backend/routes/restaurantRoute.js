import express from "express";

import {
    addRestaurant,
    listRestaurant,
    getRestaurant
} from "../controllers/restaurantController.js";

const restaurantRouter = express.Router();

// Add Restaurant
restaurantRouter.post("/add", addRestaurant);

// Get All Restaurants
restaurantRouter.get("/list", listRestaurant);

// Get Single Restaurant
restaurantRouter.get("/:id", getRestaurant);

export default restaurantRouter;