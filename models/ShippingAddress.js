const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const shippingAddressSchema = new Schema(
    {
        shippingAddress: { type: String, required: true }
    },
    {
        versionKey: false,
        timestamps: true
    },
);
shippingAddressSchema.pre("create", function (next) {
    next();
});
const ShippingAddress = model('ShippingAddress', shippingAddressSchema);

module.exports = ShippingAddress;
