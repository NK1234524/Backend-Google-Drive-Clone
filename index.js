import express from "express";
import cors from "cors"; // Import cors
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express(); // Define app first


app.use(cors());


app.use(cors({
  origin: ["https://frontend-google-drive-clone.vercel.app"], 
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));






app.use(express.json()); // For JSON
app.use(express.urlencoded({ extended: true })); // For form data

// Multer setup: store file in memory so we can send to Supabase
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ===== AUTH =====
app.post("/signup", async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Create in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({ 
            email, 
            password 
        });
        
        if (authError) throw authError;

        // 2. Also create in your custom table (without password!)
        const { data: customData, error: customError } = await supabase
            .from("users")
            .insert([{
                email: email,
                auth_user_id: authData.user.id, // Link both systems
                created_at: new Date().toISOString()
                // No password here - it's in auth.users
            }])
            .select();

        res.json({ auth: authData, custom: customData });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ===== PASSWORD UPDATE =====
app.patch("/change-password", async (req, res) => {
    try {
        if (!req.body || !req.body.email || !req.body.currentPassword || !req.body.newPassword) {
            return res.status(400).json({
                error: "Email, current password, and new password are required"
            });
        }

        const { email, currentPassword, newPassword } = req.body;

        // First, verify current password by signing in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password: currentPassword
        });

        if (signInError) {
            return res.status(401).json({ error: "Current password is incorrect" });
        }

        // If sign-in successful, update to new password
        const { data, error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ 
            message: "Password changed successfully",
            data: {
                user: data.user
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ==== Upload ====
app.post("/upload-file", upload.single("file"), async (req, res) => {
  console.log("File received:", req.file);
  console.log("Body:", req.body);
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { originalname, buffer, mimetype } = req.file;

    const { data, error } = await supabase.storage
      .from("my-bucket") // bucket name
      .upload(`uploads/${Date.now()}-${originalname}`, buffer, {
        contentType: mimetype,
      });

    if (error) throw error;

    res.json({ message: "File uploaded successfully", data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ===== DATABASE - Create =====
app.post("/users", async (req, res) => {
  const { name, age } = req.body;
  const { data, error } = await supabase
    .from("users")
    .insert([{ name, age }])
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ===== DATABASE - Read =====
app.get("/find-users", async (req, res) => {
  const { data, error } = await supabase.from("users").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.get("/Home", (req, res) => {
    res.send("Welcome to the page");
    console.log("Listening");
});

// ===== START SERVER =====
app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});