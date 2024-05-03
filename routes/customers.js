const passport = require('passport');
const express = require("express");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { CONNECTION_STRING } = require('../constants/dbSettings');
const { default: mongoose } = require('mongoose');
const { Customer } = require("../models");
const {
  validateSchema,
  loginSchema
} = require('../validation/customer');
const encodeToken = require('../helpers/jwtHelper');
const JWT = require('jsonwebtoken');
const jwtSettings = require('../constants/jwtSettings');

mongoose.set('strictQuery', false);
mongoose.connect(CONNECTION_STRING);

const router = express.Router();

router.post(
  "/login",
  validateSchema(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const customer = await Customer.findOne({ email });

      if (!customer) return res.status(404).send({ message: "Not found" });

      const isValidPassword = await bcrypt.compare(password, customer.password);

      if (!isValidPassword) {
        return res.status(401).json({ message: "Incorrect password" });
      }

      const { _id, email: cusEmail, firstName, lastName } = customer;

      const token = encodeToken(_id, cusEmail, firstName, lastName);

      res.status(200).json({
        token,
        payload: customer,
      });
    } catch (err) {
      res.status(401).json({
        statusCode: 401,
        message: "Unauthorized",
      });
    }
  }
);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "nguyenthanhtung03082001@gmail.com",
    pass: "gljwkgvrunamtzrl",
  },
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const customer = await Customer.findOne({ email });

    if (!customer) {
      return res.status(404).send({ message: "Không tìm thấy khách hàng" });
    }

    const { _id, firstName, lastName } = customer;
    const resetToken = encodeToken(_id, email, firstName, lastName);
    await Customer.findByIdAndUpdate(_id, { resetToken });

    const resetLink = `http://localhost:3000/reset-password/${resetToken}`;
    const mailOptions = {
      from: "Jewellery <nguyenthanhtung03082001@gmail.com>",
      to: email,
      subject: "[JEWELLERY] - Đặt lại mật khẩu",
      html: `<p>Chào bạn,</p>
             <p>Bạn nhận được email này vì bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
             <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
             <p>Nếu bạn muốn đặt lại mật khẩu, vui lòng click vào đường link sau: <a href="${resetLink}">Đặt lại mật khẩu</a></p>
             <p>Xin cảm ơn,</p>
             <p>Jewellery</p>`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Error sending email:", error);
        return res.status(500).json({ message: "Đã xảy ra lỗi khi gửi email" });
      }
      console.log("Email sent:", info.response);
      res.status(200).json({ message: "Email đã được gửi thành công" });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi xử lý yêu cầu" });
  }
});

router.patch("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const decodedToken = JWT.verify(token, jwtSettings.SECRET);
    const { _id } = decodedToken;

    const customer = await Customer.findById(_id);

    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }

    customer.password = password;
    await customer.save();

    res.status(200).json({ message: "Mật khẩu đã được cập nhật thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi xử lý yêu cầu" });
  }
});

router.get(
  '/profile',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {

      const customer = await Customer.findById(req.user._id);

      if (!customer) return res.status(404).send({ message: 'Not found' });

      res.status(200).json(customer);
    } catch (err) {
      res.sendStatus(500);
    }
  },
);

//GET all
router.get('/', function (req, res, next) {
  try {
    Customer.find()
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

//GET id
router.get('/:id', function (req, res) {
  try {
    const { id } = req.params;
    Customer.findById(id)
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

//POST
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const email = data.email;
    const emailUnique = await Customer.findOne({ email });
    if (emailUnique) {
      return res.status(404).send({ message: 'Email already exists' });
    }
    const newItem = new Customer(data);
    newItem
      .save()
      .then((result) => {
        res.send(result);
      })
      .catch((err) => {
        console.log(err);
        res.status(400).send({ message: err.message });
      });
  } catch (err) {
    res.sendStatus(500);
  }
});

//DELETE
router.delete('/:id', function (req, res, next) {
  try {
    const { id } = req.params;
    Customer.findByIdAndDelete(id)
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

// POST để khóa tài khoản khách hàng
router.post('/:id/lock', async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    }

    customer.status = true;

    await customer.save();

    res.status(200).json({ message: 'Tài khoản đã bị khóa thành công' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Đã xảy ra lỗi khi khóa tài khoản' });
  }
});

// POST để mở khóa tài khoản khách hàng
router.post('/:id/unlock', async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    }

    customer.status = false;

    await customer.save();

    res.status(200).json({ message: 'Tài khoản đã được mở khóa thành công' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Đã xảy ra lỗi khi mở khóa tài khoản' });
  }
});

//PATCH
router.patch('/:id', async function (req, res, next) {
  try {
    const { id } = req.params;
    const data = req.body;

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(data.password, salt);
      data.password = hashedPassword;
    }

    Customer.findByIdAndUpdate(id, data, {
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

router.post('/change-password', async (req, res) => {
  try {
    const { email, oldPassword, newPassword } = req.body;
    const customer = await Customer.findOne({ email });

    if (!customer) {
      return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    }

    const isValidOldPassword = await customer.isValidPass(oldPassword);

    if (!isValidOldPassword) {
      return res.status(401).json({ message: 'Mật khẩu cũ không chính xác' });
    }

    if (oldPassword === newPassword) {
      res.status(400).json({ message: 'Mật khẩu mới không được giống mật khẩu cũ' });
    }

    customer.password = newPassword;
    await customer.save();

    res.status(200).json({ message: 'Mật khẩu đã được thay đổi thành công' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Đã xảy ra lỗi khi thay đổi mật khẩu' });
  }
});

module.exports = router;
