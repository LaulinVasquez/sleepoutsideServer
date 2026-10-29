
import { Router } from "express";
import { login, register } from "../services/user.service.mts";
import authorize from "../middleware/authorize.mts";

const router: Router = Router();

router.get("/protected", authorize, (req, res) => {
  const user = res.locals.user as { email?: string };
  res.json({ message: `Hello, ${user.email ?? "user"}!, the token is workiiiing!!!` });
});


router.post("/", async (req, res, next): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof name !== "string"
    ) {
      res.status(400).json({
        message: "Email, password, and name are required",
      });
      return;
    }

    const user = await register(email, password, name);

    res.status(201).json({
      message: "User created successfully",
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", async (req, res, next): Promise<void> => {
  try {
    const { email: rawEmail, password: rawPassword } = req.body;

    if (typeof rawEmail !== "string" || typeof rawPassword !== "string") {
      res.status(400).json({ message: "A valid email and password are required" });
      return;
    }

    const email = rawEmail.trim().toLowerCase();
    const password = rawPassword;

    if (!email || !password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const result = await login(email, password);

    if (!result) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});



export default router;