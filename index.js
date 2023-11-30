const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jlioc3w.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const database = client.db("FairMarriage");
    const Biodatas = database.collection("Biodata");
    const reviews = database.collection("Reviews");
    const userCollection = database.collection("Users");
    const requestCollection = database.collection("ContactRequests");
    const favourites = database.collection("favourites");
    const premiumRequests = database.collection("premiumRequests");

    app.get("/featureBiodatas", async (req, res) => {
      const queryForPremium = {role: "premium"}
      const premiumUser = await userCollection.find(queryForPremium).toArray();
      const premiumMembers = premiumUser.map(item => item.email);
      const query = {email: {$in: premiumMembers}}
      const result = await Biodatas.find(query).sort({ age: 1 }).limit(6).toArray();
      res.send(result);
    });

    app.get("/biodatas", async (req, res) => {
      const result = await Biodatas.find().toArray();
      res.send(result);
    });
    
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/biodataCounts", async (req, res) => {
      const maleQuery = {bioType: { $regex: new RegExp('^' + "male" + '$', 'i') }}
      const femaleQuery = {bioType: { $regex: new RegExp('^' + "female" + '$', 'i') }}
      const totalBio = await Biodatas.estimatedDocumentCount();
      const maleBio = await Biodatas.countDocuments(maleQuery);
      const femaleBio = await Biodatas.countDocuments(femaleQuery);
      const totalMarriage = await reviews.estimatedDocumentCount();
      res.send({
        totalBio,
        maleBio,
        femaleBio,
        totalMarriage
      });
    });

    app.get("/revenues", async (req, res) => {
      const maleQuery = {bioType: { $regex: new RegExp('^' + "male" + '$', 'i') }}
      const femaleQuery = {bioType: { $regex: new RegExp('^' + "female" + '$', 'i') }}
      const premiumQuery = {role: "premium"}
      const totalBio = await Biodatas.estimatedDocumentCount();
      const maleBio = await Biodatas.countDocuments(maleQuery);
      const femaleBio = await Biodatas.countDocuments(femaleQuery);
      const totalpremium = await userCollection.countDocuments(premiumQuery);
      const revenue = await requestCollection.estimatedDocumentCount();
      res.send({
        totalBio,
        maleBio,
        femaleBio,
        totalpremium,
        revenue: revenue*500
      });
    });

    app.get("/contactRequests", async (req, res) => {
      const email = req.query.email;
      const query = {email: email}
      const result = await requestCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/apprContRequests", async (req, res) => {
      const result = await requestCollection.find().toArray();
      res.send(result);
    });

    app.get("/premiumRequests", async (req, res) => {
      const result = await premiumRequests.find().toArray();
      res.send(result);
    });

    app.get("/favourites", async (req, res) => {
      const email = req.query.email;
      const query = {email: email}
      const result = await favourites.find(query).toArray();
      res.send(result);
    });

    app.get("/reviews", async (req, res) => {
      const result = await reviews
        .aggregate([
          {
            $addFields: {
              parsedDate: {
                $dateFromString: {
                  dateString: "$marriage_date",
                  format: "%m-%d-%Y",
                },
              },
            },
          },
          {
            $sort: {
              parsedDate: 1,
            },
          },
        ])
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/biodatas/:bioId", async (req, res) => {
      const bioId = parseInt(req.params.bioId);
      const query = { bioId: bioId };
      const result = await Biodatas.findOne(query);
      res.send(result);
    });

    app.get("/userBiodata", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await Biodatas.findOne(query);
      res.send(result);
    });

    app.get("/userRole", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.get("/similarbio", async (req, res) => {
      const gender = req.query.gender;
      const query = { bioType: gender };
      const result = await Biodatas.find(query)
        .sort({ age: 1 })
        .limit(3)
        .toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const query = {email: newUser.email}
      const alreadyExist = await userCollection.findOne(query);
      if (!alreadyExist) {
        const result = await userCollection.insertOne(newUser);
        res.send(result);
      }else{
        res.send(alreadyExist);
      }
      
    });

    app.post("/biodatas", async (req, res) => {
      let bioId;
      const lastDocument = await Biodatas
        .find()
        .sort({ bioId: -1 }) 
        .limit(1)
        .toArray();

      if (lastDocument.length > 0) {
        bioId = lastDocument[0].bioId + 1;
      } else {
        bioId = 1;
      }

      const doc = req.body;
      const result = await Biodatas.insertOne({...doc, bioId});
      res.send(result);
    });

    app.patch("/biodatas/:bioId", async (req, res) => {
      const bioId = parseInt(req.params.bioId);
      const updateDoc = {
        $set: req.body
      }
      const query = {bioId: bioId};
      const result = await Biodatas.updateOne(query, updateDoc);
      res.send({...req.body, bioId});
    });

    app.patch('/usersAdmin', async (req, res) => {
      const email = req.body.email;
      const updateDoc = {
        $set: {role: 'admin'}
      }
      const query = {email: email};
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.patch('/usersPremium', async (req, res) => {
      const email = req.body.email;
      const updateDoc = {
        $set: {role: 'premium'}
      }
      const query = {email: email};
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.patch("/premiumRequests", async (req, res) => {
      const email = req.body.email;
      const updateDoc = {
        $set: {status: 'approved'}
      }
      const query = {email: email};
      const result = await premiumRequests.updateOne(query, updateDoc);
      res.send(result);
    });

    app.patch("/contactRequests", async (req, res) => {
      const email = req.body.email;
      const updateDoc = {
        $set: {status: 'approved'}
      }
      const query = {email: email}
      const result = await requestCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.post("/favourites", async (req, res) => {
      const newRequest = req.body;
      const result = await favourites.insertOne(newRequest);
      res.send(result);
    });

    app.post("/contactRequests", async (req, res) => {
      const newRequest = req.body;
      const result = await requestCollection.insertOne(newRequest);
      res.send(result);
    });

    app.post("/premiumRequests", async (req, res) => {
      const newRequest = req.body;
      const result = await premiumRequests.insertOne(newRequest);
      res.send(result);
    });

    app.delete("/contactRequests/:biodataId", async (req, res) => {
      const biodataId = req.params.biodataId;
      const query = {biodataId: biodataId}
      const result = await requestCollection.deleteOne(query);
      res.send(result);
    });

    app.delete("/favourites/:biodataId", async (req, res) => {
      const biodataId = req.params.biodataId;
      const query = {biodataId: parseInt(biodataId)}
      const result = await favourites.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("fair marriage is on action");
});

app.listen(port, (req, res) => {
  console.log(`listening on port ${port}`);
});
