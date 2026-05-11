# Order Status — Test Plan

## 1. Setup
- [x] Log in as a customer and place an order through checkout
- [x] Log in as admin at `/admin/login`

---

## 2. Admin orders page — action buttons
- [ ] Visit `/admin/orders` — new order appears with a **Pending** badge
- [ ] Buttons beside it show **Confirmed** and **Canceled** only
- [ ] Delivered and canceled orders have no buttons

---

## 3. Status transition — happy path
- [ ] Click **Confirmed** → confirm → badge updates, buttons now show Shipped + Canceled
- [ ] Click **Shipped** → confirm → badge updates, button shows Out for delivery only
- [ ] Click **Out for delivery** → confirm → badge updates, button shows Delivered only
- [ ] Click **Delivered** → confirm → badge updates, no buttons (terminal state)

---

## 4. Cancel path
- [ ] Place a second order
- [ ] Click **Canceled** → confirm → badge updates, no buttons

---

## 5. Customer orders page — badge
- [ ] Visit `/orders` as customer — each order shows status badge beside the order ID
- [ ] Delivered order shows green **delivered** badge
- [ ] Canceled order shows gray **canceled** badge

---

## 6. Tracking stepper
- [ ] Open a fully delivered order — all 5 steps filled with timestamps
- [ ] Open the canceled order — steps up to cancellation filled, red × Canceled step, no future steps
- [ ] Open a fresh pending order — only Order Placed filled, rest grayed with no timestamps
