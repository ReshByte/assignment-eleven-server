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

    const mealCollection = db.collection("meals");
    const reviewCollection = db.collection("reviews");
    const favoriteCollection = db.collection("favorites");

    console.log("Connected to MongoDB Successfully!");

    // ------------------------
    // Meals Routes
    // ------------------------

    app.get("/meals/six", async (req, res) => {
      try {
        const meals = await mealCollection.find().limit(6).toArray();
        res.send(meals);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch six meals" });
      }
    });

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

        res.send({
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          meals
        });
      } catch (err) {
        console.log(err);
        res.status(500).send({ error: "Failed to fetch meals" });
      }
    });

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

    // ------------------------
    // Reviews Routes
    // ------------------------

    // GET all reviews for a specific meal
    app.get("/reviews/:mealId", async (req, res) => {
      try {
        const mealId = req.params.mealId;
        const reviews = await reviewCollection
          .find({ foodId: mealId }) // foodId stored as string
          .sort({ date: -1 })
          .toArray();
        res.send(Array.isArray(reviews) ? reviews : []);
      } catch (err) {
        console.log(err);
        res.status(500).send({ error: "Failed to fetch reviews" });
      }
    });

  


    // POST a new review
    app.post("/reviews", async (req, res) => {
      try {
        const review = req.body;
        review.foodId = String(review.foodId); // ensure string
        review.date = new Date().toISOString(); // ISO string date

        const result = await reviewCollection.insertOne(review);
        res.send({ success: true, insertedId: result.insertedId, review });
      } catch (err) {
        console.log(err);
        res.status(500).send({ error: "Failed to submit review" });
      }
    });

    // ------------------------
    // Favorites Routes
    // ------------------------

    app.post("/favorites", async (req, res) => {
      try {
        const fav = req.body;
        const exists = await favoriteCollection.findOne({ userEmail: fav.userEmail, mealId: fav.mealId });
        if (exists) return res.send({ success: false, message: "Already in favorites" });

        fav.addedTime = new Date();
        await favoriteCollection.insertOne(fav);
        res.send({ success: true, message: "Added to favorites" });
      } catch (err) {
        console.log(err);
        res.status(500).send({ error: "Failed to add favorite" });
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
