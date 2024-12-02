import express from 'express';
import {
  signup,
  signin,
  signout,
  requestPasswordReset,
  resetPassword,
  oAuthSignin, oAuthSignup,
  checkAuth,
} from '../controllers/authController.js';
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post('/signup', signup);
router.post('/oauth-signup', oAuthSignup);
router.post('/signin', signin);
router.post('/oauth-signin', oAuthSignin);
router.get('/signout', signout);
router.get('/reset-password', requestPasswordReset);
router.patch('/reset-password', resetPassword);
router.get("/check-auth", verifyToken, checkAuth);

export default router;
