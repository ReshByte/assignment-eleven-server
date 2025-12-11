const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tdc5fzi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("chef_db");

    const mealCollection = db.collection("meals");
    const reviewCollection = db.collection("reviews");
    const favoriteCollection = db.collection("favorites");
    const userCollection = db.collection("users");
    const orderCollection = db.collection("orders");
    const roleRequestCollection = db.collection("roleRequests");
    const paymentCollection = db.collection("payments");

    console.log("Connected to MongoDB Successfully!");

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    
    app.post("/meals", async (req, res) => {
  try {
    const meal = req.body;

    // Fallbacks
    meal.rating = meal.rating || 0;
    meal.createdAt = new Date();

    const result = await mealCollection.insertOne(meal);
    res.send(result);

  } catch (error) {
    console.error("Error creating meal:", error);
    res.status(500).send({ message: "Failed to create meal" });
  }
});

 // GET ALL MEALS BY CHEF EMAIL
    app.get("/meals/chef/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const result = await mealCollection.find({ userEmail: email }).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching meals:", error);
        res.status(500).send({ message: "Failed to fetch meals" });
      }
    });

    // GET SINGLE MEAL
    app.get("/meal-details/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const meal = await mealCollection.findOne({ _id: new ObjectId(id) });
        res.send(meal);
      } catch (error) {
        console.error("Error fetching meal details:", error);
        res.status(500).send({ message: "Meal not found" });
      }
    });

    // DELETE MEAL
    app.delete("/meals/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await mealCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        console.error("Error deleting meal:", error);
        res.status(500).send({ message: "Failed to delete meal" });
      }
    });

    // UPDATE MEAL
    app.patch("/meals/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedMeal = req.body;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            foodName: updatedMeal.foodName,
            chefName: updatedMeal.chefName,
            chefExperience: updatedMeal.chefExperience,
            chefId: updatedMeal.chefId,
            foodImage: updatedMeal.foodImage,
            price: updatedMeal.price,
            ingredients: updatedMeal.ingredients,
            estimatedDeliveryTime: updatedMeal.estimatedDeliveryTime,
            rating: updatedMeal.rating || 0,
          },
        };

        const result = await mealCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating meal:", error);
        res.status(500).send({ message: "Failed to update meal" });
      }
    });


//----------------------------------------------------------

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      const query = { _id: new ObjectId(payment.orderId) };
      const updateDoc = {
        $set: {
          paymentStatus: "paid",
          transactionId: payment.transactionId,
        },
      };
      const updateResult = await orderCollection.updateOne(query, updateDoc);

      res.send({ paymentResult, updateResult });
    });

    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.patch("/users/fraud/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: { status: "fraud" },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.get("/admin-stats", async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const meals = await mealCollection.estimatedDocumentCount();
      const orders = await orderCollection.estimatedDocumentCount();

      const payments = await paymentCollection.find().toArray();
      const revenue = payments.reduce(
        (total, payment) => total + payment.price,
        0
      );

      res.send({
        users,
        meals,
        orders,
        revenue,
      });
    });

    app.post("/meals", async (req, res) => {
      const item = req.body;
      const result = await mealCollection.insertOne(item);
      res.send(result);
    });

    app.get("/meals/six", async (req, res) => {
      const result = await mealCollection.find().limit(6).toArray();
      res.send(result);
    });

    app.get("/meals", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const sort = req.query.sort === "desc" ? -1 : 1;
      const skip = (page - 1) * limit;
      const total = await mealCollection.countDocuments();

      const result = await mealCollection
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
        meals: result,
      });
    });

    app.get("/meals/chef/:email", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await mealCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/meal-details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealCollection.findOne(query);
      res.send(result);
    });

    app.delete("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/meals/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          foodName: item.foodName,
          foodImage: item.foodImage,
          price: item.price,
          ingredients: item.ingredients,
          description: item.description,
          category: item.category,
        },
      };
      const result = await mealCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.get("/role-requests", async (req, res) => {
      const result = await roleRequestCollection.find().toArray();
      res.send(result);
    });

    app.post("/role-requests", async (req, res) => {
      const request = req.body;
      const query = { userEmail: request.userEmail, requestStatus: "pending" };
      const existingRequest = await roleRequestCollection.findOne(query);
      if (existingRequest) {
        return res.send({ message: "Request already pending", success: false });
      }
      const result = await roleRequestCollection.insertOne(request);
      res.send({ result, success: true });
    });

app.patch("/role-requests/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      console.log(`Processing Request ID: ${id}`);

      // এখানে চেক করা হচ্ছে আইডিটি কি ObjectId ফরম্যাটের নাকি সাধারণ স্ট্রিং
      let filter = {};
      if (ObjectId.isValid(id)) {
          filter = { _id: new ObjectId(id) };
      } else {
          filter = { _id: id }; // যদি সাধারণ স্ট্রিং আইডি হয়
      }
      
      try {
          // ১. রিকোয়েস্টটি খুঁজে বের করা
          const requestDoc = await roleRequestCollection.findOne(filter);
          
          if (!requestDoc) {
            return res.status(404).send({ message: "Request not found in Database" });
          }

          // ২. স্ট্যাটাস আপডেট করা
          const updatedDoc = {
            $set: { requestStatus: status }
          };
          const requestUpdate = await roleRequestCollection.updateOne(filter, updatedDoc);

          // ৩. ইউজার রোল চেঞ্জ করা (যদি Approved হয়)
          if (status === 'approved') {
            const userEmail = requestDoc.userEmail || requestDoc.email;
            const type = requestDoc.requestType.toLowerCase(); 
            
            let userUpdateDoc = {};

            if (type === 'chef') {
              const chefId = "CHEF-" + Math.floor(100000 + Math.random() * 900000);
              userUpdateDoc = { $set: { role: 'chef', chefId: chefId } };
            } else if (type === 'admin') {
              userUpdateDoc = { $set: { role: 'admin' } };
            }

            if (userEmail) {
                await userCollection.updateOne({ email: userEmail }, userUpdateDoc);
            }
          }

          res.send(requestUpdate);

      } catch (error) {
          console.error("Error in PATCH:", error);
          res.status(500).send({ message: "Internal Server Error" });
      }
    });
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.send(result);
    });

    app.get("/orders/:email", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await orderCollection
        .find(query)
        .sort({ orderTime: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/orders/chef/:chefId", async (req, res) => {
      const chefId = req.params.chefId;
      const query = { chefId: chefId };
      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: { orderStatus: status },
      };
      const result = await orderCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().sort({ date: -1 }).toArray();
      res.send(result);
    });

    app.get("/reviews/:mealId", async (req, res) => {
      const mealId = req.params.mealId;
      const query = { foodId: mealId };
      const result = await reviewCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    app.post("/reviews", async (req, res) => {
      const review = req.body;
      review.date = new Date();
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    app.delete("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reviewCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const { rating, comment } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: { rating, comment },
      };
      const result = await reviewCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.post("/favorites", async (req, res) => {
      const fav = req.body;
      const existing = await favoriteCollection.findOne({
        userEmail: fav.userEmail,
        mealId: fav.mealId,
      });
      if (existing) {
        return res.send({ message: "Already in favorites", insertedId: null });
      }
      const result = await favoriteCollection.insertOne(fav);
      res.send(result);
    });

    app.get("/favorites/:email", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await favoriteCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/favorites/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await favoriteCollection.deleteOne(query);
      res.send(result);
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
