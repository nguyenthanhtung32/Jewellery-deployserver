const mongoose = require('mongoose');
const { Schema, model } = mongoose;
const bcrypt = require('bcryptjs');

const employeeSchema = new Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: {
        type: String,
        validate: {
            validator: function (value) {
                const emailRegex = /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/;
                return emailRegex.test(value);
            },
            message: `{VALUE} is not a valid email!`,
        },
        required: [true, 'email is required'],
    },
    phoneNumber: {
        type: String,
        validate: {
            validator: function (value) {
                const phoneRegex = /^(0?)(3[2-9]|5[6|8|9]|7[0|6-9]|8[0-6|8|9]|9[0-4|6-9])[0-9]{7}$/;
                return phoneRegex.test(value);
            },
            message: `{VALUE} is not a valid phone!`,
        },
    },
    password: {
        type: String,
        required: true,
        validate: {
            validator: function (value) {
                return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]).{8,}$/.test(value);

            },
            message: 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
        },
    },
    address: { type: String, required: true },
    birthday: { type: Date },
    gender: { type: String, required: true },
    role: { type: String, required: true },
    avatar: { type: String },
    isLocked: { type: Boolean, default: false },
},
    {
        versionKey: false,
        timestamps: true
    }
);

employeeSchema.pre('save', async function (next) {
    // Kiểm tra nếu mật khẩu không được chỉnh sửa
    if (!this.isModified("password")) {
        return next();
    }

    try {
        // generate salt key
        const salt = await bcrypt.genSalt(10); // 10 ký tự
        // generate password = sale key + hash key
        const hashedPassword = await bcrypt.hash(this.password, salt);
        // override password
        this.password = hashedPassword;
        next();
    } catch (err) {
        next(err);
    }
});

employeeSchema.methods.isValidPass = async function (pass) {
    try {
        return await bcrypt.compare(pass, this.password);
    } catch (err) {
        throw new Error(err);
    }
}

employeeSchema.virtual('fullName').get(function () {
    return this.firstName + ' ' + this.lastName;
});

const Employee = model('Employee', employeeSchema);
module.exports = Employee;