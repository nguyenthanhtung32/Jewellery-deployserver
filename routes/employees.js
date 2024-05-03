const passport = require('passport');
const express = require('express');
const bcrypt = require("bcryptjs");
const { CONNECTION_STRING } = require('../constants/dbSettings');
const { default: mongoose } = require('mongoose');
const { Employee } = require('../models');
const {
    validateSchema,
    loginSchema
} = require('../validation/employee');
const encodeToken = require('../helpers/jwtHelper');

// MONGOOSE
mongoose.set('strictQuery', false);
mongoose.connect(CONNECTION_STRING);

const router = express.Router();


router.post(
    '/login',
    validateSchema(loginSchema),
    async (req, res, next) => {
        try {
            const { email, password } = req.body;
            const employee = await Employee.findOne({ email });

            if (!employee) return res.status(404).send({ message: 'Not found' });

            const isValidPassword = await bcrypt.compare(password, employee.password);

            if (!isValidPassword) {
                return res.status(401).json({ message: "Incorrect password" });
            }

            const { _id, email: empEmail, firstName, lastName } = employee;

            const token = encodeToken(_id, empEmail, firstName, lastName);

            res.status(200).json({
                token,
                payload: employee,
            });
        } catch (err) {
            res.status(401).json({
                statusCode: 401,
                message: 'Unauthorized',
            });
        }
    },
);

router.get(
    '/profile',
    passport.authenticate('jwt', { session: false }),
    async (req, res, next) => {
        try {
            const employee = await Employee.findById(req.user._id);

            if (!employee) return res.status(404).send({ message: 'Not found' });

            res.status(200).json(employee);
        } catch (err) {
            res.sendStatus(500);
        }
    },
);

router.route('/profile').get(passport.authenticate('jwt', { session: false }), async (req, res, next) => {
    try {
        const employee = await Employee.findById(req.user._id);

        if (!employee) return res.status(404).send({ message: 'Not found' });

        res.status(200).json(employee);
    } catch (err) {
        res.sendStatus(500);
    }
},);

// GET

router.get('/', function (req, res, next) {
    try {
        Employee.find()
            .then((result) => {
                res.send(result);
            })
            .catch((err) => {
                res.status(400).send({ message: err.message });
            });
    } catch (err) {
        res.sendStatus(500);
    }
});

// GET:/id
router.get('/:id', function (req, res, next) {
    try {
        const { id } = req.params;
        Employee.findById(id)
            .then((result) => {
                res.send(result);
            })
            .catch((err) => {
                res.status(400).send({ message: err.message });
            });
    } catch (err) {
        res.sendStatus(500);
    }
});

// POST
router.post('/', async (req, res, next) => {
    try {
        const data = req.body;
        const email = data.email;
        const emailUnique = await Employee.findOne({ email });
        if (emailUnique) {
            return res.status(404).send({ message: 'Email already exists' });
        }
        const newItem = new Employee(data);
        newItem
            .save()
            .then((result) => {
                res.send(result);
            })
            .catch((err) => {
                console.error(err);
                res.status(400).send({ message: err.message });
            });
    } catch (err) {
        res.sendStatus(500);
    }
});
// POST để khóa tài khoản nhân viên
router.post('/:id/lock', async (req, res) => {
    try {
        const { id } = req.params;

        // Tìm nhân viên theo ID
        const employees = await Employee.findById(id);

        if (!employees) {
            return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
        }

        // Đặt trạng thái isLocked của nhân viên thành true
        employees.isLocked = true;

        // Lưu thay đổi
        await employees.save();

        res.status(200).json({ message: 'Tài khoản đã bị khóa thành công' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Đã xảy ra lỗi khi khóa tài khoản' });
    }
});

// POST để mở khóa tài khoản nhân viên
router.post('/:id/unlock', async (req, res) => {
    try {
        const { id } = req.params;

        // Tìm nhân viên theo ID
        const employees = await Employee.findById(id);

        if (!employees) {
            return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
        }

        // Đặt trạng thái isLocked của nhân viên thành false
        employees.isLocked = false;

        // Lưu thay đổi
        await employees.save();

        res.status(200).json({ message: 'Tài khoản đã được mở khóa thành công' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Đã xảy ra lỗi khi mở khóa tài khoản' });
    }
});

// PATCH/:id
router.patch('/:id', async function (req, res, next) {
    try {
        const { id } = req.params;
        const data = req.body;

        if (data.password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(data.password, salt);
            data.password = hashedPassword;
        }

        Employee.findByIdAndUpdate(id, data, {
            new: true,
        })
            .then((result) => {
                res.send(result);
            })
            .catch((err) => {
                res.status(400).send({ message: err.message });
            });
    } catch (error) {
        res.sendStatus(500);
    }
});

// DELETE
router.delete('/:id', function (req, res, next) {
    try {
        const { id } = req.params;
        Employee.findByIdAndDelete(id)
            .then((result) => {
                res.send(result);
            })
            .catch((err) => {
                res.status(400).send({ message: err.message });
            });
    } catch (err) {
        res.sendStatus(500);
    }
});

module.exports = router;