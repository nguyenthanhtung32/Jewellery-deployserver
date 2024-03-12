const express = require('express');
const router = express.Router();

const { validateSchema } = require('../helpers/utils');
const {
    getDetailSchema,
    removeSchema,
    createSchema,
    updateSchema,
    removeAllSchema
} = require('../validation/cart');
const {
    getDetail,
    create,
    update,
    remove,
    removeAllProducts
} = require('./controller');

router.route('/')
    .post(validateSchema(createSchema), create)

router.route('/:id')
    .get(validateSchema(getDetailSchema), getDetail)

router.route('/:customerId/:productId')
    .patch(validateSchema(updateSchema), update);

router.route('/:customerId/:productId')
    .delete(validateSchema(removeSchema), remove)

router.route('/:customerId')
    .delete(validateSchema(removeAllSchema), removeAllProducts)

module.exports = router;