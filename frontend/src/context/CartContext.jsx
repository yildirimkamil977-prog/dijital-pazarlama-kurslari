import { createContext, useContext, useEffect, useState } from "react";
import { trackAddToCart } from "@/lib/track";

const CartContext = createContext(null);
const KEY = "akademi_cart";

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const add = (course) => {
    const price = course.discount_price != null ? course.discount_price : course.price;
    setItems((prev) => {
      if (prev.find((i) => i.course_id === course.course_id)) return prev;
      return [...prev, {
        course_id: course.course_id, title: course.title, slug: course.slug,
        thumbnail: course.thumbnail, price, original_price: course.price,
      }];
    });
    trackAddToCart({ id: course.course_id, title: course.title, price });
  };

  const remove = (course_id) => setItems((prev) => prev.filter((i) => i.course_id !== course_id));
  const clear = () => setItems([]);
  const has = (course_id) => items.some((i) => i.course_id === course_id);
  const subtotal = items.reduce((s, i) => s + (i.price || 0), 0);

  return (
    <CartContext.Provider value={{ items, add, remove, clear, has, subtotal, count: items.length }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
