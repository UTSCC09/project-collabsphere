import Session from '../models/Session.js';

// create a new session
export const createSession = async (req, res) => {
    const userId = req.userId; 
    try {
      const session = await Session.create({ host: userId });
      res.json({ message: 'Session created', sessionId: session._id });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create session', error });
    }
};

// join a session
export const joinSession = async (req, res) => {
    const sessionId = req.params.id;
    try {
        const session = await Session.findById(sessionId);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        res.json({ message: 'Joined session', session });
    } catch (error) {
        res.status(500).json({ message: 'Failed to join session', error });
    }
};

// leave a session
export const leaveSession = async (req, res) => {
  const sessionId = req.params.id;
  const userId = req.userId;

  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // if host, end session
    if (session.host.toString() === userId) {
      await session.deleteOne();
      return res.status(200).json({ message: 'Session ended by host' });
    } else {
      // remove user from session
      // ...
      res.status(200).json({ message: 'Left session' });
    }
  } catch (error) {
    console.error('Error leaving session:', error);
    res.status(500).json({ message: 'Failed to leave session' });
  }
};
