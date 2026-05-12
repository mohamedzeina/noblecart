jest.mock('../../../models/order');
jest.mock('../../../util/cloudinary');
jest.mock('../../../util/file', () => ({ deleteFile: jest.fn() }));
jest.mock('bcryptjs');
jest.mock('country-state-city', () => ({
  Country: { getAllCountries: jest.fn(() => [{ name: 'United States', isoCode: 'US' }]) },
}));

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Order = require('../../../models/order');
const cloudinary = require('../../../util/cloudinary');
const fileHelper = require('../../../util/file');
const profileController = require('../../../controllers/profile');

function id() {
  return new mongoose.Types.ObjectId();
}

function makeRes() {
  return {
    render: jest.fn(),
    redirect: jest.fn(),
  };
}

function makeReq(overrides = {}) {
  const userId = id();
  return {
    body: {},
    files: {},
    flash: jest.fn().mockReturnValue([]),
    user: {
      _id: userId,
      email: 'test@test.com',
      name: 'Test User',
      password: 'hashed_password',
      avatar: '',
      avatarPublicId: '',
      wishlist: [],
      address: {},
      save: jest.fn().mockResolvedValue({}),
      updateOne: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

// ─── getProfile ───────────────────────────────────────────────────────────────

describe('getProfile', () => {
  it('renders profile with order count and wishlist count', async () => {
    Order.countDocuments = jest.fn().mockResolvedValue(3);
    const req = makeReq({ user: { ...makeReq().user, wishlist: [{ productId: id() }, { productId: id() }] } });
    const res = makeRes();

    await profileController.getProfile(req, res, jest.fn());

    expect(res.render).toHaveBeenCalledWith('shop/profile', expect.objectContaining({
      orderCount: 3,
      wishlistCount: 2,
    }));
  });

  it('renders with zero counts when no orders or wishlist', async () => {
    Order.countDocuments = jest.fn().mockResolvedValue(0);
    const req = makeReq();
    const res = makeRes();

    await profileController.getProfile(req, res, jest.fn());

    expect(res.render).toHaveBeenCalledWith('shop/profile', expect.objectContaining({
      orderCount: 0,
      wishlistCount: 0,
    }));
  });

  it('passes countries list to the view', async () => {
    Order.countDocuments = jest.fn().mockResolvedValue(0);
    const res = makeRes();

    await profileController.getProfile(makeReq(), res, jest.fn());

    const renderArgs = res.render.mock.calls[0][1];
    expect(Array.isArray(renderArgs.countries)).toBe(true);
    expect(renderArgs.countries.length).toBeGreaterThan(0);
  });

  it('calls next on error', async () => {
    Order.countDocuments = jest.fn().mockRejectedValue(new Error('DB error'));
    const next = jest.fn();

    await profileController.getProfile(makeReq(), makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── postUpdateProfile ────────────────────────────────────────────────────────

describe('postUpdateProfile', () => {
  it('redirects with error when name is empty', async () => {
    const req = makeReq({ body: { name: '   ' } });
    const res = makeRes();

    await profileController.postUpdateProfile(req, res, jest.fn());

    expect(req.flash).toHaveBeenCalledWith('profile_info_error', 'Name is required.');
    expect(res.redirect).toHaveBeenCalledWith('/profile#info');
    expect(req.user.save).not.toHaveBeenCalled();
  });

  it('updates name and redirects with success', async () => {
    const req = makeReq({ body: { name: 'New Name' } });
    const res = makeRes();

    await profileController.postUpdateProfile(req, res, jest.fn());

    expect(req.user.name).toBe('New Name');
    expect(req.user.save).toHaveBeenCalledTimes(1);
    expect(req.flash).toHaveBeenCalledWith('profile_info_success', 'Profile updated successfully.');
    expect(res.redirect).toHaveBeenCalledWith('/profile#info');
  });

  it('trims whitespace from name', async () => {
    const req = makeReq({ body: { name: '  Alice  ' } });
    const res = makeRes();

    await profileController.postUpdateProfile(req, res, jest.fn());

    expect(req.user.name).toBe('Alice');
  });

  it('uploads avatar and sets URL when file is provided', async () => {
    cloudinary.uploader.upload_stream = jest.fn((opts, cb) => ({
      end: jest.fn(() => cb(null, { secure_url: 'https://img.url/avatar.jpg', public_id: 'avatars/abc123' })),
    }));
    const req = makeReq({
      body: { name: 'Alice' },
      files: { avatar: [{ buffer: Buffer.from('img') }] },
    });
    const res = makeRes();

    await profileController.postUpdateProfile(req, res, jest.fn());

    expect(req.user.avatar).toBe('https://img.url/avatar.jpg');
    expect(req.user.avatarPublicId).toBe('avatars/abc123');
    expect(req.user.save).toHaveBeenCalledTimes(1);
  });

  it('deletes old avatar when uploading a new one', async () => {
    cloudinary.uploader.upload_stream = jest.fn((opts, cb) => ({
      end: jest.fn(() => cb(null, { secure_url: 'https://img.url/new.jpg', public_id: 'avatars/new' })),
    }));
    fileHelper.deleteFile.mockResolvedValue();
    const req = makeReq({
      body: { name: 'Alice' },
      files: { avatar: [{ buffer: Buffer.from('img') }] },
      user: { ...makeReq().user, avatarPublicId: 'avatars/old123' },
    });
    const res = makeRes();

    await profileController.postUpdateProfile(req, res, jest.fn());

    expect(fileHelper.deleteFile).toHaveBeenCalledWith('avatars/old123');
  });

  it('calls next on error', async () => {
    const req = makeReq({ body: { name: 'Alice' } });
    req.user.save.mockRejectedValue(new Error('DB error'));
    const next = jest.fn();

    await profileController.postUpdateProfile(req, res = makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── postUpdateAddress ────────────────────────────────────────────────────────

describe('postUpdateAddress', () => {
  const validAddress = {
    label: 'Home', street: '123 Main St', city: 'New York City',
    state: 'New York', stateCode: 'NY', zip: '10001',
    country: 'United States', countryCode: 'US',
  };

  it('saves address and redirects with success', async () => {
    const req = makeReq({ body: validAddress });
    const res = makeRes();

    await profileController.postUpdateAddress(req, res, jest.fn());

    expect(req.user.updateOne).toHaveBeenCalledWith({ address: validAddress });
    expect(req.flash).toHaveBeenCalledWith('profile_address_success', 'Address saved.');
    expect(res.redirect).toHaveBeenCalledWith('/profile#address');
  });

  it('accepts a fully empty submission (clear address)', async () => {
    const req = makeReq({ body: {} });
    const res = makeRes();

    await profileController.postUpdateAddress(req, res, jest.fn());

    expect(req.user.updateOne).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/profile#address');
  });

  it('rejects when label is missing but other fields are filled', async () => {
    const req = makeReq({ body: { ...validAddress, label: '' } });
    const res = makeRes();

    await profileController.postUpdateAddress(req, res, jest.fn());

    expect(req.flash).toHaveBeenCalledWith('profile_address_error', expect.stringContaining('label'));
    expect(req.user.updateOne).not.toHaveBeenCalled();
  });

  it('rejects when street is missing', async () => {
    const req = makeReq({ body: { ...validAddress, street: '' } });
    const res = makeRes();

    await profileController.postUpdateAddress(req, res, jest.fn());

    expect(req.flash).toHaveBeenCalledWith('profile_address_error', expect.stringContaining('street address'));
  });

  it('rejects when city is missing', async () => {
    const req = makeReq({ body: { ...validAddress, city: '' } });
    const res = makeRes();

    await profileController.postUpdateAddress(req, res, jest.fn());

    expect(req.flash).toHaveBeenCalledWith('profile_address_error', expect.stringContaining('city'));
  });

  it('rejects when country is missing', async () => {
    const req = makeReq({ body: { ...validAddress, country: '' } });
    const res = makeRes();

    await profileController.postUpdateAddress(req, res, jest.fn());

    expect(req.flash).toHaveBeenCalledWith('profile_address_error', expect.stringContaining('country'));
  });

  it('rejects when a field exceeds max length', async () => {
    const req = makeReq({ body: { ...validAddress, label: 'A'.repeat(51) } });
    const res = makeRes();

    await profileController.postUpdateAddress(req, res, jest.fn());

    expect(req.flash).toHaveBeenCalledWith('profile_address_error', 'One or more fields exceed the maximum allowed length.');
    expect(req.user.updateOne).not.toHaveBeenCalled();
  });

  it('calls next on error', async () => {
    const req = makeReq({ body: validAddress });
    req.user.updateOne.mockRejectedValue(new Error('DB error'));
    const next = jest.fn();

    await profileController.postUpdateAddress(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── postUpdatePassword ───────────────────────────────────────────────────────

describe('postUpdatePassword', () => {
  beforeEach(() => {
    bcrypt.compare = jest.fn().mockResolvedValue(true);
    bcrypt.hash = jest.fn().mockResolvedValue('new_hashed_password');
  });

  it('redirects with error when any field is missing', async () => {
    const req = makeReq({ body: { currentPassword: 'old', newPassword: '' } });
    const res = makeRes();

    await profileController.postUpdatePassword(req, res, jest.fn());

    expect(req.flash).toHaveBeenCalledWith('profile_security_error', 'All password fields are required.');
    expect(res.redirect).toHaveBeenCalledWith('/profile#security');
  });

  it('rejects new password shorter than 6 characters', async () => {
    const req = makeReq({ body: { currentPassword: 'old123', newPassword: 'abc', confirmPassword: 'abc' } });
    const res = makeRes();

    await profileController.postUpdatePassword(req, res, jest.fn());

    expect(req.flash).toHaveBeenCalledWith('profile_security_error', 'New password must be at least 6 characters.');
  });

  it('rejects new password longer than 128 characters', async () => {
    const long = 'a'.repeat(129);
    const req = makeReq({ body: { currentPassword: 'old123', newPassword: long, confirmPassword: long } });
    const res = makeRes();

    await profileController.postUpdatePassword(req, res, jest.fn());

    expect(req.flash).toHaveBeenCalledWith('profile_security_error', 'Password must be 128 characters or fewer.');
  });

  it('rejects when new password and confirm do not match', async () => {
    const req = makeReq({ body: { currentPassword: 'old123', newPassword: 'newpass1', confirmPassword: 'newpass2' } });
    const res = makeRes();

    await profileController.postUpdatePassword(req, res, jest.fn());

    expect(req.flash).toHaveBeenCalledWith('profile_security_error', 'New passwords do not match.');
  });

  it('rejects when current password is incorrect', async () => {
    bcrypt.compare = jest.fn().mockResolvedValue(false);
    const req = makeReq({ body: { currentPassword: 'wrongpass', newPassword: 'newpass1', confirmPassword: 'newpass1' } });
    const res = makeRes();

    await profileController.postUpdatePassword(req, res, jest.fn());

    expect(req.flash).toHaveBeenCalledWith('profile_security_error', 'Current password is incorrect.');
  });

  it('rejects when new password is the same as current', async () => {
    const req = makeReq({ body: { currentPassword: 'samepass', newPassword: 'samepass', confirmPassword: 'samepass' } });
    const res = makeRes();

    await profileController.postUpdatePassword(req, res, jest.fn());

    expect(req.flash).toHaveBeenCalledWith('profile_security_error', 'New password must be different from your current password.');
  });

  it('hashes the new password and updates via updateOne', async () => {
    const req = makeReq({ body: { currentPassword: 'oldpass1', newPassword: 'newpass1', confirmPassword: 'newpass1' } });
    const res = makeRes();

    await profileController.postUpdatePassword(req, res, jest.fn());

    expect(bcrypt.hash).toHaveBeenCalledWith('newpass1', 12);
    expect(req.user.updateOne).toHaveBeenCalledWith({ password: 'new_hashed_password' });
    expect(req.flash).toHaveBeenCalledWith('profile_security_success', 'Password updated successfully.');
    expect(res.redirect).toHaveBeenCalledWith('/profile#security');
  });

  it('calls next on error', async () => {
    bcrypt.compare = jest.fn().mockRejectedValue(new Error('bcrypt error'));
    const req = makeReq({ body: { currentPassword: 'old', newPassword: 'newpass1', confirmPassword: 'newpass1' } });
    const next = jest.fn();

    await profileController.postUpdatePassword(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
