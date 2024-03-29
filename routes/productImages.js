// const fs = require('fs');
// const express = require('express');
// const router = express.Router();
// // MULTER UPLOAD
// const multer = require('multer');
// const {
//     updateDocument,
//     findDocument,
//     toSafeFileName,
//     insertDocument,
//     insertDocuments,
// } = require('../helpers/MongoDbHelper');

// const UPLOAD_DIRECTORY = './public/images/uploads';

// const upload = multer({
//     storage: multer.diskStorage({
//         contentType: multer.AUTO_CONTENT_TYPE,
//         destination: function (req, file, callback) {

//             const PATH = `${UPLOAD_DIRECTORY}/media/${file.fieldname}`;
//             if (!fs.existsSync(PATH)) {
//                 // Create a directory
//                 fs.mkdirSync(PATH, { recursive: true });
//             }
//             callback(null, PATH);
//         },
//         filename: function (req, file, callback) {
//             const safeFileName = toSafeFileName(file.originalname);
//             callback(null, safeFileName);
//         },
//     }),
// });

// router.post('/upload-single', (req, res) =>
//     upload.single('file')(req, res, async (err) => {
//         try {
//             if (err instanceof multer.MulterError) {
//                 res.status(500).json({ type: 'MulterError', err: err });
//             } else if (err) {
//                 res.status(500).json({ type: 'UnknownError', err: err });
//             } else {
//                 const imageUrl = `/uploads/media/${req.file.filename}`;
//                 const name = req.file.filename;

//                 const response = await insertDocument(
//                     { location: imageUrl, name },
//                     'Media',
//                 );
//                 res.status(200).json({ ok: true, payload: response });
//             }
//         } catch (error) {
//             console.log(error);
//             res.status(500).json({ ok: false, error });
//         }
//     }),
// );

// router.post('/upload-multiple', (req, res) =>
//     upload.array('files', 3)(req, res, async (err) => {
//         try {
//             if (err instanceof multer.MulterError) {
//                 res.status(500).json({ type: 'MulterError', err: err });
//             } else if (err) {
//                 res.status(500).json({ type: 'UnknownError', err: err });
//             } else {
//                 const files = req.files;

//                 const dataInsert = files.reduce((prev, nextP) => {
//                     prev.push({ name: nextP.filename, location: nextP.path });
//                     return prev;
//                 }, []);

//                 const response = await insertDocuments(dataInsert, 'Media');

//                 res.status(200).json({ ok: true, payload: response });
//             }
//         } catch (error) {
//             console.log(error);
//             res.status(500).json({ ok: false, error });
//         }
//     }),
// );

// router.get('/productImages/:id', async (req, res, next) => {
//     const { id } = req.params;

//     const found = await findDocument(id, 'Media');
//     if (!found) {
//         return res
//             .status(410)
//             .json({ message: `${collectionName} with id ${id} not found` });
//     }

//     res.status(200).json({ ok: true, payload: found });
// });

// router.post('/productImages/update/:id', async (req, res) => {
//     const { id } = req.params;

//     const found = await findDocument(id, 'Media');
//     if (!found) res.status(410).json({ message: `${collectionName} with id ${id} not found` });

//     upload.single('file')(req, res, async (err) => {
//         try {
//             if (err instanceof multer.MulterError) {
//                 res.status(500).json({ type: 'MulterError', err: err });
//             } else if (err) {
//                 res.status(500).json({ type: 'UnknownError', err: err });
//             } else {
//                 const imageUrl = `/uploads/media/${req.file.filename}`;
//                 const name = req.file.filename;

//                 const response = await updateDocument(
//                     { _id: id },
//                     {
//                         location: imageUrl,
//                         name,
//                     },
//                     'Media',
//                 );

//                 res.status(200).json({ ok: true, payload: response });
//             }
//         } catch (error) {
//             res.status(500).json({ ok: false, error });
//         }
//     });
// });

// module.exports = router;
const fs = require("fs");
const path = require("path");
const express = require("express");
const router = express.Router();
// MULTER UPLOAD
const multer = require("multer");
const { updateDocument, findDocument } = require("../helpers/MongoDbHelper");

const UPLOAD_DIRECTORY = "./public/uploads";

var upload = multer({
  storage: multer.diskStorage({
    contentType: multer.AUTO_CONTENT_TYPE,
    destination: function (req, file, callback) {
      const { id, collectionName } = req.params;

      const PATH = `${UPLOAD_DIRECTORY}/${collectionName}/${id}`;
      // console.log('PATH', PATH);
      if (!fs.existsSync(PATH)) {
        // Create a directory
        fs.mkdirSync(PATH, { recursive: true });
      }
      callback(null, PATH);
    },
    filename: function (req, file, callback) {
      const safeFileName = toSafeFileName(file.originalname);
      callback(null, safeFileName);
    },
  }),
}).single("file");

// http://127.0.0.1:9000/upload/categories/63293fea50d2f78624e0c6f3/image
router.post("/:collectionName/:id/image", async (req, res, next) => {
  const { collectionName, id } = req.params;

  const found = await findDocument(id, collectionName);
  if (!found) {
    return res
      .status(410)
      .json({ message: `${collectionName} with id ${id} not found` });
  }

  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      res.status(500).json({ type: "MulterError", err: err });
    } else if (err) {
      res.status(500).json({ type: "UnknownError", err: err });
    } else {
      // UPDATE MONGODB
      updateDocument(
        id,
        { imageUrl: `/uploads/${collectionName}/${id}/${req.file.filename}` },
        collectionName
      );
      //
      // console.log('host', req.get('host'));
      const publicUrl = `${req.protocol}://${req.get(
        "host"
      )}/uploads/${collectionName}/${id}/${req.file.filename}`;
      res.status(200).json({ ok: true, publicUrl: publicUrl });
    }
  });
});

// http://127.0.0.1:9000/upload/categories/63293fea50d2f78624e0c6f3/images
router.post("/:collectionName/:id/images", async (req, res, next) => {
  const { collectionName, id } = req.params;
  const found = await findDocument(id, collectionName);
  if (!found) {
    return res
      .status(410)
      .json({ message: `${collectionName} with id ${id} not found` });
  }

  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      res.status(500).json({ type: "MulterError", err: err });
    } else if (err) {
      res.status(500).json({ type: "UnknownError", err: err });
    } else {
      // UPDATE MONGODB
      const newImageUrl = `/uploads/${collectionName}/${id}/${req.file.filename}`;

      let images = found.images;
      if (!images) {
        images = [];
      }
      images.push(newImageUrl);

      await updateDocument(id, { images: images }, collectionName);

      // console.log('host', req.get('host'));
      const publicUrl = `${req.protocol}://${req.get(
        "host"
      )}/uploads/${collectionName}/${id}/${req.file.filename}`;
      res.status(200).json({ ok: true, publicUrl: publicUrl });
    }
  });
});

function toSafeFileName(fileName) {
  const fileInfo = path.parse(fileName);
  const safeFileName =
    fileInfo.name.replace(/[^a-z0-9]/gi, "-").toLowerCase() + fileInfo.ext;
  return safeFileName;
}

module.exports = router;