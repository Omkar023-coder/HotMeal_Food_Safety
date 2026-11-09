import userModel from "../models/userModel.js";

const adminAuth = async (req, res, next) => {
    try {
        // authMiddleware should run before adminAuth
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: "Not Authorized. Login Again."
            });
        }

        // Find the logged-in user
        const user = await userModel.findById(req.userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found."
            });
        }

        // Check admin role
        if (user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin only."
            });
        }

        // User is an admin
        next();

    } catch (error) {
        console.log("Admin auth error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error during admin authorization."
        });
    }
};

export default adminAuth;