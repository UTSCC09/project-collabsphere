import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import transporter from '../services/emailService.js';
import { OAuth2Client } from 'google-auth-library';

const usernameRegex = /^[ A-Za-z0-9_@./#&+!-]{8,20}$/;

const client = new OAuth2Client();

// makes Google API request for access token and returns email
async function validateAccessToken(token) {
  const response = await fetch(
    'https://www.googleapis.com/oauth2/v2/userinfo?access_token=' + token.access_token,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (response.ok) {
    const json = await response.json();
    return json.email;
  } else {
    return null;
  }
}

// user signup
export const signup = async (req, res) => {
    const { username, email, password } = req.body;
  
    // validate username
    if (!usernameRegex.test(username)) {
        return res.status(400).json({ message: 'Invalid username format. It must be 8-20 characters and can only contain letters, numbers, and certain symbols.' });
    }

    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }
  
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
  
      const user = new User({
        username: username,
        email: email,
        hash: hash,
        salt: salt,
      });
  
      await user.save();

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

      res.cookie("token", token, { 
        httpOnly: true,
        secure: true,
        sameSite: "none"
      });

      res.status(201).json({
        message: "User registered successfully",
        username: user.username,
        email: user.email,
      });

    } catch (error) {
      console.error('Signup Error:', error);
      res.status(500).json({ message: 'User registration failed', error });
    }
};

// OAuth signup
export const oAuthSignup = async (req, res) => {
  const { username, OAuthToken } = req.body;

  // validate username
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ message: 'Invalid username format. It must be 8-20 characters and can only contain letters, numbers, and certain symbols.' });
  }

  try {
    const email = await validateAccessToken(OAuthToken);
    if (!email) {
      throw new Error('OAuthToken is missing or invalid');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({
		username: username,
		email: email,
	});

    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none"
    });

    res.status(201).json({
      message: "User registered successfully",
      username: user.username,
      email: user.email,
    });

  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ message: 'User registration failed', error });
  }
};

// user signin
export const signin = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(password, user.hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    
		res.cookie("token", token, { 
      httpOnly: true,
      secure: true,
      sameSite: "none"
    });

		res.json({
			message: "Login successful",
			username: user.username,
			email: user.email,
		});

  } catch (error) {
    console.error('Signin Error:', error);
    res.status(500).json({ message: 'Login failed', error });
  }
};

// OAuth signin
export const oAuthSignin = async (req, res) => {
  const { OAuthToken } = req.body;

  try {
    const email = await validateAccessToken(OAuthToken);
    if (!email) {
      throw new Error('OAuthToken is missing or invalid');
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none"
    });

    res.json({
      message: "Login successful",
      username: user.username,
      email: user.email,
    });

  } catch (error) {
    console.error('Signin Error:', error);
    res.status(500).json({ message: 'Login failed', error });
  }
};

// user signout
export const signout = (req, res) => {
  res.json({ message: 'Signout successful' });
};

// Request password reset
export const requestPasswordReset = async (req, res) => {
  const { email } = req.query;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate a reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetCode = resetCode;
    await user.save();

    // Send reset code via email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Code',
      text: `Your password reset code is: ${resetCode}`,
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Reset code sent to email' });
  } catch (error) {
    console.error('Password Reset Request Error:', error);
    res.status(500).json({ message: 'Failed to send reset code', error });
  }
};

// Reset password
export const resetPassword = async (req, res) => {
  const { email } = req.query;
  const { password, code } = req.body;

  try {
    const user = await User.findOne({ email, resetCode: code });
    if (!user) {
      return res.status(400).json({ message: 'Invalid reset code or user not found' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    user.hash = await bcrypt.hash(password, salt);
    user.salt = salt;
    user.resetCode = null; // Clear the reset code after successful password reset
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Password Reset Error:', error);
    res.status(500).json({ message: 'Failed to reset password', error });
  }
};

// Check if user is authenticated
export const checkAuth = async (req, res) => {
	try {
		const user = await User.findById(req.userId);
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		res.json({
			message: "User remains authenticated",
			username: user.username,
			email: user.email,
		});
	} catch (error) {
		console.error("Check Auth Error:", error);
		res.status(500).json({ message: "Failed to retrieve user", error });
	}
};