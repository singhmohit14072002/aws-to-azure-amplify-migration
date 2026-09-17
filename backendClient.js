import { uploadData } from "aws-amplify/storage";

const apiUrl = process.env.EXPO_PUBLIC_RDS_API_URL;
const guestId = `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function getProducts() {
  if (!apiUrl) return null;
  const response = await fetch(`${apiUrl}products`);
  if (!response.ok) throw new Error("Could not load products.");
  return response.json();
}

export async function saveNewsletterSubscriber(email) {
  if (!apiUrl) throw new Error("EXPO_PUBLIC_RDS_API_URL is not configured.");
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw new Error("Could not save the subscriber.");
  return response.json();
}

export async function uploadUserImage(uri, fileName, contentType = "image/jpeg") {
  const response = await fetch(uri);
  const blob = await response.blob();
  const upload = await uploadData({
    path: `user-images/${fileName}`,
    data: blob,
    options: { contentType },
  }).result;
  await saveImageMetadata(upload.path, contentType);
  return upload;
}

export async function saveCart(items) {
  if (!apiUrl) return;
  if (items.length === 0) {
    await fetch(`${apiUrl}cart?userId=${guestId}`, { method: "DELETE" });
    return;
  }
  await Promise.all(items.map((item) => fetch(`${apiUrl}cart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: guestId, productId: item.id, quantity: item.quantity }),
  })));
}

export async function createOrder(items) {
  if (!apiUrl) throw new Error("EXPO_PUBLIC_RDS_API_URL is not configured.");
  const response = await fetch(`${apiUrl}orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: guestId, items }),
  });
  if (!response.ok) throw new Error("Could not save the order.");
  return response.json();
}

async function saveImageMetadata(s3Key, contentType) {
  if (!apiUrl) return;
  await fetch(`${apiUrl}image-metadata`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: guestId, s3Key, contentType }),
  });
}
