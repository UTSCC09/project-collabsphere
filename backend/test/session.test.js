import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
import mongoose from 'mongoose';
import app from '../server.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { use, expect } from 'chai';
import chaiHttp from 'chai-http';
import jwt from 'jsonwebtoken';

const chai = use(chaiHttp);

describe('Session Management API', () => {
  let token;
  let userId;

  // Connect to the test database
  before(async () => {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  // Register and log in a user before testing sessions
  beforeEach(async () => {
    await User.deleteMany({});
    await Session.deleteMany({});
    
    // Register a new user
    const user = {
      username: 'testuser',
      email: 'testuser@example.com',
      password: 'password123',
    };
    await chai.request.execute(app).post('/api/signup').send(user);

    // Log in to obtain JWT token
    const res = await chai.request.execute(app)
      .post('/api/signin')
      .send({ email: user.email, password: user.password });

    expect(res).to.have.status(200);
    token = res.body.token; // save the JWT token for future requests
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.id; // save the userId for session-related tests
  });

  // Test session creation
  describe('POST /api/session', () => {
    it('should create a new session', async () => {
      const res = await chai.request.execute(app)
        .get('/api/session')
        .set('Authorization', `Bearer ${token}`);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('message', 'Session created');
      expect(res.body).to.have.property('sessionId');
    });
  });

  // Test joining a session
  describe('GET /api/session/:id', () => {
    let sessionId;

    beforeEach(async () => {
      // Create a session to join
      const res = await chai.request.execute(app)
        .get('/api/session')
        .set('Authorization', `Bearer ${token}`);

      sessionId = res.body.sessionId;
    });

    it('should join an existing session', async () => {
      const res = await chai.request.execute(app)
        .get(`/api/session/${sessionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('message', 'Joined session');
      expect(res.body.session).to.have.property('_id', sessionId);
    });

    it('should return 404 for a non-existent session', async () => {
      // Correctly generate a random ObjectId for a non-existent session
      const invalidSessionId = new mongoose.Types.ObjectId();

      const res = await chai.request.execute(app)
        .get(`/api/session/${invalidSessionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res).to.have.status(404);
      expect(res.body).to.have.property('message', 'Session not found');
    });
  });

  // Test leaving a session
  describe('DELETE /api/session/:id', () => {
    let sessionId;

    beforeEach(async () => {
      // Create a session to leave
      const res = await chai.request.execute(app)
        .get('/api/session')
        .set('Authorization', `Bearer ${token}`);

      sessionId = res.body.sessionId;
    });

    it('should leave a session as a participant', async () => {
      // Temporarily assign a different host for testing participant leaving
      await Session.updateOne({ _id: sessionId }, { host: new mongoose.Types.ObjectId() });

      const res = await chai.request.execute(app)
        .delete(`/api/session/${sessionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('message', 'Left session');
    });

    it('should end the session if the host leaves', async () => {
      // Host leaves the session
      const res = await chai.request.execute(app)
        .delete(`/api/session/${sessionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('message', 'Session ended by host');

      // Verify session has been deleted
      const sessionCheck = await chai.request.execute(app)
        .get(`/api/session/${sessionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(sessionCheck).to.have.status(404);
      expect(sessionCheck.body).to.have.property('message', 'Session not found');
    });
  });

  // Clean up database after tests
  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });
});
