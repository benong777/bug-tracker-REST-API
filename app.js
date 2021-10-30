 const express = require('express');
 const bodyParser = require('body-parser');
 const cors = require('cors');
 const mysql = require('mysql2/promise');
 const morgan = require('morgan');
 const bcrypt = require('bcrypt');
 const jwt = require('jsonwebtoken');
 
 const app = express();

 //-- Display REST API commands
 app.use(morgan('short'));
 
 //-- Get access to values in the .env file
 //-- Import and load '.env' file
 require('dotenv').config();  // equivalent to lines below
 // const dotenv = require('dotenv');
 // dotenv.config();

 //-- Use process.env to access the variables in '.env' file
 const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
 });

 const port = process.env.PORT;

app.use(async function mysqlConnection(req, res, next) {
  try {
    req.db = await pool.getConnection();
    req.db.connection.config.namedPlaceholders = true;

    //-- Traditional mode ensures not null is respected for unsupplied
    //-- fields, ensures valid JavaScript dates, etc.
    await req.db.query('SET SESSION sql_mode = "TRADITIONAL"');
    await req.db.query(`SET time_zone = '-8:00'`);

    //-- Go to the rest of the middleware until it hits an endpoint 
    await next();

    //-- Returns to here after it finishes the endpoint to release the db connection
    req.db.release();
  } catch(err) {
    //-- If anything downstream throws an error, we must release the 
    //-- connection allocated for the request
    console.log('ERROR detected');
    console.log(err);
    if (req.db) req.db.release();
    throw err;
  }
});

app.use(cors());
 
app.use(bodyParser.json());

app.get('/users', async function(req, res) {
  try {
    console.log('GET /users endpoint');
    //-- GET an ARRAY of car objects
    const [users] = await req.db.query("SELECT * FROM users");
    // res.json({message: "ALL rows returned. ", users});
    res.json(users);
  } catch(err) {
    console.log('Error caught - GET request');
  }
});

app.get('/users/:id', async function(req, res) {
  try {
    console.log('GET /users/:id endpoint');
    const { id } = req.params;
    //-- GET an individual car OBJECT that matches the ID
    const [[user]] = await req.db.query(
          "SELECT * FROM users WHERE id = :id", {id});
    // res.json({message: "Returned user: ", user});
    res.json(user);
  } catch(err) {
    console.log('Error caught - GET /user/:id request');
  }
})

//-- ***** NEED to verify that email doesn't currently exist *****
//-- Public endpoints - user doesn't need to be authenticated 
app.post('/register', async function(req, res) {
  try { 
    let user;
    //-- Pass in the password to get the password hash
    //-- then insert into the database
    bcrypt.hash(req.body.password, 10).then(async hash => {
        try {
          const { fname, lname, email, deleted_flag } = req.body;
          [user] = await req.db.query(
            `INSERT INTO users(fname, lname, email, password, deleted_flag)
                VALUES(:fname, :lname, :email, :password, :deleted_flag)`,
                  {
                    fname,
                    lname,
                    email,
                    password: hash,
                    deleted_flag                  
                  }
          )
          console.log("\n\n***** DEBUG point *****\n\n");
        } catch(err) {
            console.log('/register ERROR', err);
        }
    });
    //-- Convert to a string
    const encodedUser = jwt.sign(req.body, process.env.JWT_KEY);

    res.json(encodedUser);
  } catch(err) {

  }
});

app.put('/users/:id', async function(req, res){
  try {
    let user;
    bcrypt.hash(req.body.password, 10).then(async hash => {
      try {
        const { fname, lname, email, deleted_flag } = req.body;
        const { id } = req.params;
        const [user] = await req.db.query(
            `UPDATE users SET fname = :fname, 
                              lname = :lname,
                              email = :email,
                              password = :password,
                              deleted_flag = :deleted_flag
                              WHERE id = :id`, 
                            { 
                              fname, 
                              lname,
                              email,
                              password: hash,
                              deleted_flag,
                              id                            }
        );
        res.json({message: 'User ID: ' + id + ' has been UPDATED', user});
      } catch (err){
        console.log(err)
      }
    });
    //-- Convert to a string
    const encodedUser = jwt.sign(req.body, process.env.JWT_KEY);

    res.json(encodedUser);
  } catch(err) {

  }
});

app.delete('/users/:id', async function(req, res){
  try {
      const { id } = req.params;
      const [user] = await req.db.query(
          `UPDATE users SET deleted_flag = 1 
              WHERE id = :id`, {id}
      );
      res.json({message: 'User ID: ' + id + ' has been DELETED', user});
  } catch (err){
      console.log(err)
  }
});


 //===============================================
 // Listen for requests
 //===============================================
 app.listen(port, () => console.log(`API Example listening on http://localhost:3000`));

