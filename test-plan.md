# Order Status — Test Plan

## 1. Setup
- [x] Log in as a customer and place an order through checkout
- [x] Log in as admin at `/admin/login`

---

## 2. Admin orders page — status dropdown
- [ ] Visit `/admin/orders` — new order appears with a **Pending** badge
- [ ] Dropdown beside it shows **Confirmed** and **Canceled** only
- [ ] Delivered and canceled orders have no dropdown

---

## 3. Status transition — happy path
- [ ] Select **Confirmed** — badge updates in place, toast appears, dropdown now shows Shipped + Canceled
- [ ] Select **Shipped** — badge updates, dropdown shows Out for delivery only
- [ ] Select **Out for delivery** — badge updates, dropdown shows Delivered only
- [ ] Select **Delivered** — badge updates, dropdown disappears (terminal state)

---

## 4. Cancel path
- [ ] Place a second order
- [ ] On admin orders, select **Canceled** — badge updates, dropdown disappears

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
