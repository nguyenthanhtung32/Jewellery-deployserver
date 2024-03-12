const mongoose = require('mongoose');
const { Schema, model } = mongoose;
const mongooseLeanVirtuals = require("mongoose-lean-virtuals");

const productSchema = Schema(
    {
        productName: { type: String, required: true },
        code: { type: String, required: true },
        price: { type: Number, min: 0, default: 0, required: true },
        discount: { type: Number, min: 0, max: 100, default: 0, required: true },
        stockQuantity: { type: Number, min: 0, default: 0 },
        // imageId: { type: Schema.Types.ObjectId, ref: 'Media' },
        categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
        reviewId: { type: Schema.Types.ObjectId, ref: 'Review' },
        sizeId: { type: Schema.Types.ObjectId, ref: 'Review' },
    },
    {
        versionKey: false,
        timestamps: true,
    }
);

// productSchema.virtual('productImages', {
//     ref: 'Media',
//     localField: 'imageId',
//     foreignField: '_id',
//     justOne: true,
// });

productSchema.virtual('category', {
    ref: 'Category',
    localField: 'categoryId',
    foreignField: '_id',
    justOne: true,
});

productSchema.virtual('review', {
    ref: 'Review',
    localField: 'reviewId',
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