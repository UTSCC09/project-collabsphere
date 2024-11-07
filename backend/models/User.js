import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  hash: {
    type: String,
    required: true,
  },
  salt: {
    type: String,
    required: true,
  },
  resetCode: {
    type: String,
    default: null,
  },
});

userSchema.methods.validatePassword = async function (password) {
  return bcrypt.compare(password, this.hash);
};

const User = mongoose.model('User', userSchema);
export default User;
