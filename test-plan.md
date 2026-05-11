# Admin/Customer Separation — Test Plan

## 1. Setup
- [x] Add `ADMIN_EMAIL` and `ADMIN_PASSWORD` to `nodemon.json`
- [x] Run `npm run seed:admin` — should print `Admin created: test@admin.com`
- [x] Run it again — should print `Admin already exists.` and exit

---

## 2. Admin login
- [x] Visit `/admin/login` — see the Admin Portal page with no nav bar
- [x] Submit wrong credentials — see error message, stay on page
- [x] Submit correct credentials (`test@admin.com` / `admin123`) — redirect to `/admin/orders`

## 3. Admin navigation
- [x] After login: nav shows account icon with dropdown only (no cart, no wishlist, no category links)
- [x] Dropdown shows Manage Products, Manage Orders, Logout
- [x] Category links (Electronics, Fashion...) are hidden

## 4. Admin route protection
- [ ] While logged in as admin, visit `/admin/products` — loads correctly
- [ ] While logged in as admin, visit `/admin/orders` — loads correctly
- [ ] While logged in as admin, add a new product — saves successfully
- [ ] While logged in as admin, delete a product — removes it

## 5. Admin logout
- [ ] Click Logout — redirects to `/admin/login`
- [ ] After logout, visit `/admin/orders` — redirects back to `/admin/login`

---

## 6. Customer signup & login
- [ ] Visit `/signup` — register a new customer account
- [ ] Login at `/login` — redirect to `/`
- [ ] Nav shows search, wishlist, cart, account dropdown (Orders, Logout)
- [ ] Nav shows category links (Electronics, Fashion, Home, Accessories)

## 7. Customer route protection
- [ ] While logged in as customer, visit `/admin/products` — see 403 Access Denied
- [ ] While logged in as customer, visit `/admin/orders` — see 403 Access Denied
- [ ] While logged in as customer, visit `/admin/login` — page loads (it's public)

## 8. Customer shopping flow
- [ ] Add a product to cart — cart badge updates
- [ ] Add a product to wishlist — heart fills, wishlist badge updates
- [ ] Visit `/orders` — loads order history
- [ ] Visit `/wishlist` — shows wishlisted products

## 9. Customer logout
- [ ] Click Logout — redirects to `/`
- [ ] After logout, visit `/orders` — redirects to `/login`
- [ ] After logout, visit `/wishlist` — redirects to `/login`

---

## 10. Public (not logged in)
- [ ] Nav shows search, Login, Signup only
- [ ] Visit `/admin/orders` — redirects to `/admin/login`
- [ ] Visit `/orders` — redirects to `/login`
