const mongoose = require('mongoose');
const { Schema, model } = mongoose;
const mongooseLeanVirtuals = require("mongoose-lean-virtuals");

const productSchema = new Schema(
    {
        productName: { type: String, required: true },
        code: { type: String, required: true },
        price: { type: Number, min: 0, default: 0, required: true },
        discount: { type: Number, min: 0, max: 100, default: 0, required: true },
        stock: { type: Number, min: 0, default: 0 },
        categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
        reviewId: { type: Schema.Types.ObjectId, ref: 'Review' },
        sizeId: { type: Schema.Types.ObjectId, ref: 'Size' },
    },
    {
        versionKey: false,
        timestamps: true,
    }
);

productSchema.virtual('category', {
    ref: 'Category',
    localField: 'categoryId',
    foreignField: '_id',
    justOne: true,
});

productSchema.virtual('size', {
    ref: 'Size',
    localField: 'sizeId',
    foreignField: '_id',
    justOne: true,
});

productSchema.set('toObject', { virtuals: true });

productSchema.set('toJSON', { virtuals: true });

productSchema.plugin(mongooseLeanVirtuals);

const Product = model('Product', productSchema);

module.exports = Product;