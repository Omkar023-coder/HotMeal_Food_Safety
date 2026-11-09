import express from 'express'
import { addFood, listFood, removeFood } from '../controllers/foodController.js'
import multer from 'multer'

import authMiddleware from '../middleware/auth.js'
import adminAuth from '../middleware/adminAuth.js'

const foodRouter = express.Router();

// Image Storage Engine
const storage = multer.diskStorage({
    destination: "uploads",
    filename: (req, file, cb) => {
        return cb(null, `${Date.now()}${file.originalname}`)
    }
})

const upload = multer({ storage: storage })

// Add Food — Admin Only
foodRouter.post(
    '/add',
    authMiddleware,
    adminAuth,
    upload.single('image'),
    addFood
)

// List Food — Public
foodRouter.get('/list', listFood)

// Remove Food — Admin Only
foodRouter.post(
    '/remove',
    authMiddleware,
    adminAuth,
    removeFood
)

export default foodRouter;