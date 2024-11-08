import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
import mongoose from 'mongoose';
import app from '../server.js';
import User from '../models/User.js';
import { use, expect } from 'chai';
import chaiHttp from 'chai-http';
import nodemailerMock from 'nodemailer-mock';

const chai = use(chaiHttp);

describe('User Authentication and Password Reset API', () => {
  
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
    nodemailerMock.mock.reset();
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
  
  // Password Reset Tests
  describe('Password Reset Flow', () => {
    let resetCode;

    it('should request a password reset and send an email', async () => {
      // Register the user
      const user = {
        username: 'testuser',
        email: 'testuser@example.com',
        password: 'password123',
      };
      await chai.request.execute(app).post('/api/signup').send(user);

      // Request a password reset
      const res = await chai.request.execute(app)
        .get('/api/reset-password')
        .query({ email: user.email });

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('message', 'Reset code sent to email');

      // Verify the reset code was "sent" via nodemailerMock
      const sentMails = nodemailerMock.mock.getSentMail();
      expect(sentMails.length).to.equal(1);
      expect(sentMails[0].to).to.equal(user.email);

      // Retrieve the reset code from the database
      const updatedUser = await User.findOne({ email: user.email });
      resetCode = updatedUser.resetCode; // Save the reset code for the next test
      expect(resetCode).to.exist;
    });

    it('should reset the password using the correct reset code', async () => {
      // Ensure the user exists with a reset code
      const user = new User({
        username: 'testuser',
        email: 'testuser@example.com',
        hash: 'oldhashedpassword',
        salt: 'oldsalt',
        resetCode, // Use the reset code from the previous test
      });
      await user.save();

      // New password to set
      const newPassword = 'newpassword123';
      const res = await chai.request.execute(app)
        .patch('/api/reset-password')
        .query({ email: user.email })
        .send({ password: newPassword, code: resetCode });

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('message', 'Password reset successful');

      // Verify the password has been updated
      const updatedUser = await User.findOne({ email: user.email });
      expect(updatedUser).to.not.be.null;
      expect(await updatedUser.validatePassword(newPassword)).to.be.true;
    });

    it('should return 400 for an incorrect reset code', async () => {
      // Set up a user with a reset code
      const user = new User({
        username: 'testuser',
        email: 'testuser@example.com',
        hash: 'oldhashedpassword',
        salt: 'oldsalt',
        resetCode, // Use the correct reset code for this user
      });
      await user.save();

      // Attempt to reset the password with an incorrect code
      const res = await chai.request.execute(app)
        .patch('/api/reset-password')
        .query({ email: user.email })
        .send({ password: 'newpassword123', code: 'wrongcode' });

      expect(res).to.have.status(400);
      expect(res.body).to.have.property('message', 'Invalid reset code or user not found');
    });
  });

  // test user signout
  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });
});
