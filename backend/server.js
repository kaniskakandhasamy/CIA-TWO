require("dotenv").config();

const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;

const User = require("./models/User");
const Book = require("./models/Book");

const app = express();
const databaseName = process.env.MONGODB_DB || "beginner_books_crud";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      dbName: databaseName,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 20,
    },
  })
);

async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing");
  }

  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is missing");
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: databaseName,
  });

  console.log("MongoDB connected");
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Please login" });
  }

  next();
}

function cleanEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function cleanText(value) {
  return String(value || "").trim();
}

function getBookInput(body, partial = false) {
  const fields = {};

  if (!partial || body.title !== undefined) {
    const title = cleanText(body.title);

    if (!title) return { error: "Title is required" };
    if (title.length > 120)
      return { error: "Title must be 120 characters or less" };

    fields.title = title;
  }

  if (!partial || body.author !== undefined) {
    const author = cleanText(body.author);

    if (!author) return { error: "Author is required" };
    if (author.length > 80)
      return { error: "Author must be 80 characters or less" };

    fields.author = author;
  }

  if (!partial || body.status !== undefined) {
    const status = cleanText(body.status);
    const allowedStatuses = ["want to read", "reading", "finished"];

    if (!allowedStatuses.includes(status)) {
      return { error: "Choose a valid reading status" };
    }

    fields.status = status;
  }

  if (!partial || body.rating !== undefined) {
    if (
      body.rating === "" ||
      body.rating === null ||
      body.rating === undefined
    ) {
      fields.rating = null;
    } else {
      const rating = Number(body.rating);

      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return { error: "Rating must be a whole number from 1 to 5" };
      }

      fields.rating = rating;
    }
  }

  return { fields };
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = cleanText(req.body.name);
    const email = cleanEmail(req.body.email);
    const { password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (name.length < 2 || name.length > 40) {
      return res
        .status(400)
        .json({ message: "Name must be 2 to 40 characters" });
    }

    if (email.length > 120 || !email.includes("@")) {
      return res.status(400).json({ message: "Enter a valid email" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      password: hashedPassword,
    });

    res.status(201).json({ message: "Account created" });
  } catch (error) {
    console.log("Register error:", error.message);
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = cleanEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    req.session.userId = user._id;

    res.json({
      message: "Logged in",
      user: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.log("Login error:", error.message);
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      user: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.log("Session check error:", error.message);
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.post("/api/books", requireAuth, async (req, res) => {
  try {
    const result = getBookInput(req.body);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    const book = await Book.create({
      ...result.fields,
      user: req.session.userId,
    });

    res.status(201).json({
      message: "Book added",
      book,
    });
  } catch (error) {
    console.log("Add book error:", error.message);
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.get("/api/books", requireAuth, async (req, res) => {
  try {
    const books = await Book.find({ user: req.session.userId }).sort({
      createdAt: -1,
    });
    res.json(books);
  } catch (error) {
    console.log("Get books error:", error.message);
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.put("/api/books/:id", requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    const result = getBookInput(req.body, true);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    if (Object.keys(result.fields).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const book = await Book.findOneAndUpdate(
      { _id: req.params.id, user: req.session.userId },
      result.fields,
      { new: true }
    );

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json({
      message: "Book updated",
      book,
    });
  } catch (error) {
    console.log("Update book error:", error.message);
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.delete("/api/books/:id", requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    const book = await Book.findOneAndDelete({
      _id: req.params.id,
      user: req.session.userId,
    });

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json({
      message: "Book deleted",
      deletedId: req.params.id,
    });
  } catch (error) {
    console.log("Delete book error:", error.message);
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

connectDatabase()
  .then(() => {
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log("Server running on http://localhost:" + PORT);
    });
  })
  .catch((error) => {
    console.log("Startup error:", error.message);
    process.exit(1);
  });
