# Admin Dashboard — Test Checklist

## Access
- Log in as admin
- Click **Dashboard** in the nav (new link, first item)
- URL: `/admin/dashboard`

## KPI Row
- [ ] 4 cards visible: Total Revenue, Paid Orders, Avg Order Value, Products Listed
- [ ] Numbers are correct (cross-check with orders/products pages)
- [ ] Hover lifts each card slightly

## Top Products table
- [ ] Shows up to 5 products ranked by revenue
- [ ] Units sold and revenue columns are correct
- [ ] Row highlights on hover
- [ ] Shows "No sales data yet." if no orders exist

## Orders by Status breakdown
- [ ] Each status has a colored progress bar
- [ ] Bar widths are proportional to count
- [ ] Canceled orders shown in red, delivered in green, etc.

## Recent Orders table
- [ ] Shows last 5 orders (newest first)
- [ ] Status badges match colors from the orders page
- [ ] "View all orders →" link navigates to `/admin/orders`
- [ ] Row highlights on hover

## Edge cases
- [ ] Dashboard loads correctly with zero orders (all sections show empty states)
- [ ] Canceled orders are excluded from Revenue, Paid Orders, Avg Order Value, and Top Products
