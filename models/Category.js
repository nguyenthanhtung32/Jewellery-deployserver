const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const categorySchema = new Schema(
  {
    name: { type: String, required: [true, 'Category bắt buộc phải nhập'] },
  },
  {
    versionKey: false,
    timestamps: true
  },
);
categorySchema.set('toObject', { virtuals: true });

categorySchema.set('toJSON', { virtuals: true });

const Category = model('Category', categorySchema);

module.exports = Category;
