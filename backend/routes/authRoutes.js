import express from 'express';
import { signup, signin, signout, requestPasswordReset, resetPassword } from '../controllers/authController.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/signin', signin);
router.get('/signout', signout);
router.get('/reset-password', requestPasswordReset);
router.patch('/reset-password', resetPassword);

export default router;
