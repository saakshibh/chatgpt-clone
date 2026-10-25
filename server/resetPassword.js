import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.log("Usage: node resetPassword.js your@email.com NewPassword (min 8 chars)");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const user = await User.findOne({ email: email.toLowerCase() });
if (!user) {
  console.log("No user with that email");
} else {
  user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();
  console.log("Password updated for", user.email);
}
await mongoose.disconnect();