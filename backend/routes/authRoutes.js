import express from 'express';
import {
	signup,
	signin,
	signout,
	requestPasswordReset,
	resetPassword,
	checkAuth,
} from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/signin", signin);
router.get("/signout", signout);
router.get("/reset-password", requestPasswordReset);
router.patch("/reset-password", resetPassword);
router.get("/check-auth", verifyToken, checkAuth);

export default router;
