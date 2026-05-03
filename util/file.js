const cloudinary = require('./cloudinary');

const deleteFile = (publicId) => {
  if (!publicId) return;
  cloudinary.uploader.destroy(publicId, (err) => {
    if (err) throw err;
  });
};

exports.deleteFile = deleteFile;
