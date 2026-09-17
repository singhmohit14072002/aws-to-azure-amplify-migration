import { randomUUID } from "node:crypto";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import mysql from "mysql2/promise";

const secrets = new SecretsManagerClient({});
let connectionConfig: mysql.ConnectionOptions | undefined;
const seedProducts = [
  [1, "Hand-thrown mug", "Home", 28, "Bestseller", "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=700&q=80"],
  [2, "Linen throw", "Home", 86, "New", "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=700&q=80"],
  [3, "Everyday tote", "Wear", 48, "", "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=700&q=80"],
  [4, "Oak catchall", "Objects", 34, "", "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=700&q=80"],
  [5, "Ribbed tumbler", "Home", 22, "", "https://images.unsplash.com/photo-1577937927133-66ef06acdf18?auto=format&fit=crop&w=700&q=80"],
  [6, "Soft cotton shirt", "Wear", 72, "New", "https://images.unsplash.com/photo-1603252110481-7ba873bf42ab?auto=format&fit=crop&w=700&q=80"],
  [7, "Stoneware vase", "Objects", 54, "", "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=700&q=80"],
  [8, "Wool house socks", "Wear", 24, "", "https://images.unsplash.com/photo-1582966772680-860e372bb558?auto=format&fit=crop&w=700&q=80"],
];

async function getConnectionConfig() {
  if (connectionConfig) return connectionConfig;
  const response = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN }));
  const credentials = JSON.parse(response.SecretString ?? "{}");
  connectionConfig = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    database: process.env.DB_NAME,
    user: credentials.username,
    password: credentials.password,
    ssl: { rejectUnauthorized: true },
  };
  return connectionConfig;
}

async function ensureSchema(connection: mysql.Connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS products (id INT PRIMARY KEY, name VARCHAR(255) NOT NULL, category VARCHAR(80) NOT NULL, price DECIMAL(10,2) NOT NULL, tag VARCHAR(80), image_url TEXT NOT NULL)`);
  await connection.query(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await connection.query(`CREATE TABLE IF NOT EXISTS carts (user_id VARCHAR(255) NOT NULL, product_id INT NOT NULL, quantity INT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (user_id, product_id), FOREIGN KEY (product_id) REFERENCES products(id))`);
  await connection.query(`CREATE TABLE IF NOT EXISTS orders (id CHAR(36) PRIMARY KEY, user_id VARCHAR(255) NOT NULL, total DECIMAL(10,2) NOT NULL, status VARCHAR(40) NOT NULL DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await connection.query(`CREATE TABLE IF NOT EXISTS order_items (id INT AUTO_INCREMENT PRIMARY KEY, order_id CHAR(36) NOT NULL, product_id INT NOT NULL, quantity INT NOT NULL, unit_price DECIMAL(10,2) NOT NULL, FOREIGN KEY (order_id) REFERENCES orders(id), FOREIGN KEY (product_id) REFERENCES products(id))`);
  await connection.query(`CREATE TABLE IF NOT EXISTS image_uploads (id CHAR(36) PRIMARY KEY, user_id VARCHAR(255) NOT NULL, s3_key VARCHAR(500) NOT NULL, content_type VARCHAR(120), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  for (const product of seedProducts) {
    await connection.query("INSERT IGNORE INTO products (id, name, category, price, tag, image_url) VALUES (?, ?, ?, ?, ?, ?)", product);
  }
}

function parseBody(event: { body?: string; isBase64Encoded?: boolean }) {
  if (!event.body) return {};
  const body = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(body);
}

function result(statusCode: number, body: unknown) {
  return { statusCode, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) };
}

export const handler = async (event: { httpMethod?: string; path?: string; body?: string; isBase64Encoded?: boolean }) => {
  const method = event.httpMethod ?? "GET";
  const path = (event.path ?? "").replace(/^\/prod/, "");
  const body = parseBody(event);
  const connection = await mysql.createConnection(await getConnectionConfig());

  try {
    await ensureSchema(connection);

    if (method === "GET" && path === "/products") {
      const [rows] = await connection.query("SELECT id, name, category, price, tag, image_url AS image FROM products ORDER BY id");
      return result(200, rows);
    }
    if (method === "POST" && path === "/newsletter") {
      if (!body.email || typeof body.email !== "string") return result(400, { message: "A valid email is required." });
      await connection.execute("INSERT INTO newsletter_subscribers (email) VALUES (?) ON DUPLICATE KEY UPDATE email = VALUES(email)", [body.email.trim().toLowerCase()]);
      return result(201, { message: "Subscriber saved." });
    }
    if ((method === "GET" || method === "POST" || method === "DELETE") && path === "/cart") {
      const userId = body.userId || "guest";
      if (method === "GET") {
        const [rows] = await connection.execute("SELECT c.product_id AS id, p.name, p.category, p.price, p.tag, p.image_url AS image, c.quantity FROM carts c JOIN products p ON p.id = c.product_id WHERE c.user_id = ?", [userId]);
        return result(200, rows);
      }
      if (method === "DELETE") {
        await connection.execute("DELETE FROM carts WHERE user_id = ?", [userId]);
        return result(204, { message: "Cart cleared." });
      }
      if (!body.productId || Number(body.quantity) < 1) return result(400, { message: "productId and a positive quantity are required." });
      await connection.execute("INSERT INTO carts (user_id, product_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)", [userId, body.productId, body.quantity]);
      return result(201, { message: "Cart saved." });
    }
    if (method === "POST" && path === "/orders") {
      if (!Array.isArray(body.items) || body.items.length === 0) return result(400, { message: "At least one order item is required." });
      const productIds = body.items.map((item: { id: number }) => item.id);
      const placeholders = productIds.map(() => "?").join(",");
      const [products] = await connection.query<mysql.RowDataPacket[]>(`SELECT id, price FROM products WHERE id IN (${placeholders})`, productIds);
      const prices = new Map(products.map((product) => [Number(product.id), Number(product.price)]));
      const items = body.items.map((item: { id: number; quantity: number }) => ({ ...item, price: prices.get(Number(item.id)) })).filter((item: { price?: number }) => item.price !== undefined);
      if (items.length !== body.items.length) return result(400, { message: "One or more products do not exist." });
      const total = items.reduce((sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity, 0);
      const orderId = randomUUID();
      await connection.beginTransaction();
      await connection.execute("INSERT INTO orders (id, user_id, total) VALUES (?, ?, ?)", [orderId, body.userId || "guest", total]);
      for (const item of items) await connection.execute("INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)", [orderId, item.id, item.quantity, item.price]);
      await connection.commit();
      return result(201, { orderId, total, status: "pending" });
    }
    if (method === "POST" && path === "/image-metadata") {
      if (!body.s3Key) return result(400, { message: "s3Key is required." });
      await connection.execute("INSERT INTO image_uploads (id, user_id, s3_key, content_type) VALUES (?, ?, ?, ?)", [randomUUID(), body.userId || "guest", body.s3Key, body.contentType || null]);
      return result(201, { message: "Image metadata saved." });
    }
    return result(404, { message: "Route not found." });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    return result(500, { message: "The database operation failed." });
  } finally {
    await connection.end();
  }
};
