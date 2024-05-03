const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const sizeDetailSchema = new Schema(
    {
        size: { type: String },
        stock: { type: Number },
    },
    {
        _id: true
    }
);

const sizeSchema = new Schema(
    {
        sizes: [sizeDetailSchema],
        productName: { type: String, required: true },
    },
    {
        versionKey: false,
        timestamps: true
    }
);

sizeSchema.set('toObject', { virtual: true });

sizeSchema.set('toJSON', { virtual: true });

const Size = model('Size', sizeSchema);

module.exports = Size;