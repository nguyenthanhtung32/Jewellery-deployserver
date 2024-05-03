const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const reviewSchema = new Schema(
    {
        customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        ratingRate: { type: Number, default: 0, min: 0, max: 5 },
        comment: { type: String },
        reviewDate: { type: Date, default: Date.now },
    },
    {
        versionKey: false,
        timestamps: true
    }
);

reviewSchema.virtual('customer', {
    ref: 'Customer',
    localField: 'customerId',
    foreignField: '_id',
    justOne: true,
});

reviewSchema.virtual('product', {
    ref: 'Product',
    localField: 'productId',
    foreignField: '_id',
    justOne: true,
});

reviewSchema.set('toObject', { virtuals: true });
reviewSchema.set('toJSON', { virtuals: true });

const Review = model('Review', reviewSchema);

module.exports = Review;