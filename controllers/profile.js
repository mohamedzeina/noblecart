const bcrypt = require('bcryptjs');
const { Country } = require('country-state-city');
const cloudinary = require('../util/cloudinary');
const fileHelper = require('../util/file');
const Order = require('../models/order');

const ALL_COUNTRIES = Country.getAllCountries().map(c => ({ name: c.name, isoCode: c.isoCode }));

function uploadAvatar(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'noblecart-avatars', transformation: [{ width: 200, height: 200, crop: 'fill', gravity: 'face' }] },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

function flash(req, section, type, msg) {
  req.flash(`profile_${section}_${type}`, msg);
}

function readFlash(req, section) {
  const success = req.flash(`profile_${section}_success`);
  const error   = req.flash(`profile_${section}_error`);
  return {
    success: success.length ? success[0] : null,
    error:   error.length   ? error[0]   : null,
  };
}

exports.getProfile = async (req, res, next) => {
  try {
    const orderCount = await Order.countDocuments({ 'user.userId': req.user._id });
    const memberSince = req.user._id.getTimestamp();
    const wishlistCount = req.user.wishlist ? req.user.wishlist.length : 0;

    res.render('shop/profile', {
      path: '/profile',
      pageTitle: 'My Profile',
      user: req.user,
      orderCount,
      wishlistCount,
      memberSince,
      countries: ALL_COUNTRIES,
      infoMsg:     readFlash(req, 'info'),
      addressMsg:  readFlash(req, 'address'),
      securityMsg: readFlash(req, 'security'),
    });
  } catch (err) {
    next(err);
  }
};

exports.postUpdateProfile = async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) {
      flash(req, 'info', 'error', 'Name is required.');
      return res.redirect('/profile#info');
    }

    const avatarFile = req.files && req.files.avatar ? req.files.avatar[0] : null;
    if (avatarFile) {
      const oldPublicId = req.user.avatarPublicId;
      const result = await uploadAvatar(avatarFile.buffer);
      req.user.avatar = result.secure_url;
      req.user.avatarPublicId = result.public_id;
      if (oldPublicId) fileHelper.deleteFile(oldPublicId).catch(() => {});
    }

    req.user.name = name;
    await req.user.save();
    flash(req, 'info', 'success', 'Profile updated successfully.');
    res.redirect('/profile#info');
  } catch (err) {
    next(err);
  }
};

exports.postUpdateAddress = async (req, res, next) => {
  try {
    const label       = (req.body.label       || '').trim();
    const street      = (req.body.street      || '').trim();
    const city        = (req.body.city        || '').trim();
    const state       = (req.body.state       || '').trim();
    const stateCode   = (req.body.stateCode   || '').trim();
    const zip         = (req.body.zip         || '').trim();
    const country     = (req.body.country     || '').trim();
    const countryCode = (req.body.countryCode || '').trim();

    const hasAnyField = label || street || city || state || zip || country;
    if (hasAnyField && (!label || !street || !city || !country)) {
      const missing = [!label && 'label', !street && 'street address', !city && 'city', !country && 'country']
        .filter(Boolean).join(', ');
      flash(req, 'address', 'error', `Please fill in the required fields: ${missing}.`);
      return res.redirect('/profile#address');
    }
    if (label.length > 50 || street.length > 200 || city.length > 100 ||
        state.length > 100 || zip.length > 20 || country.length > 100) {
      flash(req, 'address', 'error', 'One or more fields exceed the maximum allowed length.');
      return res.redirect('/profile#address');
    }

    await req.user.updateOne({ address: { label, street, city, state, stateCode, zip, country, countryCode } });
    flash(req, 'address', 'success', 'Address saved.');
    res.redirect('/profile#address');
  } catch (err) {
    next(err);
  }
};

exports.postUpdatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      flash(req, 'security', 'error', 'All password fields are required.');
      return res.redirect('/profile#security');
    }
    if (newPassword.length < 6) {
      flash(req, 'security', 'error', 'New password must be at least 6 characters.');
      return res.redirect('/profile#security');
    }
    if (newPassword.length > 128) {
      flash(req, 'security', 'error', 'Password must be 128 characters or fewer.');
      return res.redirect('/profile#security');
    }
    if (newPassword !== confirmPassword) {
      flash(req, 'security', 'error', 'New passwords do not match.');
      return res.redirect('/profile#security');
    }

    const doMatch = await bcrypt.compare(currentPassword, req.user.password);
    if (!doMatch) {
      flash(req, 'security', 'error', 'Current password is incorrect.');
      return res.redirect('/profile#security');
    }

    if (newPassword === currentPassword) {
      flash(req, 'security', 'error', 'New password must be different from your current password.');
      return res.redirect('/profile#security');
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await req.user.updateOne({ password: hashed });
    flash(req, 'security', 'success', 'Password updated successfully.');
    res.redirect('/profile#security');
  } catch (err) {
    next(err);
  }
};
