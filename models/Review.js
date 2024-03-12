const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const reviewSchema = Schema(
    {
        customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
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
    justOne: false,
});

reviewSchema.set('toObject', { virtual: true });

reviewSchema.set('toJSON', { virtual: true });

const Review = model('Review', reviewSchema);

module.exports = Review;