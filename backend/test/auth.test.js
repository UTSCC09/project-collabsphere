import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
import mongoose from 'mongoose';
import app from '../server.js';
import User from '../models/User.js';
import { use, expect } from 'chai';
import chaiHttp from 'chai-http';

const chai = use(chaiHttp);

describe('User Authentication API', () => {
  
  // connect to the test database
  before(async () => {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  // clear the database before each test
  beforeEach(async () => {
    await User.deleteMany({});
  });

  // test user signup
  describe('POST /api/signup', () => {
    it('should register a new user', async () => {
      const user = {
        username: 'testuser',
        email: 'testuser@example.com',
        password: 'password123',
      };

      const res = await chai.request.execute(app)
        .post('/api/signup')
        .send(user);

      expect(res).to.have.status(201);
      expect(res.body).to.have.property('message', 'User registered successfully');
    });

    it('should not register a user with existing email', async () => {
      const user = {
        username: 'testuser',
        email: 'testuser@example.com',
        password: 'password123',
      };

      // register a user with the email
      await chai.request.execute(app).post('/api/signup').send(user);

      // try to register another user with the same email
      const res = await chai.request.execute(app)
        .post('/api/signup')
        .send(user);

      expect(res).to.have.status(400);  
      expect(res.body).to.have.property('message', 'User already exists');
    });
  });

  // test user signin
  describe('POST /api/signin', () => {
    it('should log in an existing user', async () => {
      const user = {
        username: 'testuser',
        email: 'testuser@example.com',
        password: 'password123',
      };

      // signup a user
      await chai.request.execute(app).post('/api/signup').send(user);

      // log in the user
      const res = await chai.request.execute(app)
        .post('/api/signin')
        .send({ email: user.email, password: user.password });

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('token');
      expect(res.body).to.have.property('message', 'Login successful');
    });

    it('should not log in with incorrect password', async () => {
      const user = {
        username: 'testuser',
        email: 'testuser@example.com',
        password: 'password123',
      };

      // signup a user
      await chai.request.execute(app).post('/api/signup').send(user);

      // log in the user with wrong password
      const res = await chai.request.execute(app)
        .post('/api/signin')
        .send({ email: user.email, password: 'wrongpassword' });

      expect(res).to.have.status(401);
      expect(res.body).to.have.property('message', 'Invalid credentials');
    });
  });

  // test user signout
  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });
});
