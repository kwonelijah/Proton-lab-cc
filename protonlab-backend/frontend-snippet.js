// frontend-snippet.js
// Drop this into protonlab.cc — call handleCheckout() when customer clicks Buy
// Works for single product or a cart of multiple items

async function handleCheckout(items) {
  // Example items format:
  // [{ name: 'ProtonLab Kit', description: 'Standard kit', price: 4999, quantity: 1 }]
  // price is in cents — $49.99 = 4999

  try {
    const res = await fetch('https://your-vercel-project.vercel.app/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        customerEmail: null, // optional — pre-fills the Stripe checkout form
        customerName: null,  // optional
      }),
    });

    const { url, error } = await res.json();

    if (error) {
      console.error('Checkout error:', error);
      alert('Something went wrong. Please try again.');
      return;
    }

    // Redirect to Stripe's hosted checkout page
    window.location.href = url;

  } catch (err) {
    console.error('Network error:', err);
    alert('Could not connect to payment server.');
  }
}

// ─── Example usage on a Buy Now button ────────────────────────────────────

document.getElementById('buy-btn').addEventListener('click', () => {
  handleCheckout([
    { name: 'ProtonLab Kit', price: 4999, quantity: 1 }
  ]);
});

// ─── Example usage for a cart ─────────────────────────────────────────────

document.getElementById('checkout-btn').addEventListener('click', () => {
  // Pull items from your cart state
  const cartItems = getCartItems(); // your own cart logic
  handleCheckout(cartItems);
});
