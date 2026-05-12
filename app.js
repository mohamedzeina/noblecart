const path = require('path');
const fs = require('fs');
const https = require('https');


const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const mongoDBStore = require('connect-mongodb-session')(session);
const csrf = require('csurf');
const flash = require('connect-flash');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const adminRoutes = require('./routes/admin');
const adminAuthRoutes = require('./routes/admin-auth');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const errorController = require('./controllers/error');
const User = require('./models/user');
const Admin = require('./models/admin');


const fileStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'model') {
    cb(null, file.originalname.toLowerCase().endsWith('.glb'));
  } else if (['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const app = express();
const store = mongoDBStore({
  uri: process.env.MONGODB_URI,
  collection: 'sessions',
});
store.on('error', (err) => console.error('Session store error:', err));

const csrfProtection = csrf();

const sslKeyExists = fs.existsSync('server.key') && fs.existsSync('server.cert');
const privateKey = sslKeyExists ? fs.readFileSync('server.key') : null;
const certificate = sslKeyExists ? fs.readFileSync('server.cert') : null;

app.set('view engine', 'ejs');
app.set('views', 'views');

const accessLogStream = fs.createWriteStream(
  path.join(__dirname, 'access.log'),
  { flags: 'a' }
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://images.unsplash.com'],
        'script-src': ["'self'", 'https://js.stripe.com', 'https://ajax.googleapis.com', 'https://www.gstatic.com', 'https://cdn.jsdelivr.net'],
        'frame-src': ["'self'", 'https://js.stripe.com'],
        'style-src': ["'self'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'worker-src': ["'self'", 'blob:'],
        'connect-src': ["'self'", 'https://res.cloudinary.com', 'blob:', 'https://www.gstatic.com'],
      },
    },
  })
);
app.use(compression());
app.use(morgan('combined', { stream: accessLogStream }));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(
  multer({ storage: fileStorage, fileFilter }).fields([
    { name: 'image', maxCount: 1 },
    { name: 'model', maxCount: 1 },
    { name: 'avatar', maxCount: 1 },
  ])
);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

app.use(csrfProtection);

app.use(flash());

app.use((req, res, next) => {
  const loadUser = req.session.userId
    ? User.findById(req.session.userId).then((user) => { if (user) req.user = user; })
    : Promise.resolve();

  const loadAdmin = req.session.adminId
    ? Admin.findById(req.session.adminId).then((admin) => { if (admin) req.admin = admin; })
    : Promise.resolve();

  Promise.all([loadUser, loadAdmin])
    .then(() => next())
    .catch((err) => next(new Error(err)));
});

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.user !== undefined;
  res.locals.isAdmin = req.admin !== undefined;
  res.locals.currentUser = req.user || null;
  res.locals.csrfToken = req.csrfToken();
  res.locals.cartCount = req.user
    ? req.user.cart.items.reduce((sum, i) => sum + i.quantity, 0)
    : 0;
  res.locals.wishlistIds = req.user
    ? req.user.wishlist.map((i) => i.productId.toString())
    : [];
  res.locals.wishlistCount = req.user ? req.user.wishlist.length : 0;
  next();
});

app.use('/admin', adminAuthRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.use('/500', errorController.get500);
app.use(errorController.get404);

app.use((error, req, res, next) => {
  res.redirect('/500');
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to DB Successfully');
    const server = sslKeyExists
      ? https.createServer({ key: privateKey, cert: certificate }, app)
      : app;
    server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
      console.log(`Server listening on port ${process.env.PORT || 3000}`);
    });
   
  })
  .catch((err) => {
    console.log(err);
  });
