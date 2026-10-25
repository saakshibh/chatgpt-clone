import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
  },
  { timestamps: true }
);

export default mongoose.model("Project", projectSchema);