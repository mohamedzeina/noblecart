const cloudinary = require('./cloudinary');

const deleteFile = (publicId) => {
  if (!publicId) return;
  cloudinary.uploader.destroy(publicId).catch((err) => console.log('Cloudinary delete error:', err.message));
};

exports.deleteFile = deleteFile;
