const yup = require("yup");
const express = require("express");
const router = express.Router();
const { Order, Product } = require("../models");
const moment = require("moment");
const crypto = require("crypto");

const ObjectId = require("mongodb").ObjectId;

const { CONNECTION_STRING } = require('../constants/dbSettings');
const { default: mongoose } = require('mongoose');

mongoose.set('strictQuery', false);
mongoose.connect(CONNECTION_STRING);

const WEBSHOP_URL = 'http://localhost:3000'


router.get('/', async (req, res, next) => {
    try {
        let orders = await Order.find().populate('customer').populate('employee').lean({ virtuals: true });

        // Bổ sung thông tin về giá sản phẩm trong mỗi đơn hàng
        orders = await Promise.all(orders.map(async (order) => {
            order.orderDetails = await Promise.all(order.orderDetails.map(async (detail) => {
                const product = await Product.findById(detail.productId);
                return {
                    ...detail,
                    price: product.price // Thêm thông tin giá sản phẩm vào mỗi mục trong orderDetails
                };
            }));
            return order;
        }));

        res.json(orders);
    } catch (error) {
        res.status(500).json({ ok: false, error });
    }
});

router.get('/status', async (req, res) => {
    try {
        const statusCounts = await Order.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);
        const formattedData = statusCounts.reduce((acc, { _id, count }) => {
            acc[_id] = count;
            return acc;
        }, {});
        res.json(formattedData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.get('/revenue', async (req, res, next) => {
    try {
        const orders = await Order.find({ status: 'COMPLETE' }); // Chỉ lấy các đơn hàng có status là 'COMPLETE'
        const monthlyRevenue = calculateMonthlyRevenue(orders);
        res.status(200).json(monthlyRevenue);
    } catch (err) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Hàm tính toán doanh thu theo tháng và năm từ danh sách đơn hàng
const calculateMonthlyRevenue = (orders) => {
    const monthlyRevenue = {};
    orders.forEach((order) => {
        if (order.status === 'COMPLETE') { // Chỉ tính toán doanh thu cho các đơn hàng có status là 'COMPLETE'
            const year = new Date(order.createdAt).getFullYear(); // Lấy năm từ createdAt
            const month = new Date(order.createdAt).getMonth() + 1; // Lấy tháng từ createdAt
            const revenue = order.orderDetails.reduce((total, item) => total + (((item.price * (100 - item.discount)) /
                100) *
                item.quantity), 0); // Tính doanh thu từ orderDetails
            if (!monthlyRevenue[year]) {
                monthlyRevenue[year] = {};
            }
            monthlyRevenue[year][month] = (monthlyRevenue[year][month] || 0) + revenue; // Thêm doanh thu vào tháng và năm tương ứng hoặc mặc định là 0 nếu không có doanh số
        }
    });

    // Đảm bảo rằng cả các tháng không có doanh số cũng được đưa vào đối tượng monthlyRevenue
    for (const year in monthlyRevenue) {
        for (let i = 1; i <= 12; i++) {
            if (!monthlyRevenue[year][i]) {
                monthlyRevenue[year][i] = 0;
            }
        }
    }

    return monthlyRevenue;
};

router.get("/:id", async function (req, res, next) {
    try {
        const validationSchema = yup.object().shape({
            params: yup.object({
                id: yup
                    .string()
                    .test("Validate ObjectID", "${path} is not valid ObjectID", (value) => {
                        return ObjectId.isValid(value);
                    }),
            }),
        });

        await validationSchema.validate({ params: req.params }, { abortEarly: false });

        const { id } = req.params;

        const orders = await Order.find({ customerId: id })
            .populate("orderDetails.productId")
            .populate("customer")
            .lean({ virtual: true });

        if (orders.length > 0) {
            return res.send({ ok: true, results: orders });
        }

        return res.send({ ok: false, message: "No orders found for the customer" });
    } catch (error) {
        return res.status(400).json({
            type: error.name,
            errors: error.errors,
            message: error.message,
            provider: "yup",
        });
    }
});


router.post("/", async function (req, res, next) {
    try {
        const data = req.body;

        const newItem = new Order(data);
        const savedItem = await newItem.save();

        await updateProductStock(savedItem);

        res.send(savedItem);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

async function updateProductStock(order) {
    for (const orderDetail of order.orderDetails) {
        const productId = orderDetail.productId;
        const quantity = orderDetail.quantity;

        if (orderDetail.size) {
            const product = await Product.findOne({ _id: productId }).populate("sizeId")

            const sizeIndex = product.sizeId.sizes.findIndex(size => size.size === orderDetail.size);

            if (sizeIndex >= 0) {

                product.sizeId.sizes[sizeIndex].stock -= quantity;

                await product.sizeId.save();
            } else {
                console.log(`Không tìm thấy kích thước ${orderDetail.size} cho sản phẩm ${productId}`);
            }
        } else {
            await Product.updateOne({ _id: productId }, { $inc: { stock: -quantity } });
        }
    }
}

router.delete("/:id", function (req, res, next) {
    const validationSchema = yup.object().shape({
        params: yup.object({
            id: yup
                .string()
                .test("Validate ObjectID", "${path} is not valid ObjectID", (value) => {
                    return ObjectId.isValid(value);
                }),
        }),
    });

    validationSchema
        .validate({ params: req.params }, { abortEarly: false })
        .then(async () => {
            try {
                const id = req.params.id;

                let found = await Order.findByIdAndDelete(id);

                if (found) {
                    return res.send({ ok: true, result: found });
                }

                return res.status(410).send({ ok: false, message: "Object not found" });
            } catch (err) {
                return res.status(500).json({ error: err });
            }
        })
        .catch((err) => {
            return res.status(400).json({
                type: err.name,
                errors: err.errors,
                message: err.message,
                provider: "yup",
            });
        });
});


router.patch("/:id", async function (req, res, next) {
    try {
        const id = req.params.id;
        const data = req.body;
        await Order.findByIdAndUpdate(id, data);

        res.send({ ok: true, message: "Updated" });
    } catch (error) {
        res.status(500).send({ ok: false, error });
    }
});

router.patch("/return-stock/:orderId", async (req, res, next) => {
    try {
        const orderId = req.params.orderId;

        // Lấy thông tin đơn hàng được hủy từ orderId
        const cancelledOrder = await Order.findById(orderId);

        // Kiểm tra xem đơn hàng có tồn tại hay không
        if (!cancelledOrder) {
            return res.status(404).json({ message: "Đơn hàng không tồn tại" });
        }

        // Trả lại số lượng sản phẩm cho mỗi product trong orderDetails
        for (const orderDetail of cancelledOrder.orderDetails) {
            const productId = orderDetail.productId;
            const quantity = orderDetail.quantity;

            if (orderDetail.size) {
                const product = await Product.findOne({ _id: productId }).populate("sizeId")

                const sizeIndex = product.sizeId.sizes.findIndex(size => size.size === orderDetail.size);

                if (sizeIndex >= 0) {
                    product.sizeId.sizes[sizeIndex].stock += quantity;

                    await product.sizeId.save();
                } else {
                    console.log(`Không tìm thấy kích thước ${orderDetail.size} cho sản phẩm ${productId}`);
                }
            } else {
                await Product.updateOne(
                    { _id: productId },
                    { $inc: { stock: quantity } }
                );
            }
        }

        res.status(200).json({ message: "Đã hoàn trả số lượng sản phẩm thành công" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// ------------------VNPAY

router.post("/pay/create_vnpay_url", (req, res, next) => {
    const ipAddr =
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;

    const config = require("../config/default.json");
    const tmnCode = config.vnp_TmnCode;
    const secretKey = config.vnp_HashSecret;
    const vnpUrl = config.vnp_Url;
    const returnUrl = `${WEBSHOP_URL}/payment`;

    const date = moment();

    const createDate = date.format("YYYYMMDDHHmmss");
    const orderId = date.format("HHmmss");

    const amount = req.body.amount * 100;
    const bankCode = req.body.bankCode;

    let orderInfo = req.body.orderDescription;
    let orderType = req.body.orderType;
    let locale = req.body.language;
    if (!locale || locale === "") {
        locale = "vn";
    }
    const currCode = "VND";
    const vnp_Params = {
        vnp_Version: "2.1.0",
        vnp_Command: "pay",
        vnp_TmnCode: tmnCode,
        vnp_Locale: locale,
        vnp_CurrCode: currCode,
        vnp_TxnRef: orderId,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: orderType,
        vnp_Amount: amount,
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr: ipAddr,
        vnp_CreateDate: createDate,
        vnp_BankCode: "NCB",
    };

    const sortedParams = sortObject(vnp_Params);

    const signData = new URLSearchParams(sortedParams).toString();
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
    sortedParams["vnp_SecureHash"] = signed;
    const vnpUrlWithParams =
        vnpUrl + "?" + new URLSearchParams(sortedParams).toString();

    res.send({ urlPay: vnpUrlWithParams });
});

function sortObject(obj) {
    const sortedObj = {};
    Object.keys(obj)
        .sort()
        .forEach((key) => {
            sortedObj[key] = obj[key];
        });
    return sortedObj;
}

router.get("/vnpay_return", function (req, res, next) {
    let vnp_Params = req.query;

    let secureHash = vnp_Params["vnp_SecureHash"];

    delete vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHashType"];

    vnp_Params = sortObject(vnp_Params);

    let config = require("../config/vnpay/default.json");
    let tmnCode = config.vnp_TmnCode;
    let secretKey = config.vnp_HashSecret;

    let querystring = require("qs");
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let crypto = require("crypto");
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(new Buffer(signData, "utf-8")).digest("hex");

    if (secureHash === signed) {
        //Kiem tra xem du lieu trong db co hop le hay khong va thong bao ket qua

        res.render("success", { code: vnp_Params["vnp_ResponseCode"] });
    } else {
        res.render("success", { code: "97" });
    }
});

router.get("/vnpay_ipn", function (req, res, next) {
    let vnp_Params = req.query;
    let secureHash = vnp_Params["vnp_SecureHash"];

    let orderId = vnp_Params["vnp_TxnRef"];
    let rspCode = vnp_Params["vnp_ResponseCode"];

    delete vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHashType"];

    vnp_Params = sortObject(vnp_Params);
    let config = require("../config/vnpay/default.json");

    let secretKey = config.vnp_HashSecret;
    let querystring = require("qs");
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let crypto = require("crypto");
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(new Buffer(signData, "utf-8")).digest("hex");

    let paymentStatus = "0"; // Giả sử '0' là trạng thái khởi tạo giao dịch, chưa có IPN. Trạng thái này được lưu khi yêu cầu thanh toán chuyển hướng sang Cổng thanh toán VNPAY tại đầu khởi tạo đơn hàng.
    //let paymentStatus = '1'; // Giả sử '1' là trạng thái thành công bạn cập nhật sau IPN được gọi và trả kết quả về nó
    //let paymentStatus = '2'; // Giả sử '2' là trạng thái thất bại bạn cập nhật sau IPN được gọi và trả kết quả về nó

    let checkOrderId = true; // Mã đơn hàng "giá trị của vnp_TxnRef" VNPAY phản hồi tồn tại trong CSDL của bạn
    let checkAmount = true; // Kiểm tra số tiền "giá trị của vnp_Amout/100" trùng khớp với số tiền của đơn hàng trong CSDL của bạn
    if (secureHash === signed) {
        //kiểm tra checksum
        if (checkOrderId) {
            if (checkAmount) {
                if (paymentStatus == "0") {
                    //kiểm tra tình trạng giao dịch trước khi cập nhật tình trạng thanh toán
                    if (rspCode == "00") {
                        //thanh cong
                        //paymentStatus = '1'
                        // Ở đây cập nhật trạng thái giao dịch thanh toán thành công vào CSDL của bạn
                        res.status(200).json({ RspCode: "00", Message: "Success" });
                    } else {
                        //that bai
                        //paymentStatus = '2'
                        // Ở đây cập nhật trạng thái giao dịch thanh toán thất bại vào CSDL của bạn
                        res.redirect(`${WEBSHOP_URL}/check-out`);
                    }
                } else {
                    res.status(200).json({
                        RspCode: "02",
                        Message: "This order has been updated to the payment status",
                    });
                }
            } else {
                res.status(200).json({ RspCode: "04", Message: "Amount invalid" });
            }
        } else {
            res.status(200).json({ RspCode: "01", Message: "Order not found" });
        }
    } else {
        res.status(200).json({ RspCode: "97", Message: "Checksum failed" });
    }
});

router.post("/querydr", function (req, res, next) {
    process.env.TZ = "Asia/Ho_Chi_Minh";
    let date = new Date();

    let config = require("../config/vnpay/default.json");
    let crypto = require("crypto");

    let vnp_TmnCode = config.vnp_TmnCode;
    let secretKey = config.vnp_HashSecret;
    let vnp_Api = config.vnp_Api;

    let vnp_TxnRef = req.body.orderId;
    let vnp_TransactionDate = req.body.transDate;

    let vnp_RequestId = moment(date).format("HHmmss");
    let vnp_Version = "2.1.0";
    let vnp_Command = "querydr";
    let vnp_OrderInfo = "Truy van GD ma:" + vnp_TxnRef;

    let vnp_IpAddr =
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;

    let currCode = "VND";
    let vnp_CreateDate = moment(date).format("YYYYMMDDHHmmss");

    let data =
        vnp_RequestId +
        "|" +
        vnp_Version +
        "|" +
        vnp_Command +
        "|" +
        vnp_TmnCode +
        "|" +
        vnp_TxnRef +
        "|" +
        vnp_TransactionDate +
        "|" +
        vnp_CreateDate +
        "|" +
        vnp_IpAddr +
        "|" +
        vnp_OrderInfo;

    let hmac = crypto.createHmac("sha512", secretKey);
    let vnp_SecureHash = hmac.update(new Buffer(data, "utf-8")).digest("hex");

    let dataObj = {
        vnp_RequestId: vnp_RequestId,
        vnp_Version: vnp_Version,
        vnp_Command: vnp_Command,
        vnp_TmnCode: vnp_TmnCode,
        vnp_TxnRef: vnp_TxnRef,
        vnp_OrderInfo: vnp_OrderInfo,
        vnp_TransactionDate: vnp_TransactionDate,
        vnp_CreateDate: vnp_CreateDate,
        vnp_IpAddr: vnp_IpAddr,
        vnp_SecureHash: vnp_SecureHash,
    };
    // /merchant_webapi/api/transaction
    request(
        {
            url: vnp_Api,
            method: "POST",
            json: true,
            body: dataObj,
        },
        function (error, response, body) {
            console.log(response);
        }
    );
});

router.post("/refund", function (req, res, next) {
    process.env.TZ = "Asia/Ho_Chi_Minh";
    let date = new Date();

    let config = require("../config/vnpay/default.json");
    let crypto = require("crypto");

    let vnp_TmnCode = config.vnp_TmnCode;
    let secretKey = config.vnp_HashSecret;
    let vnp_Api = config.vnp_Api;

    let vnp_TxnRef = req.body.orderId;
    let vnp_TransactionDate = req.body.transDate;
    let vnp_Amount = req.body.amount * 100;
    let vnp_TransactionType = req.body.transType;
    let vnp_CreateBy = req.body.user;

    let currCode = "VND";

    let vnp_RequestId = moment(date).format("HHmmss");
    let vnp_Version = "2.1.0";
    let vnp_Command = "refund";
    let vnp_OrderInfo = "Hoan tien GD ma:" + vnp_TxnRef;

    let vnp_IpAddr =
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;

    let vnp_CreateDate = moment(date).format("YYYYMMDDHHmmss");

    let vnp_TransactionNo = "0";

    let data =
        vnp_RequestId +
        "|" +
        vnp_Version +
        "|" +
        vnp_Command +
        "|" +
        vnp_TmnCode +
        "|" +
        vnp_TransactionType +
        "|" +
        vnp_TxnRef +
        "|" +
        vnp_Amount +
        "|" +
        vnp_TransactionNo +
        "|" +
        vnp_TransactionDate +
        "|" +
        vnp_CreateBy +
        "|" +
        vnp_CreateDate +
        "|" +
        vnp_IpAddr +
        "|" +
        vnp_OrderInfo;
    let hmac = crypto.createHmac("sha512", secretKey);
    let vnp_SecureHash = hmac.update(new Buffer(data, "utf-8")).digest("hex");

    let dataObj = {
        vnp_RequestId: vnp_RequestId,
        vnp_Version: vnp_Version,
        vnp_Command: vnp_Command,
        vnp_TmnCode: vnp_TmnCode,
        vnp_TransactionType: vnp_TransactionType,
        vnp_TxnRef: vnp_TxnRef,
        vnp_Amount: vnp_Amount,
        vnp_TransactionNo: vnp_TransactionNo,
        vnp_CreateBy: vnp_CreateBy,
        vnp_OrderInfo: vnp_OrderInfo,
        vnp_TransactionDate: vnp_TransactionDate,
        vnp_CreateDate: vnp_CreateDate,
        vnp_IpAddr: vnp_IpAddr,
        vnp_SecureHash: vnp_SecureHash,
    };

    request(
        {
            url: vnp_Api,
            method: "POST",
            json: true,
            body: dataObj,
        },
        function (error, response, body) {
            console.log(response);
        }
    );
});

module.exports = router;
