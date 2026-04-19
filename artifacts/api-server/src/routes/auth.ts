import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { JWT_SECRET, requireAuth } from "../middlewares/auth";

const router = Router();

router.post("/auth/register", async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    res.status(400).json({ error: "validation_error", message: "email, username, and password are required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "validation_error", message: "Password must be at least 6 characters" });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase().trim(),
      username: username.trim(),
      passwordHash,
    }).returning();

    const token = jwt.sign(
      { userId: user.id, email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user: { id: user.id, email: user.email, username: user.username } });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "conflict", message: "Email or username already taken" });
      return;
    }
    logger.error({ err }, "Failed to register user");
    res.status(500).json({ error: "internal_error", message: "Registration failed" });
  }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "validation_error", message: "email and password are required" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));
    if (!user) {
      res.status(401).json({ error: "unauthorized", message: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "unauthorized", message: "Invalid email or password" });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user: { id: user.id, email: user.email, username: user.username } });
  } catch (err) {
    logger.error({ err }, "Failed to login");
    res.status(500).json({ error: "internal_error", message: "Login failed" });
  }
});

router.get("/auth/me", requireAuth, async (req, res) => {
  res.json({
    id: (req as any).userId,
    email: (req as any).userEmail,
    username: (req as any).username,
  });
});

export default router;
