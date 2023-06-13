const express = require('express')
const app = express()
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config()
const stripe = require('stripe')(process.env.Payment_Key)
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.Access_Token, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rbswnxn.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const ApertureAcademyUsersCollection = client.db('ApertureAcademy').collection('users');
        const ClassesCollection = client.db('ApertureAcademy').collection('classes');
        const SelectedClassesCollection = client.db('ApertureAcademy').collection('selected');
        const PaymentClassesCollection = client.db('ApertureAcademy').collection('payment');

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.Access_Token, {
                expiresIn: '2h'
            })
            res.send({ token })
        })

        // All Get 

        // Selected class Get For vercel
        app.get('/selectedClass', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            const query = { email: email };
            const result = await SelectedClassesCollection.find(query).toArray();
            res.send(result);
        });

        // Payment Api Get For Vercel
        app.get('/payments', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            const query = { email: email };
            const result = await PaymentClassesCollection.find(query).toArray();
            res.send(result);
        });

        // Class api Get For Vercel
        app.get('/classes', async (req, res) => {
            const result = await ClassesCollection.find().toArray();
            res.send(result);
        })

        app.get('/classes/:email', async (req, res) => {
            // console.log(req.params.email)
            const classes = await ClassesCollection.find({ instructorEmail: req.params.email }).toArray();
            res.send(classes)
        })

        app.get('/myClasses/update/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const query = { _id: new ObjectId(id) }
            const classes = await ClassesCollection.findOne(query)
            console.log(classes)
            res.send(classes)
        })

        // User Apis
        app.get('/users', async (req, res) => {
            const result = await ApertureAcademyUsersCollection.find().toArray();
            res.send(result);
        })

        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }
            const query = { email: email }
            const user = await ApertureAcademyUsersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })

        app.get('/users/Instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ Instructor: false })
            }
            const query = { email: email }
            const user = await ApertureAcademyUsersCollection.findOne(query);
            const result = { Instructor: user?.role === 'Instructor' }
            res.send(result);
        })

        app.get('/users/student/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ student: false })
            }
            const query = { email: email }
            const user = await ApertureAcademyUsersCollection.findOne(query);
            const result = { student: !user || !user.role };
            res.send(result);
        })
        // All Get End

        
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await ApertureAcademyUsersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
            const result = await ApertureAcademyUsersCollection.insertOne(user);
            res.send(result);
        });

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await ApertureAcademyUsersCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        app.patch('/users/Instructor/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'Instructor'
                }
            }
            const result = await ApertureAcademyUsersCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await ApertureAcademyUsersCollection.deleteOne(query)
            res.send(result);
        })

        // Class api
        app.put('/myClasses/update/:id', async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;
            console.log(updatedData)
            const filter = { _id: new ObjectId(id) }
            const option = { upsert: true }
            const Updated = {
                $set: {
                    availableSeats: updatedData.availableSeats,
                    className: updatedData.className,
                    instructorEmail: updatedData.instructorEmail,
                    instructorName: updatedData.instructorName,
                    price: updatedData.price,
                    ClassImage: updatedData.ClassImage,
                    role: updatedData.role
                }
            }
            const result = await ClassesCollection.updateOne(filter, Updated, option);
            res.send(result);
        })

        app.post('/classes', async (req, res) => {
            const classes = req.body;
            const result = await ClassesCollection.insertOne(classes);
            res.send(result);
        });

        app.patch('/classes/approved/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            console.log(query)
            const updateDoc = {
                $set: {
                    role: 'approved'
                }
            }
            const result = await ClassesCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        app.patch('/classes/denied/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'denied'
                }
            }
            const result = await ClassesCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        app.patch('/classes/pending/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'pending'
                }
            }
            const result = await ClassesCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        app.patch('/classes/feedback/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const feedback = req.body.feedback;
            console.log(feedback);
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    feedback: feedback
                }
            };
            const result = await ClassesCollection.updateOne(query, updateDoc);
            res.send(result);
        });

        // Selected class
        app.post('/selectedClass', async (req, res) => {
            const item = req.body;
            const query = { classId: item.classId }
            const existingItem = await SelectedClassesCollection.findOne(query);
            if (existingItem) {
                return res.send({ message: 'class already enroll' })
            }
            const result = await SelectedClassesCollection.insertOne(item);
            res.send(result);
        })

        app.get('/selectedClasses/payment/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await SelectedClassesCollection.findOne(query)
            res.send(result)
        })

        app.delete('/selectedClass/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const deleted = await SelectedClassesCollection.deleteOne(query)
            res.send(deleted)
        })

        // Payment  Api
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const insertResult = await PaymentClassesCollection.insertOne(payment);
            const classId = payment.classId;
            const filter = { _id: new ObjectId(classId) }
            const updateDoc = {
                $inc: { availableSeats: -1, Enrolled: +1 }
            }
            const updatedSeats = await ClassesCollection.updateOne(filter, updateDoc);
            const id = payment.selectedId;
            const query = { _id: new ObjectId(id) }
            const deleted = await SelectedClassesCollection.deleteOne(query)
            res.send({ insertResult, updatedSeats, deleted });
        })


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Aperture Academy Running!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})