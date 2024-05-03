const express = require('express');
const yup = require('yup');
const ObjectId = require("mongodb").ObjectId;
const { CONNECTION_STRING } = require('../constants/dbSettings');
const { default: mongoose } = require('mongoose');
const { Product } = require('../models');

// MONGOOSE
mongoose.set('strictQuery', false);
mongoose.connect(CONNECTION_STRING);

const router = express.Router();

//GEt ALL
router.get('/', function (req, res, next) {
    try {
        Product.find()
            .populate("category")
            .populate("size")
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
router.get('/:id', async function (req, res, next) {
    // Validate
    const validationSchema = yup.object().shape({
        params: yup.object({
            id: yup.string().test('Validate ObjectID', '${path} is not valid ObjectID', (value) => {
                return ObjectId.isValid(value);
            }),
        }),
    });

    validationSchema
        .validate({ params: req.params }, { abortEarly: false })
        .then(async () => {
            const id = req.params.id;

            let found = await Product.findById(id).populate("category")
                .populate("size");
                
            if (found) {
                return res.send({ ok: true, result: found });
            }

            return res.send({ ok: false, message: 'Object not found' });
        })
        .catch((err) => {
            return res.status(400).json({ type: err.name, errors: err.errors, message: err.message, provider: 'yup' });
        });
});

//POST
router.post('/', async function (req, res, next) {
    // Validate
    const validationSchema = yup.object({
        body: yup.object({
            productName: yup.string().required(),
            code: yup.string().required(),
            price: yup.number().min(0).required(),
            discount: yup.number().min(0).max(100).required(),
            stock: yup.number().min(0),
            categoryId: yup
                .string()
                .required()
                .test("Validate ObjectID", "${path} is not valid ObjectID", (value) => {
                    return ObjectId.isValid(value);
                }),
            sizeId: yup
                .string()
        }),
    });

    validationSchema
        .validate({ body: req.body }, { abortEarly: false })
        .then(async () => {
            try {
                const data = req.body;
                const newItem = new Product(data);
                let result = await newItem.save();

                return res.send({ ok: true, message: 'Created', result });
            } catch (err) {
                return res.status(500).json({ error: err });
            }
        })
        .catch((err) => {
            return res.status(400).json({ type: err.name, errors: err.errors, provider: 'yup' });
        });
});

//DELETE
router.delete('/:id', function (req, res, next) {
    const validationSchema = yup.object().shape({
        params: yup.object({
            id: yup.string().test('Validate ObjectID', '${path} is not valid ObjectID', (value) => {
                return ObjectId.isValid(value);
            }),
        }),
    });

    validationSchema
        .validate({ params: req.params }, { abortEarly: false })
        .then(async () => {
            try {
                const id = req.params.id;

                let found = await Product.findByIdAndDelete(id);

                if (found) {
                    return res.send({ ok: true, result: found });
                }

                return res.status(410).send({ ok: false, message: 'Object not found' });
            } catch (err) {
                return res.status(500).json({ error: err });
            }
        })
        .catch((err) => {
            return res.status(400).json({ type: err.name, errors: err.errors, message: err.message, provider: 'yup' });
        });
});

router.patch("/:id", async function (req, res) {
    try {
        const id = req.params.id;
        const data = req.body;
        await Product.findByIdAndUpdate(id, data);
        res.send({ ok: true, message: "Updated" });
    } catch (error) {
        res.status(500).send({ ok: false, error });
    }
});

module.exports = router;
