import express from "express";

import {
    addRestaurant,
    listRestaurant,
    getRestaurant,
    deleteRestaurant
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

// Get All Restaurants — Public
restaurantRouter.get(
    "/list",
    listRestaurant
);

// Get Single Restaurant — Public
restaurantRouter.get(
    "/:id",
    getRestaurant
);

// Delete Restaurant — Admin Only
restaurantRouter.post(
    "/remove",
    authMiddleware,
    adminAuth,
    deleteRestaurant
);

export default restaurantRouter;