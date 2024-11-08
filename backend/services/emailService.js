import nodemailer from 'nodemailer';
import nodemailerMock from 'nodemailer-mock';

const transporter = process.env.NODE_ENV === 'test'
  ? nodemailerMock.createTransport({})  // Use mock transport in test environment
  : nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

export default transporter;
