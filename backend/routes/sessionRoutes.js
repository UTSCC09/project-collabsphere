import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {createSession, getSessionHost, joinSession, leaveSession} from '../controllers/sessionController.js';

const router = express.Router();

// create a new session
router.get('/session', verifyToken, createSession);

// join a session
router.get('/session/:id', verifyToken, joinSession);

// leave a session
router.delete('/session/:id', verifyToken, leaveSession);

// gets the connection id of the host
router.get('/session/:id/host', verifyToken, getSessionHost);

export default router;
