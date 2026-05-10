const cloudinary = require('./cloudinary');

const deleteFile = (publicId) => {
  if (!publicId) return;
  cloudinary.uploader.destroy(publicId).catch((err) => console.log('Cloudinary delete error:', err.message));
};

const deleteModel = (publicId) => {
  if (!publicId) return;
  cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }).catch((err) => console.log('Cloudinary model delete error:', err.message));
};

exports.deleteFile = deleteFile;
exports.deleteModel = deleteModel;
