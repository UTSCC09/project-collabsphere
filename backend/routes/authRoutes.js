import express from 'express';
import {
  signup,
  signin,
  signout,
  requestPasswordReset,
  resetPassword,
  oAuthSignin, oAuthSignup
} from '../controllers/authController.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/oauth-signup', oAuthSignup);
router.post('/signin', signin);
router.post('/oauth-signin', oAuthSignin);
router.get('/signout', signout);
router.get('/reset-password', requestPasswordReset);
router.patch('/reset-password', resetPassword);

export default router;
