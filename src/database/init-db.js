// import MongoClient and ServerApiVersion from the mongodb library and import products from the products.js file.
import { MongoClient, ServerApiVersion } from "mongodb";
import {products} from "./products.js";
import * as argon2 from "argon2";

const hashedPassword = await argon2.hash("password");
const now = new Date();


//build the uri for our connection string
const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_URI}`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
});

const db = client.db(process.env.MONGO_DATABASE)
//define the init function to connect to our database and create collections
const init = async () => {
  try {
    await client.connect();
    console.log(`Connected to MongoDB`);
    // get a reference to the actual database we will be using with .db(<database name>)
    
    // initialize the Products collection
    await seedProducts(db);
    await seedUsers(db);
  } catch (error) {
    console.error(error.message);
  } finally {
    await client.close();
  }
};

const lowerCaseKeys = function(obj) {
  // if it is an object, but NOT an array, then we need to iterate through all of its keys
  if (typeof obj === "object" && !Array.isArray(obj)) {
    for (let key in obj) {
      // take the first letter (key[0]) of the key and make it lowercase
      // then add that to the rest of the key after REMOVING the first letter (key.slice(1))
      let newKey = key[0].toLowerCase() + key.slice(1);
      // if the value of this key is an object, then we need to call this function again
      if (typeof obj[key] === "object") {
        obj[newKey] = lowerCaseKeys(obj[key]);
        delete obj[key];
      } else {
        obj[newKey] = obj[key];
        delete obj[key];
      }
    }
  } else if (Array.isArray(obj)) {
    // if it is an array, then we need to iterate through each item in the array
    // and for each object value call the function again.
    for (let i = 0; i < obj.length; i++) {
      let item = obj[i];
      if (typeof item === "object") {
        obj[i] = lowerCaseKeys(item);
      }
    }
  }
  return obj;
}

const seedProducts = async (db) => {
  // we need to make a small transform to the provided data before inserting
  // use .map() to transform each product before inserting it into the database
  // change Reviews.ReviewUrl to match the following pattern: /products/<productId>/reviews/
  const newProducts = products.map((product) => {
    product.Reviews.ReviewsUrl = `/products/${product.Id}/reviews/`;
    product = lowerCaseKeys(product);

    return product;
  })

  // while we are at it...the data provided used a PascalCase naming convention for its keys. Use the provided lowerCaseKeys function to convert all keys to camelCase. This will make it consistent with the rest of our models.
  
  try {
    // drop the collection to clear out the old records
    await db.collection("products").drop()
    console.log("Collection 'products' dropped successfully");

    // create a new collection
    await db.createCollection("products");
    console.log("Collection 'products' created successfully");
    // insert all products
    const result = await db.collection("products").insertMany(newProducts);
    console.log(
      `${result.insertedCount} new listing(s) created with the following id(s):`
    );
    console.log(result.insertedIds);
  } catch (error) {
    console.error(error.message);
  }
};
const seedUsers = async (db) => {
  try {
    // Drop the users collection if it exists
    const exists = await db.listCollections({ name: "users" }).hasNext();

    if (exists) {
      await db.collection("users").drop();
      console.log("Collection 'users' dropped successfully");
    }

    // Create the users collection
    await db.createCollection("users");
    console.log("Collection 'users' created successfully");

    await db.collection("users").createIndex(
      {email: 1},
      {unique: true}
    );

    // Insert a test user
    const testUser = {
      name: "Test User",
      email: "test@example.com",
      password_hash:await argon2.hash("test123"),
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("users").insertOne(testUser);
    console.log("Test user added successfully");

    // Create an index on email
    await db.collection("users").createIndex(
      { email: 1 },
      { unique: true }
    );

    console.log("Users index created successfully");
  } catch (error) {
    console.error(error.message);
  }
};

init();