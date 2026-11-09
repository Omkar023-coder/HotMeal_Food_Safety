import express from "express";

import {
    addRestaurant,
    listRestaurant,
    getRestaurant
} from "../controllers/restaurantController.js";

import authMiddleware from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

const restaurantRouter = express.Router();

// Add Restaurant — Admin Only
restaurantRouter.post(
    "/add",
    authMiddleware,
    adminAuth,
    addRestaurant
);

// Get All Restaurants
restaurantRouter.get("/list", listRestaurant);

// Get Single Restaurant
restaurantRouter.get("/:id", getRestaurant);

export default restaurantRouter;