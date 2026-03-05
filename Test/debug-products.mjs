import fetch from 'node-fetch'

// Login first
const auth = await fetch('http://127.0.0.1:4000/api/auth/signin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'john@example.com', password: 'password123' })
})
const { accessToken } = await auth.json()
console.log('Token obtained:', accessToken ? 'YES (' + accessToken.slice(0,20) + '...)' : 'NO')

// Get product
const pr = await fetch('http://127.0.0.1:4000/api/products?limit=1&isActive=true')
const pd = await pr.json()
const product = pd?.products?.[0] ?? pd?.[0]
const productId = product?.id ?? product?._id
console.log('Product ID:', productId, ' price:', product?.price)

// Try creating an order
const or = await fetch('http://127.0.0.1:4000/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({
    items: [{ productId, quantity: 1 }],
    paymentMethod: 'upi_prepaid',
    shippingAddress: {
      fullName: 'Test User', phone: '9876543210', email: 'john@example.com',
      addressLine1: '12 Main St', city: 'Delhi', state: 'Delhi',
      zipCode: '110001', country: 'India', addressType: 'home'
    },
    useShippingAsBilling: true
  })
})
const od = await or.json()
console.log('Order status:', or.status)
console.log('Order response:', JSON.stringify(od, null, 2).slice(0, 800))

