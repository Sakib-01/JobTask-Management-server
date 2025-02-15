require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
const app = express();

// middleware
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://prorecco.netlify.app",
  ],
  credentials: true,
  optionalSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cpvw6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// verify token custom middleware

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  // console.log(token);
  if (!token) return res.status(401).send({ message: "unauthorized access" });
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
  });
  next();
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const taskCollection = client.db("taskManagement").collection("tasks");

    // jwt post

    app.post("/jwt", (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.SECRET_KEY, {
        expiresIn: "10d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          // secure: false,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // jwt logout
    app.get("/logout", async (req, res) => {
      res
        .clearCookie("token", {
          maxAge: 0,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // get specific  task by id############
    app.get("/task/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const task = { _id: new ObjectId(id) };

      const result = await taskCollection.findOne(task);
      res.send(result);
    });

    // get task by his/her email ##########
    app.get("/my-task/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.user?.email;
      const query = { userEmail: email };

      // console.log("email from token-->", decodedEmail);
      // console.log("email from params-->", email);

      if (decodedEmail !== email)
        return res.status(403).send({ message: "unauthorized access" });

      const result = await taskCollection.find(query).toArray();
      res.send(result);
    });

    // post tasks #####
    app.post("/add-task", verifyToken, async (req, res) => {
      try {
        const newTask = { ...req.body, status: "pending" }; // Set default status to "pending"
        const result = await taskCollection.insertOne(newTask);
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Failed to add task", error: error.message });
      }
    });

    // update Tasks################

    app.put("/editTask/:id", verifyToken, async (req, res) => {
      const queryData = req.body;
      const id = req.params.id;
      const updated = {
        $set: queryData,
      };
      const query = { _id: new ObjectId(id) };
      const option = { upsert: true };
      const result = await taskCollection.updateOne(query, updated, option);
      res.send(result);
    });

    // update task status###########
    app.patch("/updateTask/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid Task ID" });
        }

        const query = { _id: new ObjectId(id) };
        const updated = { $set: { status } };

        const result = await taskCollection.updateOne(query, updated);

        if (result.modifiedCount === 1) {
          res.status(200).json({ message: "Task status updated successfully" });
        } else {
          res
            .status(404)
            .json({ message: "Task not found or no changes made" });
        }
      } catch (error) {
        res.status(500).json({ message: "Error updating task status", error });
      }
    });

    // Delete specific task by ID###########
    app.delete("/deleteTask/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid Task ID" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await taskCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.status(200).json({ message: "Task deleted successfully" });
        } else {
          res.status(404).json({ message: "Task not found" });
        }
      } catch (error) {
        res.status(500).json({ message: "Error deleting task", error });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Task management server running");
});

app.listen(port, () => {
  console.log(`port is running on ${port}`);
});
