const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// MongoDB connection string
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tdc5fzi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    const db = client.db("chef_db");

    // Collections
    const mealCollection = db.collection("meals");
    const reviewCollection = db.collection("reviews");
    const favoriteCollection = db.collection("favorites");
    const userCollection = db.collection("users");
    const orderCollection = db.collection("orders");

    console.log("Connected to MongoDB Successfully!");

    // ------------------------
    // USER ROUTES
    // ------------------------

    // Get user by email
    app.get("/user/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await userCollection.findOne({ email });
        if (!user) return res.status(404).send({ error: "User not found" });
        res.send(user);
      } catch (err) {
        console.log(err);
        res.status(500).send({ error: "Failed to fetch user" });
      }
    });

    // Be a Chef
    app.patch("/user/be-chef/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const chefId = "CHEF-" + Math.floor(100000 + Math.random() * 900000);
        await userCollection.updateOne({ email }, { $set: { role: "chef", chefId } });
        res.send({ success: true, message: "User is now a chef", chefId });
      } catch (err) {
        console.log(err);
        res.status(500).send({ error: "Failed to update chef role" });
      }
    });

    // Be an Admin
    app.patch("/user/be-admin/:email", async (req, res) => {
      try {
        const email = req.params.email;
        await userCollection.updateOne({ email }, { $set: { role: "admin" } });
        res.send({ success: true, message: "User is now an admin" });
      } catch (err) {
        console.log(err);
        res.status(500).send({ error: "Failed to update admin role" });
      }
    });

    // ------------------------
    // MEALS ROUTES
    // ------------------------

    // Get 6 meals
    app.get("/meals/six", async (req, res) => {
      try {
        const meals = await mealCollection.find().limit(6).toArray();
        res.send(meals);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch six meals" });
      }
    });

    // Get all meals with pagination
    app.get("/meals", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const sort = req.query.sort === "desc" ? -1 : 1;
        const skip = (page - 1) * limit;
        const total = await mealCollection.countDocuments();
        const meals = await mealCollection
          .find()
          .sort({ price: sort })
          .skip(skip)
          .limit(limit)
          .toArray();
        res.send({ total, page, limit, totalPages: Math.ceil(total / limit), meals });
      } catch (err) {
        console.log(err);
        res.status(500).send({ error: "Failed to fetch meals" });
      }
    });

    // Meal details by ID
    app.get("/meal-details/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const meal = await mealCollection.findOne({ _id: new ObjectId(id) });
        if (!meal) return res.status(404).send({ error: "Meal not found" });
        res.send(meal);
      } catch (err) {
        console.log(err);
        res.status(500).send({ error: "Failed to fetch meal details" });
      }
    });


    //order
    
// Create order
app.post("/orders", async (req, res) => {
  try {
    const order = req.body;
    const result = await orderCollection.insertOne(order);
    res.send({ success: true, insertedId: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to place order" });
  }
});

    // ------------------------
    // REVIEW ROUTES
    // ------------------------

    // Get all reviews
    app.get("/reviews", async (req, res) => {
      try {
        const reviews = await reviewCollection.find().sort({ date: -1 }).toArray();
        res.send(reviews);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch all reviews" });
      }
    });

    // Get reviews for a meal
    app.get("/reviews/:mealId", async (req, res) => {
      try {
        const mealId = req.params.mealId;
        const reviews = await reviewCollection.find({ foodId: mealId }).sort({ date: -1 }).toArray();
        res.send(reviews);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch reviews" });
      }
    });

    // Add a review
    app.post("/reviews", async (req, res) => {
      try {
        const review = req.body;
        review.foodId = String(review.foodId);
        review.date = new Date().toISOString();
        const result = await reviewCollection.insertOne(review);
        res.send({ success: true, insertedId: result.insertedId, review });
      } catch (err) {
        res.status(500).send({ error: "Failed to submit review" });
      }
    });

    // Delete a review
    app.delete("/reviews/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await reviewCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) return res.status(404).send({ success: false, message: "Review not found" });
        res.send({ success: true, message: "Review deleted successfully" });
      } catch (err) {
        res.status(500).send({ success: false, message: "Failed to delete review" });
      }
    });

    // Update a review
    app.patch("/reviews/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { rating, comment } = req.body;
        const result = await reviewCollection.updateOne({ _id: new ObjectId(id) }, { $set: { rating, comment } });
        if (result.matchedCount === 0) return res.status(404).send({ success: false, message: "Review not found" });
        const updatedReview = await reviewCollection.findOne({ _id: new ObjectId(id) });
        res.send({ success: true, message: "Review updated successfully", review: updatedReview });
      } catch (err) {
        res.status(500).send({ success: false, message: "Failed to update review" });
      }
    });

    // ------------------------
    // FAVORITES ROUTES
    // ------------------------

    // Add to favorites
    app.post("/favorites", async (req, res) => {
      try {
        const fav = req.body;
        const exists = await favoriteCollection.findOne({ userEmail: fav.userEmail, mealId: fav.mealId });
        if (exists) return res.send({ success: false, message: "Already in favorites" });
        fav.addedTime = new Date();
        await favoriteCollection.insertOne(fav);
        res.send({ success: true, message: "Added to favorites" });
      } catch (err) {
        res.status(500).send({ success: false, message: "Failed to add favorite" });
      }
    });

    // Get favorites by user email
    app.get("/favorites/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const favorites = await favoriteCollection.find({ userEmail: email }).sort({ addedTime: -1 }).toArray();
        res.send(favorites);
      } catch (err) {
        res.status(500).send({ success: false, message: "Failed to fetch favorites" });
      }
    });

    // Delete favorite by ID
    app.delete("/favorites/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await favoriteCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) return res.status(404).send({ success: false, message: "Favorite not found" });
        res.send({ success: true, message: "Meal removed from favorites successfully." });
      } catch (err) {
        res.status(500).send({ success: false, message: "Failed to delete favorite" });
      }
    });

  } catch (error) {
    console.error(error);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Chef server is running...");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
